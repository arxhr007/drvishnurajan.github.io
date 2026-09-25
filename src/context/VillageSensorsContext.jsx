import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { sensorDb, getSensorDatabase, SENSOR_DB_URL } from '../firebase.config';
import { SITES, VILLAGES, DEFAULT_SITE_ID, getSite, zonesOf, resolveZoneCenter } from '../data/villages';
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
    return {
        placement: isObj(cfg.sensorPlacement) ? cfg.sensorPlacement : {},
        prototypeSiteId,
        zoneOverrides: isObj(cfg.zones) ? cfg.zones : {},
        sharedAlertConfig: { ...DEFAULT_ALERT_CONFIG, ...sharedAlerts },
        ubidotsConfig: { ...DEFAULT_UBIDOTS_CONFIG, ...(isObj(cfg.ubidots) ? cfg.ubidots : {}) },
        firebaseBins: isObj(root) && isObj(root.waste) && isObj(root.waste.bins) ? root.waste.bins : {},
        sources,
        sourceIgnoreKeys: Object.fromEntries(sources.map((s) => [s.id, Array.isArray(cfg.sources?.[s.id]?.ignoreKeys) ? cfg.sources[s.id].ignoreKeys : []])),
        parkingSourceId
    };
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

            SENSOR_METRICS.forEach((metric) => {
                const hit = normalized.readings[metric.key];
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
                    lastUpdated: lastChanged ? formatTimeIST(lastChanged) : null,
                    lastUpdatedAt: lastChanged,
                    coords: hit?.coords ?? null,
                    ...zoneForReading(site, metric, hit, config.placement),
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
        const { sourceId, path: rawPath } = parseSourcePath(reading?.path || defaultMetricPath(siteId, metric));
        const source = config.sources.find((s) => s.id === sourceId);
        const database = source ? getSensorDatabase(source.url) : sensorDb;
        let path = rawPath;
        let payload = nextValue;
        if (metric.binary) {
            const raw = reading?.raw;
            if (isObj(raw)) {
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

    // ── Derived state for the selected site ──────────────────────────────────
    const selectedVillage = useMemo(() => getSite(selectedVillageId) || getSite(DEFAULT_SITE_ID), [selectedVillageId]);
    const selectedEntry = useMemo(() => villageData[selectedVillageId] || emptyEntry(selectedVillage), [villageData, selectedVillageId, selectedVillage]);
    const villageCenter = selectedEntry.center || selectedVillage.center || null;

    const zones = useMemo(() => {
        const counts = {};
        Object.values(selectedEntry.readings).forEach((r) => { if (r.zoneId && r.value !== null) counts[r.zoneId] = (counts[r.zoneId] || 0) + 1; });
        return zonesOf(selectedVillage).map((zone) => ({ ...zone, center: resolveZoneCenter(selectedVillage, zone.id, config.zoneOverrides), sensorCount: counts[zone.id] || 0 }));
    }, [selectedVillage, selectedEntry, config.zoneOverrides]);

    const markers = useMemo(() => {
        if (selectedVillage.deployment !== 'live' || !villageCenter) return [];
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
        rootKeys: isObj(s.primary ? primaryRoot : extraRoots[s.id]) ? Object.keys(s.primary ? primaryRoot : extraRoots[s.id]).filter((k) => !['config', 'alerts'].includes(k)) : []
    })), [config.sources, primaryRoot, extraRoots]);

    const value = useMemo(() => ({
        sites: SITES,
        villages: VILLAGES,
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
    }), [selectedVillage, selectedVillageId, setSelectedVillageId, villageData, selectedEntry, villageCenter, zones, markers, liveSamples, lastSyncAt, connected, loading, error, setMetricValue, sourceStatus, config, effectiveAlertConfig, parkingSource, sensorPaths, savePlacement, savePrototypeSite, saveZoneOverrides, saveAlertConfig, saveUbidotsConfig, saveSources, saveParkingSource]);

    return (
        <VillageSensorsContext.Provider value={value}>
            {children}
        </VillageSensorsContext.Provider>
    );
};
