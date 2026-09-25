import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { sensorDb, SENSOR_DB_URL } from '../firebase.config';
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

/** Dashboard settings kept in the sensor database under config/. */
const readConfig = (root) => {
    const cfg = isObj(root) && isObj(root.config) ? root.config : {};
    const prototypeSiteId = SITES.some((s) => s.id === cfg.prototypeSite) ? cfg.prototypeSite : DEFAULT_SITE_ID;
    // apiKey/webhookUrl are never trusted from Firebase (public, no-auth database) even if an
    // older write left them there; only the shared, non-secret alert fields are read back.
    const rawAlerts = isObj(cfg.alerts) ? cfg.alerts : {};
    const { apiKey: _ignoredKey, webhookUrl: _ignoredWebhook, ...sharedAlerts } = rawAlerts;
    return {
        placement: isObj(cfg.sensorPlacement) ? cfg.sensorPlacement : {},
        prototypeSiteId,
        zoneOverrides: isObj(cfg.zones) ? cfg.zones : {},
        sharedAlertConfig: { ...DEFAULT_ALERT_CONFIG, ...sharedAlerts },
        ubidotsConfig: { ...DEFAULT_UBIDOTS_CONFIG, ...(isObj(cfg.ubidots) ? cfg.ubidots : {}) },
        firebaseBins: isObj(root) && isObj(root.waste) && isObj(root.waste.bins) ? root.waste.bins : {}
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
        ...metric,
        value: null,
        raw: null,
        path: null,
        ...evaluateMetric(metric, null),
        lastUpdated: null,
        lastUpdatedAt: null,
        coords: null,
        ...zoneForReading(site, metric, null, {}),
        history: []
    }])),
    updatedAt: null,
    path: null,
    hasData: false,
    locations: {},
    center: null
});

export const VillageSensorsProvider = ({ children }) => {
    const [selectedVillageId, setSelectedVillageIdState] = useState(readStoredSite);
    const [root, setRoot] = useState(null);
    const [villageData, setVillageData] = useState({});
    const [config, setConfig] = useState(() => readConfig(null));
    const [alertSecrets, setAlertSecrets] = useState(readLocalAlertSecrets); // this browser only, never sent to Firebase
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

    // One root listener: telemetry for every site plus the config/ node
    useEffect(() => {
        const unsubscribe = onValue(ref(sensorDb, '/'), (snapshot) => {
            const data = snapshot.val();
            const cfg = readConfig(data);
            const now = new Date();
            const next = {};
            let liveChanged = false;

            SITES.forEach((site) => {
                const sources = resolveVillageSources(data, site, { placement: cfg.placement, prototypeSiteId: cfg.prototypeSiteId });
                const normalized = sources.length
                    ? normalizeVillageSources(sources)
                    : { readings: {}, updatedAt: null, found: 0, locations: {}, center: null, path: null };

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
                        historyRef.current[historyKey] = nextHistory.length > MAX_HISTORY_POINTS
                            ? nextHistory.slice(nextHistory.length - MAX_HISTORY_POINTS)
                            : nextHistory;
                    }

                    readings[metric.key] = {
                        ...metric,
                        value,
                        raw: hit?.raw ?? null,
                        path: hit?.path ?? null,
                        ...evaluateMetric(metric, value),
                        lastUpdated: lastChanged ? formatTimeIST(lastChanged) : null,
                        lastUpdatedAt: lastChanged,
                        coords: hit?.coords ?? null,
                        ...zoneForReading(site, metric, hit, cfg.placement),
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

            setRoot(data);
            setConfig(cfg);
            setVillageData(next);
            setLastSyncAt(now);
            setError(null);
            setLoading(false);
        }, (err) => {
            console.error('Sensor database error:', err);
            setError(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    /** Write a value back to the field node (e.g. pump ON/OFF), keeping the type the device published. */
    const setMetricValue = useCallback(async (siteId, metricKey, nextValue) => {
        const metric = SENSOR_METRICS.find((entry) => entry.key === metricKey);
        if (!metric) throw new Error(`Unknown metric: ${metricKey}`);
        const reading = villageData[siteId]?.readings?.[metricKey];
        let path = reading?.path || defaultMetricPath(siteId, metric);
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
        await set(ref(sensorDb, path), payload);
    }, [villageData]);

    // ── Configuration writers (Site & Alerts screen) ──────────────────────────
    const savePlacement = useCallback(async (entries) => {
        await update(ref(sensorDb, 'config/sensorPlacement'), entries);
    }, []);
    const savePrototypeSite = useCallback(async (siteId) => {
        await set(ref(sensorDb, 'config/prototypeSite'), siteId);
    }, []);
    const saveZoneOverrides = useCallback(async (siteId, entries) => {
        await update(ref(sensorDb, `config/zones/${siteId}`), entries);
    }, []);
    const saveUbidotsConfig = useCallback(async (cfg) => {
        await set(ref(sensorDb, 'config/ubidots'), { ...DEFAULT_UBIDOTS_CONFIG, ...cfg });
    }, []);

    const saveAlertConfig = useCallback(async (cfg) => {
        const { shared, secret } = splitAlertConfig({ ...DEFAULT_ALERT_CONFIG, ...cfg });
        // Secrets stay on this device; only the shared settings go to the public database.
        writeLocalAlertSecrets(secret);
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
        return zonesOf(selectedVillage).map((zone) => ({
            ...zone,
            center: resolveZoneCenter(selectedVillage, zone.id, config.zoneOverrides),
            sensorCount: counts[zone.id] || 0
        }));
    }, [selectedVillage, selectedEntry, config.zoneOverrides]);

    // Markers: published coords > locations map > zone centre (spread in a small ring) > site centre + offset
    const markers = useMemo(() => {
        if (selectedVillage.deployment !== 'live' || !villageCenter) return [];
        const perZone = {};
        SENSOR_METRICS.forEach((metric) => {
            const reading = selectedEntry.readings[metric.key];
            if (reading?.zoneId && !reading.coords && !selectedEntry.locations?.[metric.key]) {
                perZone[reading.zoneId] = perZone[reading.zoneId] || [];
                perZone[reading.zoneId].push(metric.key);
            }
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
                    else {
                        const angle = (2 * Math.PI * idx) / members.length;
                        coords = [zone.center[0] + ringRadius * Math.sin(angle), zone.center[1] + ringRadius * Math.cos(angle)];
                    }
                    source = 'zone';
                }
            }
            if (!coords) { coords = offsetCoords(villageCenter, metric.offset); source = 'default'; }
            return { ...reading, coords, coordsSource: source };
        });
    }, [selectedVillage, selectedEntry, villageCenter, zones]);

    // Every sensor path in the database, with where it currently belongs (for the placement table)
    const sensorPaths = useMemo(() => collectMetricPaths(root, { prototypeSiteId: config.prototypeSiteId }).map((entry) => {
        const placed = config.placement[entry.key];
        const siteId = placed?.site && getSite(placed.site) ? placed.site : entry.defaultOwnerId;
        const site = getSite(siteId);
        const metric = SENSOR_METRICS.find((m) => m.key === entry.metricKey);
        const zoneId = placed?.zone || metric?.defaultZone?.[site?.type] || null;
        return { ...entry, siteId, zoneId, placed: !!placed, metric };
    }), [root, config]);

    // Shared (public) settings + this device's own secret channel key/webhook, merged client-side.
    const effectiveAlertConfig = useMemo(
        () => ({ ...config.sharedAlertConfig, ...alertSecrets }),
        [config.sharedAlertConfig, alertSecrets]
    );

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
        placement: config.placement,
        prototypeSiteId: config.prototypeSiteId,
        zoneOverrides: config.zoneOverrides,
        alertConfig: effectiveAlertConfig,
        ubidotsConfig: config.ubidotsConfig,
        firebaseBins: config.firebaseBins,
        saveUbidotsConfig,
        sensorPaths,
        savePlacement,
        savePrototypeSite,
        saveZoneOverrides,
        saveAlertConfig
    }), [selectedVillage, selectedVillageId, setSelectedVillageId, villageData, selectedEntry, villageCenter, zones, markers, liveSamples, lastSyncAt, connected, loading, error, setMetricValue, config, effectiveAlertConfig, sensorPaths, savePlacement, savePrototypeSite, saveZoneOverrides, saveAlertConfig, saveUbidotsConfig]);

    return (
        <VillageSensorsContext.Provider value={value}>
            {children}
        </VillageSensorsContext.Provider>
    );
};
