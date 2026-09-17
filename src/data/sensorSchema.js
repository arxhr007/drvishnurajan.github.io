// ---------------------------------------------------------------------------
// Village field-sensor schema (RPS Sahrdaya Realtime Database)
//
// Canonical layout written by the field nodes:
//
//   villages/<villageId>/agriculture/{ soil_moisture, temperature, humidity }
//   villages/<villageId>/water/{ ph, rain_intensity, water_level_dam,
//                                water_level_tank, pump, turbidity }
//   villages/<villageId>/energy/{ solar_output_wh, windmill_output_wh,
//                                 household_consumption_wh }
//   villages/<villageId>/updated_at   (epoch seconds/millis or ISO string)
//
// Optional map placement (otherwise each sensor is drawn at the village
// centre plus its default `offset`):
//
//   villages/<villageId>/center/{ lat, lng }              – village centre
//   villages/<villageId>/locations/<metricKey>/{ lat, lng } – per-sensor spot
//   (a reading may also carry lat/lng: { value: 42, lat: 10.26, lng: 76.23 })
//
// The reader is deliberately forgiving: keys are matched case-insensitively
// after stripping spaces, dashes and underscores; group nesting is optional;
// values may be plain numbers, numeric strings ("42.5%"), on/off strings or
// `{ value, timestamp }` objects. A flat root (no village wrapper) is treated
// as the default prototype village (Puthenchira).
// ---------------------------------------------------------------------------
import { DEFAULT_VILLAGE_ID, VILLAGES } from './villages.js';

export const SENSOR_GROUPS = [
    { id: 'agriculture', label: 'Agriculture', tone: 'emerald', icon: 'Sprout' },
    { id: 'water', label: 'Water Management', tone: 'cyan', icon: 'Droplets' },
    { id: 'energy', label: 'Energy Management', tone: 'amber', icon: 'Zap' }
];

export const SENSOR_METRICS = [
    // ── Agriculture ────────────────────────────────────────────────────────
    // `offset` = default map position relative to the village centre, in
    // degrees [dLat, dLng] (0.001° ≈ 110 m). Used when the node publishes no
    // coordinates of its own.
    {
        key: 'soil_moisture', group: 'agriculture', label: 'Soil Moisture', unit: '%', icon: 'Droplets',
        aliases: ['soil_moisture_value', 'soilmoisture', 'moisture', 'soil_moisture_1', 'moisture_percent', 'moisturePercent', 'soil_moisture_percent', 'moisture_value', 'soil_moisture_pct'],
        range: { min: 20, max: 80, minMsg: 'Soil is dry – irrigation advised', maxMsg: 'Soil is water-logged' },
        offset: [-0.0018, 0.0022], site: 'Paddy field – east'
    },
    {
        key: 'temperature', group: 'agriculture', label: 'Temperature', unit: '°C', icon: 'Thermometer',
        aliases: ['temp', 'air_temperature', 'field_temperature', 'temperature_value'],
        range: { max: 38, criticalMax: 45, maxMsg: 'High field temperature' },
        offset: [-0.0024, 0.0030], site: 'Weather mast – field edge'
    },
    {
        key: 'humidity', group: 'agriculture', label: 'Humidity', unit: '%', icon: 'Wind',
        aliases: ['air_humidity', 'hum', 'humidity_value', 'relative_humidity'],
        range: { min: 25, max: 90, minMsg: 'Air is very dry', maxMsg: 'Very high humidity' },
        offset: [-0.0012, 0.0036], site: 'Weather mast – field edge'
    },

    // ── Water management ───────────────────────────────────────────────────
    {
        key: 'ph', group: 'water', label: 'pH Level', unit: 'pH', icon: 'FlaskConical',
        aliases: ['ph_value', 'ph_sensor', 'ph_sensor_value', 'water_ph', 'ph_level'],
        range: { min: 6.5, max: 8.5, criticalMin: 5, criticalMax: 10, minMsg: 'Water is acidic', maxMsg: 'Water is alkaline' },
        offset: [0.0016, -0.0010], site: 'Water quality station'
    },
    {
        key: 'rain_intensity', group: 'water', label: 'Rain Intensity', unit: 'mm/h', icon: 'CloudRain',
        aliases: ['rain', 'rainfall', 'rain_value', 'rain_sensor', 'rain_intensity_value'],
        range: { max: 30, criticalMax: 60, maxMsg: 'Heavy rainfall detected' },
        offset: [0.0004, 0.0008], site: 'Rain gauge – panchayat office'
    },
    {
        key: 'water_level_dam', group: 'water', label: 'Water Level – Dam', unit: '%', icon: 'Waves',
        aliases: ['dam_level', 'dam_water_level', 'dam', 'water_level_dam_value'],
        range: { max: 85, criticalMax: 95, maxMsg: 'Dam nearing full capacity' },
        offset: [-0.0006, -0.0038], site: 'Check dam – west'
    },
    {
        key: 'water_level_tank', group: 'water', label: 'Water Level – Tank', unit: '%', icon: 'Cylinder',
        aliases: ['tank_level', 'tank_water_level', 'water_level_water_tank', 'tank', 'water_tank_level'],
        range: { min: 20, criticalMin: 10, minMsg: 'Tank level low – refill needed' },
        offset: [0.0026, -0.0002], site: 'Overhead tank – north'
    },
    {
        key: 'pump', group: 'water', label: 'Water Pump', unit: '', icon: 'Power', binary: true, controllable: true,
        aliases: ['water_pump', 'pump_status', 'pump_state', 'water_pump_on_off', 'pump_on_off', 'motor'],
        offset: [0.0020, 0.0012], site: 'Pump house'
    },
    {
        key: 'turbidity', group: 'water', label: 'Turbidity', unit: 'NTU', icon: 'Eye',
        aliases: ['turbidity_value', 'turbidity_sensor', 'water_turbidity', 'turbidity_value_of_water'],
        range: { max: 5, criticalMax: 10, maxMsg: 'Water is turbid – check filtration' },
        offset: [0.0010, -0.0020], site: 'Water quality station'
    },

    // ── Energy management ──────────────────────────────────────────────────
    {
        key: 'solar_output_wh', group: 'energy', label: 'Solar Power Output', unit: 'Wh', icon: 'Sun', flow: 'producer',
        aliases: ['solar', 'solar_output', 'solar_power', 'solar_wh', 'solar_power_output', 'solar_power_output_in_wh', 'solar_energy'],
        offset: [-0.0030, -0.0012], site: 'Solar array – south'
    },
    {
        key: 'windmill_output_wh', group: 'energy', label: 'Windmill Power Output', unit: 'Wh', icon: 'Wind', flow: 'producer',
        aliases: ['wind', 'windmill', 'wind_output', 'windmill_output', 'wind_power', 'windmill_power', 'windmill_power_output', 'windmill_power_output_in_wh', 'wind_energy'],
        offset: [0.0008, 0.0042], site: 'Windmill – ridge east'
    },
    {
        key: 'household_consumption_wh', group: 'energy', label: 'Household Consumption', unit: 'Wh', icon: 'House', flow: 'consumer',
        aliases: ['household', 'consumption', 'household_consumption', 'household_conception', 'household_conception_wh', 'household_consumption_wh', 'load', 'household_load', 'house_consumption'],
        offset: [-0.0004, 0.0014], site: 'Model household'
    }
];

export const METRIC_BY_KEY = Object.fromEntries(SENSOR_METRICS.map((metric) => [metric.key, metric]));

export const metricsForGroup = (groupId) => SENSOR_METRICS.filter((metric) => metric.group === groupId);

// ── Key normalisation ────────────────────────────────────────────────────────
export const normKey = (key) => String(key ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const METRIC_LOOKUP = new Map();
SENSOR_METRICS.forEach((metric) => {
    [metric.key, ...(metric.aliases || [])].forEach((alias) => {
        const nk = normKey(alias);
        if (!METRIC_LOOKUP.has(nk)) METRIC_LOOKUP.set(nk, metric.key);
    });
});

const TIMESTAMP_KEYS = new Set(['timestamp', 'updatedat', 'lastupdated', 'lastupdate', 'time', 'ts', 'datetime', 'lastseen']);
const LOCATION_MAP_KEYS = new Set(['locations', 'sensorlocations', 'positions', 'coords', 'geo']);
const CENTER_KEYS = new Set(['center', 'centre', 'location', 'position', 'gps']);
const VILLAGE_CONTAINERS = ['villages', 'village', 'sites', 'data'];

/** Accepts [lat, lng], { lat, lng }, { latitude, longitude } or "lat,lng". */
export const parseLatLng = (raw) => {
    if (raw === null || raw === undefined) return null;
    let lat; let lng;
    if (Array.isArray(raw) && raw.length >= 2) {
        [lat, lng] = raw;
    } else if (typeof raw === 'string') {
        const parts = raw.split(/[,\s]+/).filter(Boolean);
        if (parts.length < 2) return null;
        [lat, lng] = parts;
    } else if (typeof raw === 'object') {
        lat = raw.lat ?? raw.latitude ?? raw.Lat ?? raw.Latitude;
        lng = raw.lng ?? raw.lon ?? raw.long ?? raw.longitude ?? raw.Lng ?? raw.Longitude;
    } else {
        return null;
    }
    lat = Number(lat); lng = Number(lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return [lat, lng];
};

/** Default map position of a metric: village centre + metric offset. */
export const offsetCoords = (center, offset) => {
    if (!center) return null;
    return [center[0] + (offset?.[0] || 0), center[1] + (offset?.[1] || 0)];
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const findKeyCI = (obj, wanted) => {
    if (!isPlainObject(obj)) return undefined;
    const target = normKey(wanted);
    return Object.keys(obj).find((key) => normKey(key) === target);
};

// ── Value parsing ────────────────────────────────────────────────────────────
const TRUE_WORDS = ['on', '1', 'true', 'active', 'running', 'high', 'yes', 'open'];
const FALSE_WORDS = ['off', '0', 'false', 'inactive', 'stopped', 'low', 'no', 'closed', 'idle'];

export const parseSensorValue = (metric, raw) => {
    let value = raw;
    if (isPlainObject(value)) value = value.value ?? value.val ?? value.reading ?? value.state ?? null;
    if (value === null || value === undefined || value === '') return null;

    if (metric.binary) {
        if (typeof value === 'boolean') return value ? 1 : 0;
        if (typeof value === 'number') return value > 0 ? 1 : 0;
        const word = String(value).trim().toLowerCase();
        if (TRUE_WORDS.includes(word)) return 1;
        if (FALSE_WORDS.includes(word)) return 0;
        const n = parseFloat(word);
        return Number.isFinite(n) ? (n > 0 ? 1 : 0) : null;
    }

    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    const match = String(value).match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
};

export const parseTimestamp = (raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number') {
        // Values below ~2001-09-09 (1e9 s) are device uptime counters, not epoch time
        if (!Number.isFinite(raw) || raw < 1e9) return null;
        const millis = raw < 1e12 ? raw * 1000 : raw; // epoch seconds vs millis
        const date = new Date(millis);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const text = String(raw).trim();
    if (/^\d+(\.\d+)?$/.test(text)) return parseTimestamp(Number(text));
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
};

// ── Status evaluation ────────────────────────────────────────────────────────
export const evaluateMetric = (metric, value) => {
    if (value === null || value === undefined) {
        return { status: 'offline', message: 'Waiting for the field node to publish a reading' };
    }
    if (metric.binary) {
        return { status: 'normal', message: value ? `${metric.label} is running` : `${metric.label} is stopped` };
    }
    const range = metric.range;
    if (!range) return { status: 'normal', message: 'Informational reading' };

    const label = metric.label;
    if (range.criticalMax !== undefined && value > range.criticalMax) {
        return { status: 'critical', message: range.maxMsg || `${label} critically high (${value} > ${range.criticalMax})` };
    }
    if (range.criticalMin !== undefined && value < range.criticalMin) {
        return { status: 'critical', message: range.minMsg || `${label} critically low (${value} < ${range.criticalMin})` };
    }
    if (range.max !== undefined && value > range.max) {
        return { status: 'warning', message: range.maxMsg || `${label} above ${range.max}` };
    }
    if (range.min !== undefined && value < range.min) {
        return { status: 'warning', message: range.minMsg || `${label} below ${range.min}` };
    }
    return { status: 'normal', message: 'Within expected range' };
};

export const describeRange = (metric) => {
    const range = metric.range;
    if (!range) return metric.binary ? 'ON / OFF' : 'No threshold';
    const lo = range.min !== undefined ? range.min : null;
    const hi = range.max !== undefined ? range.max : null;
    if (lo !== null && hi !== null) return `${lo} – ${hi} ${metric.unit}`.trim();
    if (lo !== null) return `≥ ${lo} ${metric.unit}`.trim();
    if (hi !== null) return `≤ ${hi} ${metric.unit}`.trim();
    return 'No threshold';
};

// ── Node resolution & normalisation ──────────────────────────────────────────

/**
 * Locate the sub-tree holding a village's readings inside the root snapshot.
 * Returns `{ node, path }` or null when the village has no data.
 */
export const resolveVillageNode = (root, village) => {
    if (!isPlainObject(root)) return null;

    for (const container of VILLAGE_CONTAINERS) {
        const containerKey = findKeyCI(root, container);
        if (!containerKey || !isPlainObject(root[containerKey])) continue;
        const villageKey = findKeyCI(root[containerKey], village.id) || findKeyCI(root[containerKey], village.name);
        if (villageKey) return { node: root[containerKey][villageKey], path: `${containerKey}/${villageKey}` };
        return null; // a village container exists but this village is not in it
    }

    const villageKey = findKeyCI(root, village.id) || findKeyCI(root, village.name);
    if (villageKey && isPlainObject(root[villageKey])) return { node: root[villageKey], path: villageKey };

    // Flat root (no village wrapper) belongs to the prototype site.
    if (village.id === DEFAULT_VILLAGE_ID) return { node: root, path: '' };
    return null;
};

const VILLAGE_NAME_KEYS = new Set(VILLAGES.flatMap((v) => [normKey(v.id), normKey(v.name)]));
const CONTAINER_KEYS = new Set(VILLAGE_CONTAINERS.map(normKey));

/**
 * All places a village's readings may live, in priority order:
 *   1. villages/<id>   (or any other container)
 *   2. <id> at the root
 *   3. for the prototype village: flat keys at the root (skipping containers
 *      and other villages), which is how the ESP32 firmware currently writes.
 * Sources are merged, first match wins per metric.
 */
export const resolveVillageSources = (root, village) => {
    if (!isPlainObject(root)) return [];
    const sources = [];

    for (const container of VILLAGE_CONTAINERS) {
        const containerKey = findKeyCI(root, container);
        if (!containerKey || !isPlainObject(root[containerKey])) continue;
        const villageKey = findKeyCI(root[containerKey], village.id) || findKeyCI(root[containerKey], village.name);
        if (villageKey && isPlainObject(root[containerKey][villageKey])) {
            sources.push({ node: root[containerKey][villageKey], path: `${containerKey}/${villageKey}` });
        }
    }

    const villageKey = findKeyCI(root, village.id) || findKeyCI(root, village.name);
    if (villageKey && isPlainObject(root[villageKey])) sources.push({ node: root[villageKey], path: villageKey });

    if (village.id === DEFAULT_VILLAGE_ID) {
        sources.push({ node: root, path: '', skip: new Set([...CONTAINER_KEYS, ...VILLAGE_NAME_KEYS]) });
    }
    return sources;
};

/**
 * Flatten a village node into
 * `{ readings: { [metricKey]: { value, raw, path, timestamp?, coords? } }, updatedAt, found, locations, center }`.
 * `skip` = normalised top-level keys to ignore (used for the flat root source).
 */
export const normalizeVillageNode = (node, basePath = '', skip = null) => {
    const readings = {};
    const locations = {};
    let updatedAt = null;
    let center = null;

    const visit = (obj, path, depth) => {
        if (!isPlainObject(obj)) return;
        for (const [key, raw] of Object.entries(obj)) {
            const nk = normKey(key);
            if (depth === 0 && skip && skip.has(nk)) continue;
            const childPath = path ? `${path}/${key}` : key;
            const metricKey = METRIC_LOOKUP.get(nk);

            if (metricKey) {
                if (readings[metricKey] === undefined) { // first match wins
                    const metric = METRIC_BY_KEY[metricKey];
                    const entry = { value: parseSensorValue(metric, raw), raw, path: childPath };
                    if (isPlainObject(raw)) {
                        const ts = parseTimestamp(raw.timestamp ?? raw.updated_at ?? raw.updatedAt ?? raw.time ?? raw.ts);
                        if (ts) entry.timestamp = ts;
                        const coords = parseLatLng(raw.coords ?? raw.location ?? raw.position ?? raw);
                        if (coords) entry.coords = coords;
                    }
                    readings[metricKey] = entry;
                }
                continue;
            }

            if (TIMESTAMP_KEYS.has(nk)) {
                const ts = parseTimestamp(raw);
                if (ts && (!updatedAt || ts > updatedAt)) updatedAt = ts;
                continue;
            }

            if (LOCATION_MAP_KEYS.has(nk) && isPlainObject(raw)) {
                // Map of metric key -> lat/lng
                for (const [locKey, locRaw] of Object.entries(raw)) {
                    const locMetric = METRIC_LOOKUP.get(normKey(locKey));
                    const coords = parseLatLng(locRaw);
                    if (locMetric && coords && !locations[locMetric]) locations[locMetric] = coords;
                }
                continue;
            }

            if (CENTER_KEYS.has(nk)) {
                const coords = parseLatLng(raw);
                if (coords && !center) center = coords;
                continue;
            }

            if (isPlainObject(raw) && depth < 3) visit(raw, childPath, depth + 1);
        }
    };

    visit(node, basePath, 0);
    return { readings, updatedAt, found: Object.keys(readings).length, locations, center };
};

/** Normalise and merge several sources (see resolveVillageSources); earlier sources win. */
export const normalizeVillageSources = (sources) => {
    const merged = { readings: {}, updatedAt: null, found: 0, locations: {}, center: null, path: null, paths: [] };
    sources.forEach((source) => {
        const part = normalizeVillageNode(source.node, source.path, source.skip || null);
        let used = false;
        Object.entries(part.readings).forEach(([key, entry]) => {
            if (merged.readings[key] === undefined) { merged.readings[key] = entry; used = true; }
        });
        Object.entries(part.locations).forEach(([key, coords]) => {
            if (!merged.locations[key]) merged.locations[key] = coords;
        });
        if (!merged.center && part.center) merged.center = part.center;
        if (part.updatedAt && (!merged.updatedAt || part.updatedAt > merged.updatedAt)) merged.updatedAt = part.updatedAt;
        if (used) merged.paths.push(source.path === '' ? '/' : `/${source.path}`);
    });
    merged.found = Object.keys(merged.readings).length;
    merged.path = merged.paths.length ? merged.paths.join(' + ') : null;
    return merged;
};

/** Path used when the dashboard has to write a value the node has not published yet. */
export const defaultMetricPath = (villageId, metric) => `villages/${villageId}/${metric.group}/${metric.key}`;
