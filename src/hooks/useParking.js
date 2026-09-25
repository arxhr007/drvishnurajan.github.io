import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { sensorDb, getSensorDatabase } from '../firebase.config';
import { useVillageSensors } from './useVillageSensors';
import { formatClockIST, formatTimeIST } from '../utils/timeUtils';

// ---------------------------------------------------------------------------
// Hospital parking: ultrasonic bay sensors in the RPS Sahrdaya database.
//
// Recommended firmware layout (any of these is detected automatically):
//   parking/slots/1/distance   = 42.5        (cm; one node per bay)
//   parking/slots/2/distance   = 310.2
//   parking/emergency/distance = 305.0       (the emergency bay)
//   parking/slots/3/occupied   = true        (optional: device-decided state)
// Any numeric key whose name contains "ultrasonic", "distance" or "sonar"
// anywhere in the tree (e.g. Agriculture/ultrasonicDistance) is also picked up.
//
// Dashboard settings live at parking/config so every viewer sees the same
// slot count, threshold and sensor-to-bay mapping.
// ---------------------------------------------------------------------------

export const PARKING_CONFIG_PATH = 'parking/config';

export const DEFAULT_PARKING_CONFIG = {
    name: 'Hospital Car Park',
    totalSlots: 7,
    thresholdCm: 60,     // distance below this = vehicle present
    emergencySlot: 7,    // 1-based bay number reserved for ambulances
    sensorMap: {}        // { [bayNumber]: sensorPath }
};

const MAX_HISTORY = 180;
const MAX_VALID_CM = 998;          // 999 (and above) is the firmware's "no echo" sentinel
const OCCUPIED_WORDS = ['occupied', 'full', 'busy', 'taken', 'parked', 'on', '1', 'true', 'yes'];
const FREE_WORDS = ['free', 'empty', 'vacant', 'available', 'off', '0', 'false', 'no'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const normKey = (k) => String(k ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const toNumber = (raw) => {
    if (isNum(raw)) return raw;
    if (typeof raw === 'string') {
        const m = raw.match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : null;
    }
    return null;
};

const toBool = (raw) => {
    if (typeof raw === 'boolean') return raw;
    if (isNum(raw)) return raw > 0;
    if (typeof raw === 'string') {
        const word = raw.trim().toLowerCase();
        if (OCCUPIED_WORDS.includes(word)) return true;
        if (FREE_WORDS.includes(word)) return false;
    }
    return null;
};

const naturalCompare = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** Device-side aggregate counters, if the firmware publishes them (parking/freeSlots, parking/occupiedSlots). */
export const detectDeviceCounts = (root) => {
    const counts = { free: null, occupied: null, total: null };
    const visit = (obj, depth) => {
        if (!isPlainObject(obj) || depth > 3) return;
        for (const [key, raw] of Object.entries(obj)) {
            const nk = normKey(key);
            if (isPlainObject(raw)) { visit(raw, depth + 1); continue; }
            const n = toNumber(raw);
            if (n === null) continue;
            if (['freeslots', 'free', 'available', 'availableslots', 'vacant'].includes(nk)) counts.free = n;
            else if (['occupiedslots', 'occupied', 'used', 'usedslots'].includes(nk)) counts.occupied = n;
            else if (['totalslots', 'total', 'slots'].includes(nk)) counts.total = n;
        }
    };
    const parkingKey = isPlainObject(root) ? Object.keys(root).find((k) => normKey(k).includes('parking')) : null;
    if (parkingKey) visit(root[parkingKey], 0);
    return counts;
};

/** Find every ultrasonic / distance reading in the snapshot. */
export const detectUltrasonicSensors = (root) => {
    const sensors = [];
    const occupiedByContainer = {};

    const visit = (obj, path, depth, underParking) => {
        if (!isPlainObject(obj) || depth > 5) return;
        for (const [key, raw] of Object.entries(obj)) {
            const nk = normKey(key);
            if (nk === 'config') continue;
            const childPath = path ? `${path}/${key}` : key;
            const inParking = underParking || nk.includes('parking') || nk.includes('slot') || nk.includes('bay') || nk.includes('emergency');

            if (isPlainObject(raw)) {
                visit(raw, childPath, depth + 1, inParking);
                continue;
            }

            // Device-decided state: occupied: true/false or status: "FREE"/"OCCUPIED"
            if (inParking && (nk === 'occupied' || nk === 'status' || nk === 'state')) {
                const flag = toBool(raw);
                if (flag !== null) occupiedByContainer[path] = flag;
                continue;
            }

            const looksUltrasonic = nk.includes('ultrasonic') || nk.includes('distance') || nk.includes('sonar');
            const parkingLeaf = inParking && ['distance', 'cm', 'value', 'reading', 'range'].includes(nk);
            if (!looksUltrasonic && !parkingLeaf) continue;
            if (nk.includes('threshold')) continue;

            const distance = toNumber(raw);
            const valid = distance !== null && distance > 0 && distance <= MAX_VALID_CM;
            const segments = childPath.split('/');
            sensors.push({
                path: childPath,
                containerPath: path,
                key,
                label: segments.slice(-2).join(' / '),
                distance: valid ? Math.round(distance * 10) / 10 : null,
                raw,
                inParking,
                isEmergency: normKey(childPath).includes('emergency') || normKey(childPath).includes('ambulance')
            });
        }
    };

    visit(root, '', 0, false);
    sensors.forEach((s) => { s.occupied = occupiedByContainer[s.containerPath] ?? null; });
    // Sensors under a parking node come first (bay 1, 2, 3 … in natural order), then any other distance readings
    return sensors.sort((a, b) => (Number(b.inParking) - Number(a.inParking)) || naturalCompare(a.path, b.path));
};

const coerceConfig = (raw) => {
    const cfg = { ...DEFAULT_PARKING_CONFIG, ...(isPlainObject(raw) ? raw : {}) };
    cfg.totalSlots = Math.min(40, Math.max(1, Math.round(toNumber(cfg.totalSlots) ?? DEFAULT_PARKING_CONFIG.totalSlots)));
    cfg.thresholdCm = Math.min(500, Math.max(5, toNumber(cfg.thresholdCm) ?? DEFAULT_PARKING_CONFIG.thresholdCm));
    const em = Math.round(toNumber(cfg.emergencySlot) ?? cfg.totalSlots);
    cfg.emergencySlot = em >= 1 && em <= cfg.totalSlots ? em : cfg.totalSlots;
    cfg.sensorMap = isPlainObject(cfg.sensorMap) ? cfg.sensorMap : {};
    cfg.name = typeof cfg.name === 'string' && cfg.name.trim() ? cfg.name : DEFAULT_PARKING_CONFIG.name;
    return cfg;
};

/**
 * Learn the occupied/free distance boundary from the bays where the device
 * published a status alongside a distance. Installations differ: these nodes
 * read ~17 cm for a free bay and ~5 cm for an occupied one, so a fixed 60 cm
 * default would invert every bay if the status field ever disappeared.
 * Returns null when the readings do not separate cleanly.
 */
export const deriveThresholdCm = (sensors) => {
    const labelled = sensors.filter((s) => s.occupied !== null && s.distance !== null);
    if (labelled.length < 2) return null;
    const occupied = labelled.filter((s) => s.occupied).map((s) => s.distance);
    const free = labelled.filter((s) => !s.occupied).map((s) => s.distance);
    if (!occupied.length || !free.length) return null;
    const maxOccupied = Math.max(...occupied);
    const minFree = Math.min(...free);
    if (maxOccupied >= minFree) return null; // overlapping, cannot separate
    return Math.round(((maxOccupied + minFree) / 2) * 10) / 10;
};

/** Assign detected sensors to bays: explicit map first, then emergency, then in order. */
export const buildSlots = (config, sensors, thresholdOverride = null) => {
    const byPath = Object.fromEntries(sensors.map((s) => [s.path, s]));
    const used = new Set();
    const assigned = {};

    for (let bay = 1; bay <= config.totalSlots; bay++) {
        const mapped = config.sensorMap[bay];
        if (mapped && byPath[mapped] && !used.has(mapped)) { assigned[bay] = byPath[mapped]; used.add(mapped); }
    }
    if (!assigned[config.emergencySlot]) {
        const em = sensors.find((s) => s.isEmergency && !used.has(s.path));
        if (em) { assigned[config.emergencySlot] = em; used.add(em.path); }
    }
    const remaining = sensors.filter((s) => !used.has(s.path));
    for (let bay = 1; bay <= config.totalSlots && remaining.length; bay++) {
        if (assigned[bay]) continue;
        if (bay === config.emergencySlot && remaining.some((s) => !s.isEmergency) && remaining.length > 1) {
            // keep the emergency bay for the last unassigned sensor unless it's the only one left
            continue;
        }
        assigned[bay] = remaining.shift();
    }
    if (!assigned[config.emergencySlot] && remaining.length) assigned[config.emergencySlot] = remaining.shift();

    const threshold = thresholdOverride ?? config.thresholdCm;

    return Array.from({ length: config.totalSlots }, (_, i) => {
        const bay = i + 1;
        const sensor = assigned[bay] || null;
        const isEmergency = bay === config.emergencySlot;
        let state = 'no-sensor';
        let source = null;
        if (sensor) {
            if (sensor.occupied !== null) {
                // The node already decided; its own status always wins over our threshold
                state = sensor.occupied ? 'occupied' : 'free';
                source = 'device';
            } else if (sensor.distance === null) {
                state = 'offline';
            } else {
                state = sensor.distance < threshold ? 'occupied' : 'free';
                source = 'threshold';
            }
        }
        return { bay, isEmergency, sensor, state, source, distance: sensor?.distance ?? null };
    });
};

export const useParking = () => {
    const { parkingDbUrl, parkingSourceId } = useVillageSensors();
    const [root, setRoot] = useState(null);
    const [config, setConfig] = useState(DEFAULT_PARKING_CONFIG);
    const [configSource, setConfigSource] = useState('default');
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [history, setHistory] = useState([]);
    const lastSignatureRef = useRef('');

    useEffect(() => {
        const unsubConn = onValue(ref(sensorDb, '.info/connected'), (snap) => setConnected(snap.val() === true));
        const parkingDb = getSensorDatabase(parkingDbUrl);
        const unsubRoot = onValue(ref(parkingDb, '/'), (snap) => {
            setRoot(snap.val());
            setLoading(false);
        }, (err) => { console.error('Parking DB error:', err); setLoading(false); });
        const unsubCfg = onValue(ref(sensorDb, PARKING_CONFIG_PATH), (snap) => {
            const raw = snap.val();
            setConfig(coerceConfig(raw));
            setConfigSource(raw ? 'firebase' : 'default');
        });
        return () => { unsubConn(); unsubRoot(); unsubCfg(); };
    }, [parkingDbUrl]);

    const sensors = useMemo(() => detectUltrasonicSensors(root), [root]);
    const deviceCounts = useMemo(() => detectDeviceCounts(root), [root]);

    // Until a setup is saved, size the lot to what the nodes publish and put the emergency bay last
    const effectiveConfig = useMemo(() => {
        if (configSource === 'firebase' || sensors.length === 0) return config;
        const total = Math.max(1, sensors.length);
        return { ...config, totalSlots: total, emergencySlot: total };
    }, [config, configSource, sensors]);

    const derivedThresholdCm = useMemo(() => deriveThresholdCm(sensors), [sensors]);
    const slots = useMemo(
        () => buildSlots(effectiveConfig, sensors, derivedThresholdCm),
        [effectiveConfig, sensors, derivedThresholdCm]
    );

    const stats = useMemo(() => {
        const occupied = slots.filter((s) => s.state === 'occupied').length;
        const free = slots.filter((s) => s.state === 'free').length;
        const sensed = occupied + free;
        const emergency = slots.find((s) => s.isEmergency) || null;
        return {
            total: slots.length,
            occupied,
            free,
            fromDevice: slots.filter((s) => s.source === 'device').length,
            unknown: slots.length - sensed,
            occupancyPct: sensed ? Math.round((occupied / sensed) * 100) : 0,
            sensorsOnline: sensors.filter((s) => s.distance !== null || s.occupied !== null).length,
            sensorsDetected: sensors.length,
            emergency
        };
    }, [slots, sensors]);

    // Session timeline of occupancy (one point per change)
    useEffect(() => {
        if (loading) return;
        const signature = slots.map((s) => s.state[0]).join('');
        if (signature === lastSignatureRef.current) return;
        lastSignatureRef.current = signature;
        const now = new Date();
        setLastUpdate(formatTimeIST(now));
        setHistory((prev) => {
            const next = [...prev, { time: formatClockIST(now), occupied: stats.occupied, free: stats.free, emergency: stats.emergency?.state === 'occupied' ? 1 : 0 }];
            return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
        });
    }, [slots, stats, loading]);

    const saveConfig = useCallback(async (next) => {
        setSaving(true);
        setSaveError(null);
        try {
            const clean = coerceConfig(next);
            await set(ref(sensorDb, PARKING_CONFIG_PATH), clean);
            setConfig(clean);
        } catch (err) {
            console.error('Failed to save parking config:', err);
            setSaveError(err?.message || 'Save failed');
            throw err;
        } finally {
            setSaving(false);
        }
    }, []);

    const emergencyOccupied = stats.emergency?.state === 'occupied';

    return {
        parkingSourceId, parkingDbUrl,
        config: effectiveConfig, savedConfig: config, configSource, saveConfig, saving, saveError,
        sensors, slots, stats, deviceCounts, derivedThresholdCm, emergencyOccupied, history, connected, loading, lastUpdate
    };
};
