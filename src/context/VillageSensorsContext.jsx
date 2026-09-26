import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { sensorDb, getSensorDatabase, SENSOR_DB_URL } from '../firebase.config';
import { SITES, DEFAULT_SITE_ID, getSite, zonesOf, resolveZoneCenter } from '../data/villages';
import {
    SENSOR_METRICS,
    evaluateMetric,
    normalizeVillageSources,
    resolveVillageSources,
    collectMetricPaths,
    defaultMetricPath,
    offsetCoords,
    pathKey
} from '../data/sensorSchema';
import { resolveSensorSources, parseSourcePath, sourcePrefix, PRIMARY_SOURCE_ID } from '../data/sensorSources';
import { DEFAULT_ALERT_CONFIG, readLocalAlertSecrets, writeLocalAlertSecrets, splitAlertConfig } from '../utils/alertChannels';
import { DEFAULT_UBIDOTS_CONFIG } from '../utils/ubidots';
import { formatTimeIST, formatClockIST } from '../utils/timeUtils';

export const VillageSensorsContext = createContext(null);

const MAX_HISTORY_POINTS = 60;      // rolling window per metric (session only)
const MAX_LIVE_SAMPLES = 2000;
const SAMPLE_MERGE_MS = 60 * 1000;
const STORAGE_KEY = 'gramvista.selectedVillage';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const readStoredSite = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return SITES.some((site) => site.id === stored) ? stored : DEFAULT_SITE_ID;
    } catch {
        return DEFAULT_SITE_ID;
    }
};

/** Dashboard settings kept in the PRIMARY database under config/. */
const readConfig = (root) => {
    const cfg = isObj(root) && isObj(root.config) ? root.config : {};
    const prototypeSiteId = SITES.some((s) => s.id === cfg.prototypeSite) ? cfg.prototypeSite : DEFAULT_SITE_ID;
    const rawAlerts = isObj(cfg.alerts) ? cfg.alerts : {};
    const { apiKey: _ignoredKey, webhookUrl: _ignoredWebhook, ...sharedAlerts } = rawAlerts; // secrets never come from Firebase
    const sources = resolveSensorSources(cfg.sources).map((s) => (s.primary && !cfg.sources?.[s.id]?.site ? { ...s, site: prototypeSiteId } : s));
    const parkingSourceId = sources.some((s) => s.id === cfg.parkingSource) ? cfg.parkingSource : PRIMARY_SOURCE_ID;
    // Optional dashboard-side soil calibration from the probe's raw ADC count (config/calibration/soil)
    const soilCal = isObj(cfg.calibration) && isObj(cfg.calibration.soil) ? cfg.calibration.soil : {};
    const calibration = {
        soil: {
            enabled: soilCal.enabled === true,
            dryRaw: Number.isFinite(Number(soilCal.dryRaw)) ? Number(soilCal.dryRaw) : 3200,
            wetRaw: Number.isFinite(Number(soilCal.wetRaw)) ? Number(soilCal.wetRaw) : 1400
        }
    };
    return {
        placement: isObj(cfg.sensorPlacement) ? cfg.sensorPlacement : {},
        prototypeSiteId,
        zoneOverrides: isObj(cfg.zones) ? cfg.zones : {},
        sharedAlertConfig: { ...DEFAULT_ALERT_CONFIG, ...sharedAlerts },
        ubidotsConfig: { ...DEFAULT_UBIDOTS_CONFIG, ...(isObj(cfg.ubidots) ? cfg.ubidots : {}) },
        firebaseBins: isObj(root) && isObj(root.waste) && isObj(root.waste.bins) ? root.waste.bins : {},
        sources,
        sourceIgnoreKeys: Object.fromEntries(sources.map((s) => [s.id, Array.isArray(cfg.sources?.[s.id]?.ignoreKeys) ? cfg.sources[s.id].ignoreKeys : []])),
        parkingSourceId,
        calibration
    };
};

/** Percent moisture from a capacitive probe's raw ADC count (higher raw = drier). */
const calibrateSoil = (raw, { dryRaw, wetRaw }) => {
    if (!Number.isFinite(raw) || dryRaw === wetRaw) return null;
    return Math.round(Math.min(100, Math.max(0, ((dryRaw - raw) / (dryRaw - wetRaw)) * 100)) * 10) / 10;
};

const zoneForReading = (site, metric, hit, placement) => {
    const placed = hit?.path ? placement?.[pathKey(hit.path)] : null;
    const zoneId = placed?.zone || metric.defaultZone?.[site.type] || null;
    const zone = zoneId ? zonesOf(site).find((z) => z.id === zoneId) : null;
    return { zoneId: zone ? zone.id : null, zoneName: zone ? zone.name : null };
};

const emptyEntry = (site) => ({
    readings: Object.fromEntries(SENSOR_METRICS.map((metric) => [metric.key, {
        ...metric, value: null, raw: null, path: null, sourceId: null, ...evaluateMetric(metric, null),
        lastUpdated: null, lastUpdatedAt: null, coords: null, ...zoneForReading(site, metric, null, {}), history: []
    }])),
    updatedAt: null, path: null, hasData: false, locations: {}, center: null
});

export const VillageSensorsProvider = ({ children }) => {
    const [selectedVillageId, setSelectedVillageIdState] = useState(readStoredSite);
    const [primaryRoot, setPrimaryRoot] = useState(null);
    const [extraRoots, setExtraRoots] = useState({});        // sourceId -> root snapshot
    const [villageData, setVillageData] = useState({});
    const [config, setConfig] = useState(() => readConfig(null));
    const [alertSecrets, setAlertSecrets] = useState(readLocalAlertSecrets); // this browser only
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastSyncAt, setLastSyncAt] = useState(null);

    const historyRef = useRef({});
    const lastRef = useRef({});
    const liveSamplesRef = useRef({});
    const [liveSamples, setLiveSamples] = useState({});
    // Per-database "node activity": last time the telemetry part of the root actually changed
    const rootDigestRef = useRef({});
    const [lastChangeAt, setLastChangeAt] = useState({});
    const noteRootChange = useCallback((sourceId, root) => {
        const telemetry = isObj(root) ? Object.fromEntries(Object.entries(root).filter(([k]) => !['config', 'alerts', 'waste'].includes(k))) : root;
        const digest = JSON.stringify(telemetry);
        if (rootDigestRef.current[sourceId] === digest) return;
        const first = rootDigestRef.current[sourceId] === undefined;
        rootDigestRef.current[sourceId] = digest;
        if (!first) setLastChangeAt((prev) => ({ ...prev, [sourceId]: new Date() }));
    }, []);

    const setSelectedVillageId = useCallback((id) => {
        if (!SITES.some((site) => site.id === id)) return;
        setSelectedVillageIdState(id);
        try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage unavailable */ }
    }, []);

    useEffect(() => {
        const unsubscribe = onValue(ref(sensorDb, '.info/connected'), (snap) => setConnected(snap.val() === true));
        return () => unsubscribe();
    }, []);

    // Primary database: telemetry + all dashboard configuration
    useEffect(() => {
        const unsubscribe = onValue(ref(sensorDb, '/'), (snapshot) => {
            const data = snapshot.val();
            noteRootChange(PRIMARY_SOURCE_ID, data);
            setPrimaryRoot(data);
            setConfig(readConfig(data));
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error('Sensor database error:', err);
            setError(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Extra databases listed in config/sources
    const extraSourcesKey = config.sources.filter((s) => !s.primary && s.enabled).map((s) => `${s.id}|${s.url}`).join(',');
    useEffect(() => {
        const extras = config.sources.filter((s) => !s.primary && s.enabled);
        const unsubs = extras.map((source) => onValue(ref(getSensorDatabase(source.url), '/'), (snap) => {
            noteRootChange(source.id, snap.val());
            setExtraRoots((prev) => ({ ...prev, [source.id]: snap.val() }));
        }, (err) => {
            console.error(`Sensor source ${source.id} error:`, err);
            setExtraRoots((prev) => ({ ...prev, [source.id]: null }));
        }));
        setExtraRoots((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => extras.some((s) => s.id === id))));
        return () => unsubs.forEach((u) => u());
    }, [extraSourcesKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // Merge every source into per-site readings whenever any root or the config changes
    useEffect(() => {
        if (primaryRoot === null && Object.keys(extraRoots).length === 0) return;
        const now = new Date();
        const next = {};
        let liveChanged = false;
        const rootsBySource = { [PRIMARY_SOURCE_ID]: primaryRoot, ...extraRoots };

        SITES.forEach((site) => {
            const parts = [];
            config.sources.filter((s) => s.enabled).forEach((source) => {
                const root = rootsBySource[source.id];
                if (!isObj(root)) return;
                parts.push(...resolveVillageSources(root, site, {
                    placement: config.placement,
                    prototypeSiteId: source.site,
                    prefix: sourcePrefix(source),
                    ignoreKeys: config.sourceIgnoreKeys[source.id]
                }));
            });
            const normalized = parts.length ? normalizeVillageSources(parts) : { readings: {}, updatedAt: null, found: 0, locations: {}, center: null, path: null };

            const readings = {};
            const liveValues = {};
            let villageChanged = false;

            // Dashboard-side soil calibration: replace the firmware percent with one computed from the raw count
            const rawSoil = normalized.readings.soil_moisture_raw?.value;
            const calibratedSoil = config.calibration.soil.enabled && Number.isFinite(rawSoil) ? calibrateSoil(rawSoil, config.calibration.soil) : null;

            SENSOR_METRICS.forEach((metric) => {
                let hit = normalized.readings[metric.key];
                if (metric.key === 'soil_moisture' && calibratedSoil !== null) {
                    hit = { ...(hit || { path: normalized.readings.soil_moisture_raw.path, raw: rawSoil }), value: calibratedSoil, reportedValue: hit?.value ?? null, derivedFrom: 'raw' };
                }
                const value = hit ? hit.value : null;
                const historyKey = `${site.id}:${metric.key}`;
                const previous = lastRef.current[historyKey];
                let lastChanged = previous?.time || null;
                if (value !== null && value !== undefined) liveValues[metric.key] = value;

                if (value !== null && value !== undefined && (!previous || previous.value !== value)) {
                    villageChanged = true;
                    lastChanged = hit.timestamp || now;
                    lastRef.current[historyKey] = { value, time: lastChanged };
                    const history = historyRef.current[historyKey] || [];
                    const nextHistory = [...history, { time: formatClockIST(lastChanged), value }];
                    historyRef.current[historyKey] = nextHistory.length > MAX_HISTORY_POINTS ? nextHistory.slice(nextHistory.length - MAX_HISTORY_POINTS) : nextHistory;
                }

                readings[metric.key] = {
                    ...metric,
                    value,
                    raw: hit?.raw ?? null,
                    path: hit?.path ?? null,
                    sourceId: hit?.path ? parseSourcePath(hit.path).sourceId : null,
                    ...evaluateMetric(metric, value),
                    ...(hit?.derivedFrom === 'raw' ? { derivedFrom: 'raw', reportedValue: hit.reportedValue, message: `${evaluateMetric(metric, value).message} · calibrated from raw ${Math.round(rawSoil)} (firmware reports ${hit.reportedValue ?? '—'} %)` } : {}),
                    lastUpdated: lastChanged ? formatTimeIST(lastChanged) : null,
                    lastUpdatedAt: lastChanged,
                    coords: hit?.coords ?? null,
                    ...zoneForReading(site, metric, hit, config.placement),
                    // Other nodes publishing the same sensor (lower-priority database or a second node in the same tree)
                    alternates: (normalized.alternates?.[metric.key] || []).map((alt) => {
                        const altSourceId = parseSourcePath(alt.path).sourceId;
                        const altSource = config.sources.find((s) => s.id === altSourceId);
                        return { value: alt.value, raw: alt.raw, path: alt.path, sourceId: altSourceId, sourceLabel: altSource?.label || altSourceId, ...evaluateMetric(metric, alt.value), ...zoneForReading(site, metric, alt, config.placement) };
                    }),
                    history: historyRef.current[historyKey] || []
                };
            });

            next[site.id] = {
                readings,
                updatedAt: normalized.updatedAt || null,
                path: normalized.found > 0 ? normalized.path : null,
                hasData: normalized.found > 0,
                locations: normalized.locations || {},
                center: normalized.center || null
            };

            if (villageChanged) {
                const list = liveSamplesRef.current[site.id] || [];
                const tail = list[list.length - 1];
                const nowMs = now.getTime();
                if (tail && nowMs - tail.ts < SAMPLE_MERGE_MS) Object.assign(tail, liveValues, { ts: nowMs });
                else list.push({ ts: nowMs, source: 'live', ...liveValues });
                liveSamplesRef.current[site.id] = list.length > MAX_LIVE_SAMPLES ? list.slice(-MAX_LIVE_SAMPLES) : list;
                liveChanged = true;
            }
        });

        if (liveChanged) {
            setLiveSamples(Object.fromEntries(Object.entries(liveSamplesRef.current).map(([id, list]) => [id, list.map((s) => ({ ...s }))])));
        }
        setVillageData(next);
        setLastSyncAt(now);
    }, [primaryRoot, extraRoots, config]);

    /** Write a value back to the node that published it (relays), keeping the type the device used. */
    const setMetricValue = useCallback(async (siteId, metricKey, nextValue) => {
        const metric = SENSOR_METRICS.find((entry) => entry.key === metricKey);
        if (!metric) throw new Error(`Unknown metric: ${metricKey}`);
        const reading = villageData[siteId]?.readings?.[metricKey];
        // Where to write: the path the node published > the metric's known control key on the
        // highest-priority database (creates it if the node has not written it yet) > canonical layout.
        let target;
        if (reading?.path) target = parseSourcePath(reading.path);
        else if (metric.controlPath) {
            const preferred = config.sources.filter((s) => s.enabled).sort((a, b) => a.priority - b.priority)[0];
            target = { sourceId: preferred ? preferred.id : PRIMARY_SOURCE_ID, path: metric.controlPath };
        } else target = parseSourcePath(defaultMetricPath(siteId, metric));
        const { sourceId, path: rawPath } = target;
        const source = config.sources.find((s) => s.id === sourceId);
        const database = source ? getSensorDatabase(source.url) : sensorDb;
        let path = rawPath;
        let payload = nextValue;
        if (metric.binary) {
            const raw = reading?.raw;
            if (raw === null || raw === undefined) {
                payload = metric.controlType === 'boolean' ? !!nextValue : metric.controlType === 'number' ? (nextValue ? 1 : 0) : (nextValue ? 'on' : 'off');
            } else if (isObj(raw)) {
                const innerKey = ['value', 'val', 'reading', 'state'].find((key) => raw[key] !== undefined) || 'value';
                path = `${path}/${innerKey}`;
                payload = typeof raw[innerKey] === 'boolean' ? !!nextValue : typeof raw[innerKey] === 'number' ? (nextValue ? 1 : 0) : (nextValue ? 'on' : 'off');
            } else if (typeof raw === 'boolean') payload = !!nextValue;
            else if (typeof raw === 'number') payload = nextValue ? 1 : 0;
            else payload = nextValue ? 'on' : 'off';
        }
        await set(ref(database, path), payload);
    }, [villageData, config.sources]);

    // ── Configuration writers (Site & Alerts screen; always the primary database) ──
    const savePlacement = useCallback(async (entries) => { await update(ref(sensorDb, 'config/sensorPlacement'), entries); }, []);
    const savePrototypeSite = useCallback(async (siteId) => { await set(ref(sensorDb, 'config/prototypeSite'), siteId); }, []);
    const saveZoneOverrides = useCallback(async (siteId, entries) => { await update(ref(sensorDb, `config/zones/${siteId}`), entries); }, []);
    const saveUbidotsConfig = useCallback(async (cfg) => { await set(ref(sensorDb, 'config/ubidots'), { ...DEFAULT_UBIDOTS_CONFIG, ...cfg }); }, []);
    const saveSources = useCallback(async (entries) => { await update(ref(sensorDb, 'config/sources'), entries); }, []);
    const saveParkingSource = useCallback(async (sourceId) => { await set(ref(sensorDb, 'config/parkingSource'), sourceId); }, []);
    const saveAlertConfig = useCallback(async (cfg) => {
        const { shared, secret } = splitAlertConfig({ ...DEFAULT_ALERT_CONFIG, ...cfg });
        writeLocalAlertSecrets(secret);       // secrets stay on this device
        setAlertSecrets(secret);
        await set(ref(sensorDb, 'config/alerts'), shared);
    }, []);

    // ── Live sites: flagged live, or actually receiving data ─────────────────
    const liveSiteIds = useMemo(() => new Set(SITES.filter((s) => s.deployment === 'live' || villageData[s.id]?.hasData).map((s) => s.id)), [villageData]);
    const sitesWithStatus = useMemo(() => SITES.map((s) => ({ ...s, isLive: liveSiteIds.has(s.id), hasData: !!villageData[s.id]?.hasData })), [liveSiteIds, villageData]);

    // First load of a session: if the remembered site has no data but another one does, show the live one
    const autoSwitchedRef = useRef(false);
    useEffect(() => {
        if (autoSwitchedRef.current || loading || !Object.keys(villageData).length) return;
        autoSwitchedRef.current = true;
        let already = false;
        try { already = sessionStorage.getItem('gramvista.autoSwitched') === '1'; } catch { /* ignore */ }
        if (already) return;
        const current = villageData[selectedVillageId];
        if (current?.hasData) return;
        const live = SITES.find((s) => villageData[s.id]?.hasData);
        if (live && live.id !== selectedVillageId) {
            setSelectedVillageId(live.id);
            try { sessionStorage.setItem('gramvista.autoSwitched', '1'); } catch { /* ignore */ }
        }
    }, [loading, villageData, selectedVillageId, setSelectedVillageId]);

    // ── Derived state for the selected site ──────────────────────────────────
    const selectedVillage = useMemo(() => sitesWithStatus.find((s) => s.id === selectedVillageId) || sitesWithStatus.find((s) => s.id === DEFAULT_SITE_ID), [sitesWithStatus, selectedVillageId]);
    const selectedEntry = useMemo(() => villageData[selectedVillageId] || emptyEntry(selectedVillage), [villageData, selectedVillageId, selectedVillage]);
    const villageCenter = selectedEntry.center || selectedVillage.center || null;

    const zones = useMemo(() => {
        const counts = {};
        Object.values(selectedEntry.readings).forEach((r) => { if (r.zoneId && r.value !== null) counts[r.zoneId] = (counts[r.zoneId] || 0) + 1; });
        return zonesOf(selectedVillage).map((zone) => ({ ...zone, center: resolveZoneCenter(selectedVillage, zone.id, config.zoneOverrides), sensorCount: counts[zone.id] || 0 }));
    }, [selectedVillage, selectedEntry, config.zoneOverrides]);

    const markers = useMemo(() => {
        if (!selectedVillage.isLive || !villageCenter) return [];
        const perZone = {};
        SENSOR_METRICS.forEach((metric) => {
            const reading = selectedEntry.readings[metric.key];
            if (reading?.zoneId && !reading.coords && !selectedEntry.locations?.[metric.key]) (perZone[reading.zoneId] = perZone[reading.zoneId] || []).push(metric.key);
        });
        const ringRadius = selectedVillage.type === 'campus' ? 0.00013 : 0.00028;
        return SENSOR_METRICS.map((metric) => {
            const reading = selectedEntry.readings[metric.key];
            let coords = reading?.coords || selectedEntry.locations?.[metric.key] || null;
            let source = reading?.coords ? 'device' : coords ? 'configured' : null;
            if (!coords && reading?.zoneId) {
                const zone = zones.find((z) => z.id === reading.zoneId);
                if (zone?.center) {
                    const members = perZone[reading.zoneId] || [metric.key];
                    const idx = members.indexOf(metric.key);
                    if (members.length === 1) coords = zone.center;
                    else { const angle = (2 * Math.PI * idx) / members.length; coords = [zone.center[0] + ringRadius * Math.sin(angle), zone.center[1] + ringRadius * Math.cos(angle)]; }
                    source = 'zone';
                }
            }
            if (!coords) { coords = offsetCoords(villageCenter, metric.offset); source = 'default'; }
            return { ...reading, coords, coordsSource: source };
        });
    }, [selectedVillage, selectedEntry, villageCenter, zones]);

    // Every sensor path in every database, with where it currently belongs (placement table)
    const sensorPaths = useMemo(() => {
        const rootsBySource = { [PRIMARY_SOURCE_ID]: primaryRoot, ...extraRoots };
        const out = [];
        config.sources.filter((s) => s.enabled).forEach((source) => {
            const root = rootsBySource[source.id];
            if (!isObj(root)) return;
            collectMetricPaths(root, { prototypeSiteId: source.site, prefix: sourcePrefix(source), ignoreKeys: config.sourceIgnoreKeys[source.id] }).forEach((entry) => {
                const placed = config.placement[entry.key];
                const siteId = placed?.site && getSite(placed.site) ? placed.site : entry.defaultOwnerId;
                const site = getSite(siteId);
                const metric = SENSOR_METRICS.find((m) => m.key === entry.metricKey);
                const zoneId = placed?.zone || metric?.defaultZone?.[site?.type] || null;
                out.push({ ...entry, siteId, zoneId, placed: !!placed, metric, sourceId: source.id, sourceLabel: source.label });
            });
        });
        return out;
    }, [primaryRoot, extraRoots, config]);

    const effectiveAlertConfig = useMemo(() => ({ ...config.sharedAlertConfig, ...alertSecrets }), [config.sharedAlertConfig, alertSecrets]);
    const parkingSource = config.sources.find((s) => s.id === config.parkingSourceId) || config.sources.find((s) => s.primary);
    const sourceStatus = useMemo(() => config.sources.map((s) => ({
        ...s,
        connected: s.primary ? primaryRoot !== null : isObj(extraRoots[s.id]),
        lastChangeAt: lastChangeAt[s.id] || null,
        rootKeys: isObj(s.primary ? primaryRoot : extraRoots[s.id]) ? Object.keys(s.primary ? primaryRoot : extraRoots[s.id]).filter((k) => !['config', 'alerts'].includes(k)) : []
    })), [config.sources, primaryRoot, extraRoots, lastChangeAt]);
    // Most recent telemetry change across every database = "are the nodes alive?"
    const lastNodeWriteAt = useMemo(() => Object.values(lastChangeAt).reduce((max, d) => (d && (!max || d > max) ? d : max), null), [lastChangeAt]);

    const saveCalibration = useCallback(async (cfg) => { await set(ref(sensorDb, 'config/calibration/soil'), cfg); }, []);

    const value = useMemo(() => ({
        sites: sitesWithStatus,
        villages: sitesWithStatus.filter((s) => s.type === 'village'),
        liveSiteIds,
        calibration: config.calibration,
        saveCalibration,
        selectedVillage,
        selectedSite: selectedVillage,
        selectedVillageId,
        setSelectedVillageId,
        villageData,
        readings: selectedEntry.readings,
        villageUpdatedAt: selectedEntry.updatedAt,
        villagePath: selectedEntry.path,
        hasData: selectedEntry.hasData,
        villageCenter,
        zones,
        markers,
        liveSamples,
        lastSyncAt,
        lastNodeWriteAt,
        connected,
        loading,
        error,
        setMetricValue,
        sensorDbUrl: SENSOR_DB_URL,
        sources: sourceStatus,
        parkingSourceId: config.parkingSourceId,
        parkingDbUrl: parkingSource ? parkingSource.url : SENSOR_DB_URL,
        placement: config.placement,
        prototypeSiteId: config.prototypeSiteId,
        zoneOverrides: config.zoneOverrides,
        alertConfig: effectiveAlertConfig,
        ubidotsConfig: config.ubidotsConfig,
        firebaseBins: config.firebaseBins,
        sensorPaths,
        savePlacement,
        savePrototypeSite,
        saveZoneOverrides,
        saveAlertConfig,
        saveUbidotsConfig,
        saveSources,
        saveParkingSource
    }), [sitesWithStatus, liveSiteIds, saveCalibration, selectedVillage, selectedVillageId, setSelectedVillageId, villageData, selectedEntry, villageCenter, zones, markers, liveSamples, lastSyncAt, lastNodeWriteAt, connected, loading, error, setMetricValue, sourceStatus, config, effectiveAlertConfig, parkingSource, sensorPaths, savePlacement, savePrototypeSite, saveZoneOverrides, saveAlertConfig, saveUbidotsConfig, saveSources, saveParkingSource]);

    return (
        <VillageSensorsContext.Provider value={value}>
            {children}
        </VillageSensorsContext.Provider>
    );
};
