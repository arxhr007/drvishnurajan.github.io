// ---------------------------------------------------------------------------
// Field-sensor schema (RPS Sahrdaya Realtime Database)
//
// Canonical layout written by the field nodes:
//
//   villages/<siteId>/agriculture/{ soil_moisture, temperature, humidity }
//   villages/<siteId>/water/{ ph, rain_intensity, rain_detected, water_level_dam,
//                             water_level_tank, pump, turbidity }
//   villages/<siteId>/energy/{ solar_output_wh, windmill_output_wh,
//                              household_consumption_wh }
//   villages/<siteId>/power/{ solar_voltage, solar_current, solar_power, total_power, ... }
//   villages/<siteId>/updated_at   (epoch seconds/millis or ISO string)
//
// Optional map placement (otherwise a sensor is drawn in its default zone):
//
//   config/sensorPlacement/<path with / replaced by ~> = { site, zone }
//   config/prototypeSite = "<siteId>"   – owner of unplaced flat-root readings
//   config/zones/<siteId>/<zoneId>     = { lat, lng } – move a block/area
//   villages/<siteId>/center/{ lat, lng }, villages/<siteId>/locations/<metricKey>/{ lat, lng }
//
// The reader is deliberately forgiving: keys are matched case-insensitively
// after stripping spaces, dashes and underscores; group nesting is optional;
// values may be plain numbers, numeric strings ("42.5%"), on/off strings or
// `{ value, timestamp }` objects. Flat keys at the root (how the prototype
// firmware writes today) belong to the prototype site unless placed elsewhere.
// ---------------------------------------------------------------------------
import { DEFAULT_SITE_ID, SITES } from './villages.js';

// Analog pH board calibration (pH = PH_SLOPE × volts + PH_OFFSET). Adjust after a 2-point buffer test.
export const PH_SLOPE = 3.5;
export const PH_OFFSET = 0;

export const SENSOR_GROUPS = [
    { id: 'agriculture', label: 'Agriculture', tone: 'emerald', icon: 'Sprout' },
    { id: 'water', label: 'Water Management', tone: 'cyan', icon: 'Droplets' },
    { id: 'energy', label: 'Energy Management', tone: 'amber', icon: 'Zap' },
    { id: 'power', label: 'Node Power', tone: 'violet', icon: 'Plug' }
];

// `offset` = default map position relative to the site centre (used only when
// the site has no matching zone). `defaultZone` = block/area the sensor is
// drawn in until an admin places it (config/sensorPlacement).
export const SENSOR_METRICS = [
    // ── Agriculture ────────────────────────────────────────────────────────
    {
        key: 'soil_moisture', group: 'agriculture', label: 'Soil Moisture', unit: '%', icon: 'Droplets',
        aliases: ['soil_moisture_value', 'soilmoisture', 'moisture', 'soil_moisture_1', 'moisture_percent', 'moisturePercent', 'soil_moisture_percent', 'moisture_value', 'soil_moisture_pct'],
        range: { min: 20, max: 80, minMsg: 'Soil is dry – irrigation advised', maxMsg: 'Soil is water-logged' },
        offset: [-0.0018, 0.0022], defaultZone: { village: 'paddy_field', campus: 'bio_block' }
    },
    {
        key: 'temperature', group: 'agriculture', label: 'Temperature', unit: '°C', icon: 'Thermometer',
        aliases: ['temp', 'air_temperature', 'field_temperature', 'temperature_value'],
        range: { max: 38, criticalMax: 45, maxMsg: 'High field temperature' },
        offset: [-0.0024, 0.0030], defaultZone: { village: 'weather_mast', campus: 'bio_block' }
    },
    {
        key: 'humidity', group: 'agriculture', label: 'Humidity', unit: '%', icon: 'Wind',
        aliases: ['air_humidity', 'hum', 'humidity_value', 'relative_humidity'],
        range: { min: 25, max: 90, minMsg: 'Air is very dry', maxMsg: 'Very high humidity' },
        offset: [-0.0012, 0.0036], defaultZone: { village: 'weather_mast', campus: 'bio_block' }
    },

    // ── Water management ───────────────────────────────────────────────────
    {
        key: 'ph', group: 'water', label: 'pH Level', unit: 'pH', icon: 'FlaskConical',
        aliases: ['ph_value', 'ph_sensor', 'ph_sensor_value', 'water_ph', 'ph_level'],
        rawAliases: ['ph_raw', 'ph_adc', 'ph_analog'],
        rawMax: 14,
        fromRaw: (raw) => Math.round(Math.min(14, Math.max(0, PH_SLOPE * (raw / 4095) * 3.3 + PH_OFFSET)) * 100) / 100,
        range: { min: 6.5, max: 8.5, criticalMin: 5, criticalMax: 10, minMsg: 'Water is acidic', maxMsg: 'Water is alkaline' },
        offset: [0.0016, -0.0010], defaultZone: { village: 'water_quality_station', campus: 'main_block' }
    },
    {
        key: 'rain_intensity', group: 'water', label: 'Rain Intensity', unit: '%', icon: 'CloudRain',
        aliases: ['rain', 'rainfall', 'rain_intensity_value', 'rain_percent', 'rain_index'],
        rawAliases: ['rain_value', 'rainValue', 'rain_raw', 'rain_analog', 'rain_adc', 'rain_sensor'],
        fromRaw: (raw) => Math.round(Math.min(100, Math.max(0, (4095 - raw) / 4095 * 100))),
        range: { max: 30, criticalMax: 60, maxMsg: 'Heavy rainfall detected' },
        offset: [0.0004, 0.0008], defaultZone: { village: 'panchayat_office', campus: 'main_block' }
    },
    {
        key: 'rain_detected', group: 'water', label: 'Rain Detected', unit: '', icon: 'CloudRain', binary: true,
        aliases: ['rainDetected', 'is_raining', 'raining', 'rain_status', 'rain_flag'],
        offset: [0.0006, 0.0014], defaultZone: { village: 'panchayat_office', campus: 'main_block' }
    },
    {
        key: 'water_level_dam', group: 'water', label: 'Water Level – Dam', unit: '%', icon: 'Waves',
        aliases: ['dam_level', 'dam_water_level', 'dam', 'water_level_dam_value'],
        range: { max: 85, criticalMax: 95, maxMsg: 'Dam nearing full capacity' },
        offset: [-0.0006, -0.0038], defaultZone: { village: 'check_dam', campus: 'campus_grounds' }
    },
    {
        key: 'water_level_tank', group: 'water', label: 'Water Level – Tank', unit: '%', icon: 'Cylinder',
        aliases: ['tank_level', 'tank_water_level', 'water_level_water_tank', 'tank', 'water_tank_level', 'waterLevel', 'water_level'],
        range: { min: 20, criticalMin: 10, minMsg: 'Tank level low – refill needed' },
        offset: [0.0026, -0.0002], defaultZone: { village: 'overhead_tank', campus: 'main_block' }
    },
    {
        key: 'pump', group: 'water', label: 'Water Pump', unit: '', icon: 'Power', binary: true, controllable: true,
        aliases: ['water_pump', 'pump_status', 'pump_state', 'water_pump_on_off', 'pump_on_off', 'motor'],
        offset: [0.0020, 0.0012], defaultZone: { village: 'pump_house', campus: 'main_block' }
    },
    {
        key: 'turbidity', group: 'water', label: 'Turbidity', unit: 'NTU', icon: 'Eye',
        aliases: ['turbidity_value', 'turbidity_sensor', 'water_turbidity', 'turbidity_value_of_water'],
        rawAliases: ['turbidity_raw', 'turbidity_adc', 'turbidity_analog'],
        rawMax: 300,
        fromRaw: (raw) => Math.round(Math.min(100, Math.max(0, (4095 - raw) / 4095 * 100)) * 10) / 10,
        range: { max: 5, criticalMax: 10, maxMsg: 'Water is turbid – check filtration' },
        offset: [0.0010, -0.0020], defaultZone: { village: 'water_quality_station', campus: 'main_block' }
    },

    // ── Energy management (Wh over the last hour) ─────────────────────────
    {
        key: 'solar_output_wh', group: 'energy', label: 'Solar Power Output', unit: 'Wh', icon: 'Sun', flow: 'producer',
        aliases: ['solar', 'solar_output', 'solar_wh', 'solar_power_output', 'solar_power_output_in_wh', 'solar_energy', 'solar_output_wh'],
        offset: [-0.0030, -0.0012], defaultZone: { village: 'solar_array', campus: 'main_block' }
    },
    {
        key: 'windmill_output_wh', group: 'energy', label: 'Windmill Power Output', unit: 'Wh', icon: 'Wind', flow: 'producer',
        aliases: ['wind', 'windmill', 'wind_output', 'windmill_output', 'wind_power', 'windmill_power', 'windmill_power_output', 'windmill_power_output_in_wh', 'wind_energy'],
        offset: [0.0008, 0.0042], defaultZone: { village: 'windmill_ridge', campus: 'campus_grounds' }
    },
    {
        key: 'household_consumption_wh', group: 'energy', label: 'Household Consumption', unit: 'Wh', icon: 'House', flow: 'consumer',
        aliases: ['household', 'consumption', 'household_consumption', 'household_conception', 'household_conception_wh', 'household_consumption_wh', 'load', 'household_load', 'house_consumption'],
        offset: [-0.0004, 0.0014], defaultZone: { village: 'model_household', campus: 'boys_hostel' }
    },

    // ── Node power monitor (prototype: solar-fed sensor node) ──────────────
    {
        key: 'solar_voltage', group: 'power', label: 'Solar Voltage', unit: 'V', icon: 'Sun',
        aliases: ['solar_v', 'panel_voltage', 'pv_voltage'],
        offset: [-0.0028, -0.0008], defaultZone: { village: 'solar_array', campus: 'main_block' }
    },
    {
        key: 'solar_current', group: 'power', label: 'Solar Current', unit: 'mA', icon: 'Sun',
        aliases: ['solar_i', 'panel_current', 'pv_current'],
        offset: [-0.0028, -0.0004], defaultZone: { village: 'solar_array', campus: 'main_block' }
    },
    {
        key: 'solar_power', group: 'power', label: 'Solar Power', unit: 'W', icon: 'Sun',
        aliases: ['panel_power', 'pv_power', 'solar_watts'],
        offset: [-0.0028, 0], defaultZone: { village: 'solar_array', campus: 'main_block' }
    },
    {
        key: 'total_power', group: 'power', label: 'Node Power Draw', unit: 'W', icon: 'Plug',
        aliases: ['node_power', 'total_watts', 'power_total', 'system_power'],
        offset: [-0.0026, 0.0004], defaultZone: { village: 'water_quality_station', campus: 'main_block' }
    },
    {
        key: 'led_power', group: 'power', label: 'LED Power', unit: 'W', icon: 'Plug',
        aliases: ['led_watts', 'light_power'],
        offset: [-0.0026, 0.0008], defaultZone: { village: 'water_quality_station', campus: 'main_block' }
    },
    {
        key: 'ph_sensor_power', group: 'power', label: 'pH Sensor Power', unit: 'W', icon: 'Plug',
        aliases: ['ph_power'],
        offset: [-0.0026, 0.0012], defaultZone: { village: 'water_quality_station', campus: 'main_block' }
    },
    {
        key: 'rain_sensor_power', group: 'power', label: 'Rain Sensor Power', unit: 'W', icon: 'Plug',
        aliases: ['rain_power'],
        offset: [-0.0026, 0.0016], defaultZone: { village: 'panchayat_office', campus: 'main_block' }
    },
    {
        key: 'turbidity_power', group: 'power', label: 'Turbidity Sensor Power', unit: 'W', icon: 'Plug',
        aliases: ['turbidity_sensor_power'],
        offset: [-0.0026, 0.0020], defaultZone: { village: 'water_quality_station', campus: 'main_block' }
    },
    {
        key: 'water_level_power', group: 'power', label: 'Level Sensor Power', unit: 'W', icon: 'Plug',
        aliases: ['water_level_sensor_power', 'level_sensor_power', 'tank_sensor_power'],
        offset: [-0.0026, 0.0024], defaultZone: { village: 'overhead_tank', campus: 'main_block' }
    }
];

export const METRIC_BY_KEY = Object.fromEntries(SENSOR_METRICS.map((metric) => [metric.key, metric]));

export const metricsForGroup = (groupId) => SENSOR_METRICS.filter((metric) => metric.group === groupId);

// ── Key normalisation ────────────────────────────────────────────────────────
export const normKey = (key) => String(key ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Firebase keys cannot contain "/", so a sensor path is stored with "~" instead. */
export const pathKey = (path) => String(path ?? '').replace(/\//g, '~');
export const pathFromKey = (key) => String(key ?? '').replace(/~/g, '/');

const METRIC_LOOKUP = new Map();      // normalised key -> metric key
const RAW_ALIAS_LOOKUP = new Set();   // normalised keys that carry a raw ADC value needing `fromRaw`
SENSOR_METRICS.forEach((metric) => {
    [metric.key, ...(metric.aliases || [])].forEach((alias) => {
        const nk = normKey(alias);
        if (!METRIC_LOOKUP.has(nk)) METRIC_LOOKUP.set(nk, metric.key);
    });
    (metric.rawAliases || []).forEach((alias) => {
        const nk = normKey(alias);
        if (!METRIC_LOOKUP.has(nk)) { METRIC_LOOKUP.set(nk, metric.key); RAW_ALIAS_LOOKUP.add(nk); }
    });
});

/** A node that declares `online: false` is stale; its readings are ignored. */
const isOfflineNode = (obj) => {
    if (!isPlainObject(obj)) return false;
    const key = Object.keys(obj).find((k) => normKey(k) === 'online');
    if (key === undefined) return false;
    const v = obj[key];
    return v === false || v === 0 || String(v).toLowerCase() === 'false' || String(v).toLowerCase() === 'off';
};

const TIMESTAMP_KEYS = new Set(['timestamp', 'updatedat', 'lastupdated', 'lastupdate', 'time', 'ts', 'datetime', 'lastseen']);
const LOCATION_MAP_KEYS = new Set(['locations', 'sensorlocations', 'positions', 'coords', 'geo']);
const CENTER_KEYS = new Set(['center', 'centre', 'location', 'position', 'gps']);
const VILLAGE_CONTAINERS = ['villages', 'village', 'sites', 'data'];
// Root keys that never hold village telemetry
const RESERVED_ROOT_KEYS = new Set(['config', 'alerts', 'parking', 'emergency', 'categories', 'assets']);

const SITE_NAME_KEYS = new Set(SITES.flatMap((s) => [normKey(s.id), normKey(s.name), normKey(s.fullName || '')]).filter(Boolean));
const CONTAINER_KEYS = new Set(VILLAGE_CONTAINERS.map(normKey));

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const findKeyCI = (obj, wanted) => {
    if (!isPlainObject(obj)) return undefined;
    const target = normKey(wanted);
    return Object.keys(obj).find((key) => normKey(key) === target);
};

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

/** Default map position of a metric: site centre + metric offset. */
export const offsetCoords = (center, offset) => {
    if (!center) return null;
    return [center[0] + (offset?.[0] || 0), center[1] + (offset?.[1] || 0)];
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
        return { status: 'normal', message: value ? `${metric.label} is on` : `${metric.label} is off` };
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
 * Inspect the root: which container keys (villages/, village/, …) actually hold
 * site sub-trees, and which root keys must be skipped by the flat-root parser.
 * A container with no known site inside (e.g. village/water_management from the
 * prototype firmware) is treated as flat prototype data, not as a site wrapper.
 */
const inspectRoot = (root) => {
    const skip = new Set(RESERVED_ROOT_KEYS);
    const containers = [];
    if (!isPlainObject(root)) return { skip, containers };
    for (const key of Object.keys(root)) {
        const nk = normKey(key);
        if (SITE_NAME_KEYS.has(nk)) { skip.add(nk); continue; }
        if (CONTAINER_KEYS.has(nk) && isPlainObject(root[key])) {
            const holdsSite = Object.keys(root[key]).some((child) => SITE_NAME_KEYS.has(normKey(child)));
            if (holdsSite) { containers.push(key); skip.add(nk); }
        }
    }
    return { skip, containers };
};

/**
 * Ownership rule for a reading found at `path`: an explicit placement wins,
 * otherwise the reading belongs to the source's default owner.
 */
const makeAccept = (siteId, defaultOwnerId, placement) => (path) => {
    const placed = placement?.[pathKey(path)];
    if (placed && placed.site) return placed.site === siteId;
    return defaultOwnerId === siteId;
};

/**
 * All places a site's readings may live, in priority order:
 *   1. <container>/<siteId>  (villages/puthenchira, …) – default owner = that site
 *   2. <siteId> at the root
 *   3. flat keys at the root (prototype firmware) – default owner = prototypeSiteId
 * Any reading can be re-assigned to another site through config/sensorPlacement.
 */
export const resolveVillageSources = (root, site, { placement = {}, prototypeSiteId = DEFAULT_SITE_ID } = {}) => {
    if (!isPlainObject(root) || !site) return [];
    const { skip, containers } = inspectRoot(root);
    const sources = [];

    // Every site may receive placed readings from every other site's container
    for (const containerKey of containers) {
        for (const ownerSite of SITES) {
            const ownerKey = findKeyCI(root[containerKey], ownerSite.id) || findKeyCI(root[containerKey], ownerSite.name);
            if (!ownerKey || !isPlainObject(root[containerKey][ownerKey])) continue;
            sources.push({
                node: root[containerKey][ownerKey],
                path: `${containerKey}/${ownerKey}`,
                accept: makeAccept(site.id, ownerSite.id, placement),
                ownerId: ownerSite.id
            });
        }
    }

    for (const ownerSite of SITES) {
        const ownerKey = findKeyCI(root, ownerSite.id) || findKeyCI(root, ownerSite.name);
        if (ownerKey && isPlainObject(root[ownerKey])) {
            sources.push({ node: root[ownerKey], path: ownerKey, accept: makeAccept(site.id, ownerSite.id, placement), ownerId: ownerSite.id });
        }
    }

    // Flat root (prototype firmware)
    sources.push({ node: root, path: '', skip, accept: makeAccept(site.id, prototypeSiteId, placement), ownerId: prototypeSiteId });

    // Sources owned by this site first so its own readings win ties
    return sources.sort((a, b) => Number(b.ownerId === site.id) - Number(a.ownerId === site.id));
};

/**
 * Flatten a node into
 * `{ readings: { [metricKey]: { value, raw, path, timestamp?, coords? } }, updatedAt, found, locations, center }`.
 * `skip` = normalised top-level keys to ignore; `accept(path)` = ownership filter.
 */
export const normalizeVillageNode = (node, basePath = '', skip = null, accept = null) => {
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
                if (accept && !accept(childPath)) continue;
                if (readings[metricKey] === undefined) { // first match wins
                    const metric = METRIC_BY_KEY[metricKey];
                    let value = parseSensorValue(metric, raw);
                    const isRawCount = RAW_ALIAS_LOOKUP.has(nk) || (metric.rawMax !== undefined && value !== null && value > metric.rawMax);
                    if (value !== null && isRawCount && typeof metric.fromRaw === 'function') value = metric.fromRaw(value);
                    const entry = { value, raw, path: childPath };
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

            if (isPlainObject(raw) && depth < 3 && !isOfflineNode(raw)) visit(raw, childPath, depth + 1);
        }
    };

    if (!isOfflineNode(node)) visit(node, basePath, 0);
    return { readings, updatedAt, found: Object.keys(readings).length, locations, center };
};

/** Normalise and merge several sources (see resolveVillageSources); earlier sources win. */
export const normalizeVillageSources = (sources) => {
    const merged = { readings: {}, updatedAt: null, found: 0, locations: {}, center: null, path: null, paths: [] };
    sources.forEach((source) => {
        const part = normalizeVillageNode(source.node, source.path, source.skip || null, source.accept || null);
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
    merged.path = merged.paths.length ? [...new Set(merged.paths)].join(' + ') : null;
    return merged;
};

/**
 * Every sensor path in the database that matches a known metric, with its
 * default owner. Used by the Site & Alerts configuration screen.
 */
export const collectMetricPaths = (root, { prototypeSiteId = DEFAULT_SITE_ID } = {}) => {
    const out = [];
    if (!isPlainObject(root)) return out;
    const { skip, containers } = inspectRoot(root);

    const walk = (obj, path, depth, ownerId) => {
        if (!isPlainObject(obj) || isOfflineNode(obj)) return;
        for (const [key, raw] of Object.entries(obj)) {
            const nk = normKey(key);
            if (depth === 0 && path === '' && skip.has(nk)) continue;
            const childPath = path ? `${path}/${key}` : key;
            const metricKey = METRIC_LOOKUP.get(nk);
            if (metricKey) {
                const metric = METRIC_BY_KEY[metricKey];
                let value = parseSensorValue(metric, raw);
                const isRawCount = RAW_ALIAS_LOOKUP.has(nk) || (metric.rawMax !== undefined && value !== null && value > metric.rawMax);
                if (value !== null && isRawCount && typeof metric.fromRaw === 'function') value = metric.fromRaw(value);
                out.push({ path: childPath, key: pathKey(childPath), metricKey, value, defaultOwnerId: ownerId });
                continue;
            }
            if (TIMESTAMP_KEYS.has(nk) || LOCATION_MAP_KEYS.has(nk) || CENTER_KEYS.has(nk)) continue;
            if (isPlainObject(raw) && depth < 3) walk(raw, childPath, depth + 1, ownerId);
        }
    };

    for (const containerKey of containers) {
        for (const site of SITES) {
            const ownerKey = findKeyCI(root[containerKey], site.id) || findKeyCI(root[containerKey], site.name);
            if (ownerKey && isPlainObject(root[containerKey][ownerKey])) walk(root[containerKey][ownerKey], `${containerKey}/${ownerKey}`, 0, site.id);
        }
    }
    for (const site of SITES) {
        const ownerKey = findKeyCI(root, site.id) || findKeyCI(root, site.name);
        if (ownerKey && isPlainObject(root[ownerKey])) walk(root[ownerKey], ownerKey, 0, site.id);
    }
    walk(root, '', 0, prototypeSiteId);
    return out;
};

/** Path used when the dashboard has to write a value the node has not published yet. */
export const defaultMetricPath = (siteId, metric) => `villages/${siteId}/${metric.group}/${metric.key}`;
