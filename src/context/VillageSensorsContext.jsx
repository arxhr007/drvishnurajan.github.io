import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { sensorDb, SENSOR_DB_URL } from '../firebase.config';
import { VILLAGES, DEFAULT_VILLAGE_ID, getVillage } from '../data/villages';
import {
    SENSOR_METRICS,
    evaluateMetric,
    normalizeVillageSources,
    resolveVillageSources,
    defaultMetricPath,
    offsetCoords
} from '../data/sensorSchema';
import { formatTimeIST, formatClockIST } from '../utils/timeUtils';

export const VillageSensorsContext = createContext(null);

const MAX_HISTORY_POINTS = 60;      // rolling window per metric (session only)
const STORAGE_KEY = 'gramvista.selectedVillage';

const readStoredVillage = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return VILLAGES.some((village) => village.id === stored) ? stored : DEFAULT_VILLAGE_ID;
    } catch {
        return DEFAULT_VILLAGE_ID;
    }
};

const emptyVillageEntry = () => ({
    readings: Object.fromEntries(SENSOR_METRICS.map((metric) => [metric.key, {
        ...metric,
        value: null,
        raw: null,
        path: null,
        ...evaluateMetric(metric, null),
        lastUpdated: null,
        lastUpdatedAt: null,
        coords: null,
        history: []
    }])),
    updatedAt: null,
    path: null,
    hasData: false,
    locations: {},
    center: null
});

export const VillageSensorsProvider = ({ children }) => {
    const [selectedVillageId, setSelectedVillageIdState] = useState(readStoredVillage);
    const [villageData, setVillageData] = useState({});
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastSyncAt, setLastSyncAt] = useState(null); // time the last snapshot arrived from Firebase

    const historyRef = useRef({});   // `${villageId}:${metricKey}` -> [{ time, value }]
    const lastRef = useRef({});      // `${villageId}:${metricKey}` -> { value, time }
    const liveSamplesRef = useRef({}); // villageId -> [{ ts, source: 'live', <metricKey>: value }]
    const [liveSamples, setLiveSamples] = useState({});
    const MAX_LIVE_SAMPLES = 2000;
    const SAMPLE_MERGE_MS = 60 * 1000;

    const setSelectedVillageId = useCallback((id) => {
        if (!VILLAGES.some((village) => village.id === id)) return;
        setSelectedVillageIdState(id);
        try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage unavailable */ }
    }, []);

    // Connection state of the sensor database socket
    useEffect(() => {
        const unsubscribe = onValue(ref(sensorDb, '.info/connected'), (snap) => {
            setConnected(snap.val() === true);
        });
        return () => unsubscribe();
    }, []);

    // Live telemetry. The prototype DB is small, so one root listener is enough
    // and lets the reader accept whichever layout the field nodes use.
    useEffect(() => {
        const rootRef = ref(sensorDb, '/');

        const unsubscribe = onValue(rootRef, (snapshot) => {
            const root = snapshot.val();
            const now = new Date();
            const next = {};
            let liveChanged = false;

            VILLAGES.forEach((village) => {
                const sources = resolveVillageSources(root, village);
                const normalized = sources.length
                    ? normalizeVillageSources(sources)
                    : { readings: {}, updatedAt: null, found: 0, locations: {}, center: null, path: null };

                const readings = {};
                const liveValues = {};
                let villageChanged = false;
                SENSOR_METRICS.forEach((metric) => {
                    const hit = normalized.readings[metric.key];
                    const value = hit ? hit.value : null;
                    const historyKey = `${village.id}:${metric.key}`;
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
                        history: historyRef.current[historyKey] || []
                    };
                });

                next[village.id] = {
                    readings,
                    updatedAt: normalized.updatedAt || null,
                    path: normalized.found > 0 ? normalized.path : null,
                    hasData: normalized.found > 0,
                    locations: normalized.locations || {},
                    center: normalized.center || null
                };

                // Append a live sample for the trend/ML series (merged within 60 s)
                if (villageChanged) {
                    const list = liveSamplesRef.current[village.id] || [];
                    const tail = list[list.length - 1];
                    const nowMs = now.getTime();
                    if (tail && nowMs - tail.ts < SAMPLE_MERGE_MS) {
                        Object.assign(tail, liveValues, { ts: nowMs });
                    } else {
                        list.push({ ts: nowMs, source: 'live', ...liveValues });
                    }
                    liveSamplesRef.current[village.id] = list.length > MAX_LIVE_SAMPLES ? list.slice(-MAX_LIVE_SAMPLES) : list;
                    liveChanged = true;
                }
            });

            if (liveChanged) {
                setLiveSamples(Object.fromEntries(
                    Object.entries(liveSamplesRef.current).map(([id, list]) => [id, list.map((s) => ({ ...s }))])
                ));
            }

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

    /**
     * Write a value back to the field node (e.g. pump ON/OFF). The payload keeps
     * the type the device last published so firmware parsing stays unchanged.
     */
    const setMetricValue = useCallback(async (villageId, metricKey, nextValue) => {
        const metric = SENSOR_METRICS.find((entry) => entry.key === metricKey);
        if (!metric) throw new Error(`Unknown metric: ${metricKey}`);

        const reading = villageData[villageId]?.readings?.[metricKey];
        let path = reading?.path || defaultMetricPath(villageId, metric);
        let payload = nextValue;

        if (metric.binary) {
            const raw = reading?.raw;
            if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
                const innerKey = ['value', 'val', 'reading', 'state'].find((key) => raw[key] !== undefined) || 'value';
                path = `${path}/${innerKey}`;
                payload = typeof raw[innerKey] === 'boolean' ? !!nextValue
                    : typeof raw[innerKey] === 'number' ? (nextValue ? 1 : 0)
                        : (nextValue ? 'on' : 'off');
            } else if (typeof raw === 'boolean') {
                payload = !!nextValue;
            } else if (typeof raw === 'number') {
                payload = nextValue ? 1 : 0;
            } else {
                payload = nextValue ? 'on' : 'off';
            }
        }

        await set(ref(sensorDb, path), payload);
    }, [villageData]);

    const selectedVillage = useMemo(
        () => getVillage(selectedVillageId) || getVillage(DEFAULT_VILLAGE_ID),
        [selectedVillageId]
    );

    const selectedEntry = useMemo(
        () => villageData[selectedVillageId] || emptyVillageEntry(),
        [villageData, selectedVillageId]
    );

    // Map centre: device/admin override from the DB wins over the static default.
    const villageCenter = selectedEntry.center || selectedVillage.center || null;

    // Map markers for the selected village: published coords > locations map > centre + default offset.
    const markers = useMemo(() => {
        if (selectedVillage.deployment !== 'live' || !villageCenter) return [];
        return SENSOR_METRICS.map((metric) => {
            const reading = selectedEntry.readings[metric.key];
            const coords = reading?.coords
                || selectedEntry.locations?.[metric.key]
                || offsetCoords(villageCenter, metric.offset);
            const source = reading?.coords ? 'device' : selectedEntry.locations?.[metric.key] ? 'configured' : 'default';
            return { ...reading, coords, coordsSource: source };
        });
    }, [selectedVillage, selectedEntry, villageCenter]);

    const value = useMemo(() => ({
        villages: VILLAGES,
        selectedVillage,
        selectedVillageId,
        setSelectedVillageId,
        villageData,
        readings: selectedEntry.readings,
        villageUpdatedAt: selectedEntry.updatedAt,
        villagePath: selectedEntry.path,
        hasData: selectedEntry.hasData,
        villageCenter,
        markers,
        liveSamples,
        lastSyncAt,
        connected,
        loading,
        error,
        setMetricValue,
        sensorDbUrl: SENSOR_DB_URL
    }), [selectedVillage, selectedVillageId, setSelectedVillageId, villageData, selectedEntry, villageCenter, markers, liveSamples, lastSyncAt, connected, loading, error, setMetricValue]);

    return (
        <VillageSensorsContext.Provider value={value}>
            {children}
        </VillageSensorsContext.Provider>
    );
};
