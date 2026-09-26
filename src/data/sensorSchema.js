// ---------------------------------------------------------------------------
// Field-sensor schema (RPS Sahrdaya / RPS Project 2 Realtime Databases)
//
// Canonical layout written by the field nodes:
//
//   villages/<siteId>/agriculture/{ soil_moisture, temperature, humidity }
//   villages/<siteId>/water/{ ph, rain_intensity, rain_detected, water_level_dam,
//                             water_level_tank, pump, turbidity }
//   villages/<siteId>/energy/{ solar_output_wh, windmill_output_wh,
//                              household_consumption_wh }
//   villages/<siteId>/power/{ solar_voltage, solar_current, solar_power, ... }
//   villages/<siteId>/updated_at   (epoch seconds/millis or ISO string)
//
// What the prototype firmware actually writes today (flat, at the root):
//
//   Watermanagement/{ ph, rain, turbidity, waterlevel1, waterlevel2, relay_state }
//   soilMoisturePump/{ soilMoisturePercent, relayState, pumpSafetyCutoff }
//   agriculture/{ soilMoisture, temperature, humidity }
//   powerData/{ household | solar | windmill }/{ voltage, current, power }
//   village/water_management/power_consumption/{ *_power, *_voltage, *_current }
//
// Keys are matched case-insensitively after stripping spaces, dashes and
// underscores. A few keys mean different things depending on their parent
// (relayState under soilMoisturePump is the irrigation pump; under
// Watermanagement it is the water pump) – see CONTEXT_RULES. Readings from a
// non-primary database carry a "<sourceId>:" path prefix (sensorSources.js).
//
// Optional map placement:
//   config/sensorPlacement/<path with / replaced by ~> = { site, zone }
//   config/zones/<siteId>/<zoneId> = { lat, lng }
//   villages/<siteId>/center/{ lat, lng }, villages/<siteId>/locations/<metricKey>/{ lat, lng }
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
// drawn in until an admin places it. `controllable` = the dashboard may write
// the value back to the node (relays).
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
    {
        key: 'soil_moisture_raw', group: 'agriculture', label: 'Soil Probe Raw', unit: 'ADC', icon: 'Gauge',
        aliases: ['soilRaw', 'soil_raw', 'moisture_raw', 'soil_adc', 'soil_moisture_adc', 'soil_analog'],
        informational: true,
        offset: [-0.0016, 0.0024], defaultZone: { village: 'paddy_field', campus: 'bio_block' }
    },
    {
        key: 'irrigation_zone_moisture', group: 'agriculture', label: 'Irrigation Zone Moisture', unit: '%', icon: 'Droplets',
        aliases: ['irrigation_moisture', 'pump_zone_moisture', 'irrigation_soil_moisture'],
        range: { min: 20, max: 80, minMsg: 'Irrigation zone is dry', maxMsg: 'Irrigation zone is water-logged' },
        offset: [-0.0020, 0.0026], defaultZone: { village: 'paddy_field', campus: 'bio_block' }
    },
    {
        key: 'irrigation_pump', group: 'agriculture', label: 'Irrigation Pump', unit: '', icon: 'Power', binary: true, controllable: true,
        aliases: ['irrigation_pump', 'irrigation_relay', 'soil_pump', 'soil_moisture_pump_relay', 'irrigation_pump_state'],
        onLabel: 'Running', offLabel: 'Stopped',
        offset: [-0.0016, 0.0018], defaultZone: { village: 'pump_house', campus: 'bio_block' }
    },
    {
        key: 'pump_safety_cutoff', group: 'agriculture', label: 'Irrigation Safety Cutoff', unit: '', icon: 'ShieldAlert', binary: true, controllable: true,
        aliases: ['pump_safety_cutoff', 'pumpSafetyCutoff', 'safety_cutoff', 'pump_cutoff', 'irrigation_cutoff'],
        onLabel: 'Engaged – pump locked off', offLabel: 'Clear',
        onStatus: 'warning',
        offset: [-0.0014, 0.0014], defaultZone: { village: 'pump_house', campus: 'bio_block' }
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
        aliases: ['dam_level', 'dam_water_level', 'dam', 'water_level_dam_value', 'waterlevel2', 'water_level_2', 'level2', 'reservoir_level'],
        range: { max: 85, criticalMax: 95, maxMsg: 'Dam nearing full capacity' },
        offset: [-0.0006, -0.0038], defaultZone: { village: 'check_dam', campus: 'campus_grounds' }
    },
    {
        key: 'water_level_tank', group: 'water', label: 'Water Level – Tank', unit: '%', icon: 'Cylinder',
        aliases: ['tank_level', 'tank_water_level', 'water_level_water_tank', 'tank', 'water_tank_level', 'waterLevel', 'water_level', 'waterlevel1', 'water_level_1', 'level1', 'tank_level_1'],
        range: { min: 20, criticalMin: 10, minMsg: 'Tank level low – refill needed' },
        offset: [0.0026, -0.0002], defaultZone: { village: 'overhead_tank', campus: 'main_block' }
    },
    {
        key: 'pump', group: 'water', label: 'Water Pump', unit: '', icon: 'Power', binary: true, controllable: true,
        aliases: ['water_pump', 'pump_status', 'pump_state', 'water_pump_on_off', 'pump_on_off', 'motor', 'relay_state', 'relay', 'pump_relay', 'water_pump_relay', 'water_relay'],
        onLabel: 'Running', offLabel: 'Stopped',
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
        aliases: ['wind', 'windmill', 'wind_output', 'windmill_output', 'wind_wh', 'windmill_wh', 'windmill_power_output', 'windmill_power_output_in_wh', 'wind_energy'],
        offset: [0.0008, 0.0042], defaultZone: { village: 'windmill_ridge', campus: 'campus_grounds' }
    },
    {
        key: 'household_consumption_wh', group: 'energy', label: 'Household Consumption', unit: 'Wh', icon: 'House', flow: 'consumer',
        aliases: ['household', 'consumption', 'household_consumption', 'household_conception', 'household_conception_wh', 'household_consumption_wh', 'load', 'household_load', 'house_consumption'],
        offset: [-0.0004, 0.0014], defaultZone: { village: 'model_household', campus: 'boys_hostel' }
    },

    // ── Node power monitor (INA219-class meters on the prototype) ──────────
    { key: 'solar_voltage', group: 'power', label: 'Solar Voltage', unit: 'V', icon: 'Sun', aliases: ['solar_v', 'panel_voltage', 'pv_voltage'], offset: [-0.0028, -0.0008], defaultZone: { village: 'solar_array', campus: 'main_block' } },
    { key: 'solar_current', group: 'power', label: 'Solar Current', unit: 'mA', icon: 'Sun', aliases: ['solar_i', 'panel_current', 'pv_current'], offset: [-0.0028, -0.0004], defaultZone: { village: 'solar_array', campus: 'main_block' } },
    { key: 'solar_power', group: 'power', label: 'Solar Power', unit: 'W', icon: 'Sun', aliases: ['panel_power', 'pv_power', 'solar_watts'], offset: [-0.0028, 0], defaultZone: { village: 'solar_array', campus: 'main_block' } },
    { key: 'windmill_voltage', group: 'power', label: 'Windmill Voltage', unit: 'V', icon: 'Wind', aliases: ['wind_voltage', 'turbine_voltage'], offset: [0.0006, 0.0040], defaultZone: { village: 'windmill_ridge', campus: 'campus_grounds' } },
    { key: 'windmill_current', group: 'power', label: 'Windmill Current', unit: 'mA', icon: 'Wind', aliases: ['wind_current', 'turbine_current'], offset: [0.0006, 0.0044], defaultZone: { village: 'windmill_ridge', campus: 'campus_grounds' } },
    { key: 'windmill_power', group: 'power', label: 'Windmill Power', unit: 'W', icon: 'Wind', aliases: ['wind_power', 'turbine_power', 'wind_watts'], offset: [0.0010, 0.0042], defaultZone: { village: 'windmill_ridge', campus: 'campus_grounds' } },
    { key: 'household_voltage', group: 'power', label: 'Household Voltage', unit: 'V', icon: 'House', aliases: ['house_voltage', 'load_voltage'], offset: [-0.0006, 0.0012], defaultZone: { village: 'model_household', campus: 'boys_hostel' } },
    { key: 'household_current', group: 'power', label: 'Household Current', unit: 'mA', icon: 'House', aliases: ['house_current', 'load_current'], offset: [-0.0006, 0.0016], defaultZone: { village: 'model_household', campus: 'boys_hostel' } },
    { key: 'household_power', group: 'power', label: 'Household Power', unit: 'W', icon: 'House', aliases: ['house_power', 'load_power', 'household_watts'], offset: [-0.0006, 0.0020], defaultZone: { village: 'model_household', campus: 'boys_hostel' } },
    { key: 'total_power', group: 'power', label: 'Node Power Draw', unit: 'W', icon: 'Plug', aliases: ['node_power', 'total_watts', 'power_total', 'system_power'], offset: [-0.0026, 0.0004], defaultZone: { village: 'water_quality_station', campus: 'main_block' } },
    { key: 'led_power', group: 'power', label: 'LED Power', unit: 'W', icon: 'Plug', aliases: ['led_watts', 'light_power'], offset: [-0.0026, 0.0008], defaultZone: { village: 'water_quality_station', campus: 'main_block' } },
    { key: 'ph_sensor_power', group: 'power', label: 'pH Sensor Power', unit: 'W', icon: 'Plug', aliases: ['ph_power'], offset: [-0.0026, 0.0012], defaultZone: { village: 'water_quality_station', campus: 'main_block' } },
    { key: 'rain_sensor_power', group: 'power', label: 'Rain Sensor Power', unit: 'W', icon: 'Plug', aliases: ['rain_power'], offset: [-0.0026, 0.0016], defaultZone: { village: 'panchayat_office', campus: 'main_block' } },
    { key: 'turbidity_power', group: 'power', label: 'Turbidity Sensor Power', unit: 'W', icon: 'Plug', aliases: ['turbidity_sensor_power'], offset: [-0.0026, 0.0020], defaultZone: { village: 'water_quality_station', campus: 'main_block' } },
    { key: 'water_level_power', group: 'power', label: 'Level Sensor Power', unit: 'W', icon: 'Plug', aliases: ['water_level_sensor_power', 'level_sensor_power', 'tank_sensor_power'], offset: [-0.0026, 0.0024], defaultZone: { village: 'overhead_tank', campus: 'main_block' } }
];

export const METRIC_BY_KEY = Object.fromEntries(SENSOR_METRICS.map((metric) => [metric.key, metric]));
export const CONTROLLABLE_METRICS = SENSOR_METRICS.filter((metric) => metric.controllable);
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

// Keys whose meaning depends on the parent node. [parent contains, key equals, metric | null = ignore]
const CONTEXT_RULES = [
    ['soil', 'relaystate', 'irrigation_pump'],
    ['irrigat', 'relaystate', 'irrigation_pump'],
    ['soil', 'pumpsafetycutoff', 'pump_safety_cutoff'],
    ['soil', 'soilmoisturepercent', 'irrigation_zone_moisture'],
    ['soil', 'soilmoisture', 'irrigation_zone_moisture'],
    ['soilmoisturepump', 'humidity', null],       // the pump node echoes 0 for these; the weather node is authoritative
    ['soilmoisturepump', 'temperature', null],
    ['water', 'relaystate', 'pump'],
    ['tank', 'relaystate', 'pump'],
    ['household', 'power', 'household_power'], ['household', 'voltage', 'household_voltage'], ['household', 'current', 'household_current'],
    ['solar', 'power', 'solar_power'], ['solar', 'voltage', 'solar_voltage'], ['solar', 'current', 'solar_current'],
    ['wind', 'power', 'windmill_power'], ['wind', 'voltage', 'windmill_voltage'], ['wind', 'current', 'windmill_current']
];

const contextMetric = (parentNorm, nk) => {
    if (!parentNorm) return undefined;
    for (const [parentPart, keyNorm, metricKey] of CONTEXT_RULES) {
        if (nk === keyNorm && parentNorm.includes(parentPart)) return metricKey; // may be null (= ignore)
    }
    return undefined;
};

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
// Root keys that never hold site telemetry
const RESERVED_ROOT_KEYS = new Set(['config', 'alerts', 'parking', 'emergency', 'categories', 'assets', 'waste', 'test']);

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
const TRUE_WORDS = ['on', '1', 'true', 'active', 'running', 'high', 'yes', 'open', 'engaged'];
const FALSE_WORDS = ['off', '0', 'false', 'inactive', 'stopped', 'low', 'no', 'closed', 'idle', 'clear'];

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
        const onLabel = metric.onLabel || `${metric.label} is on`;
        const offLabel = metric.offLabel || `${metric.label} is off`;
        const status = value && metric.onStatus ? metric.onStatus : 'normal';
        return { status, message: value ? onLabel : offLabel };
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
 * site sub-trees, and which root keys the flat-root parser must skip.
 */
const inspectRoot = (root, extraSkip = null) => {
    const skip = new Set(RESERVED_ROOT_KEYS);
    if (extraSkip) extraSkip.forEach((k) => skip.add(normKey(k)));
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

const makeAccept = (siteId, defaultOwnerId, placement) => (path) => {
    const placed = placement?.[pathKey(path)];
    if (placed && placed.site) return placed.site === siteId;
    return defaultOwnerId === siteId;
};

/**
 * All places a site's readings may live inside one database root, in priority
 * order. `prefix` ("<sourceId>:") namespaces paths from non-primary databases;
 * `ignoreKeys` skips stale root nodes for that database.
 */
export const resolveVillageSources = (root, site, { placement = {}, prototypeSiteId = DEFAULT_SITE_ID, prefix = '', ignoreKeys = null } = {}) => {
    if (!isPlainObject(root) || !site) return [];
    const { skip, containers } = inspectRoot(root, ignoreKeys);
    const sources = [];

    for (const containerKey of containers) {
        for (const ownerSite of SITES) {
            const ownerKey = findKeyCI(root[containerKey], ownerSite.id) || findKeyCI(root[containerKey], ownerSite.name);
            if (!ownerKey || !isPlainObject(root[containerKey][ownerKey])) continue;
            sources.push({ node: root[containerKey][ownerKey], path: `${prefix}${containerKey}/${ownerKey}`, accept: makeAccept(site.id, ownerSite.id, placement), ownerId: ownerSite.id, prefix });
        }
    }
    for (const ownerSite of SITES) {
        const ownerKey = findKeyCI(root, ownerSite.id) || findKeyCI(root, ownerSite.name);
        if (ownerKey && isPlainObject(root[ownerKey])) {
            sources.push({ node: root[ownerKey], path: `${prefix}${ownerKey}`, accept: makeAccept(site.id, ownerSite.id, placement), ownerId: ownerSite.id, prefix });
        }
    }
    sources.push({ node: root, path: '', skip, accept: makeAccept(site.id, prototypeSiteId, placement), ownerId: prototypeSiteId, prefix });

    return sources.sort((a, b) => Number(b.ownerId === site.id) - Number(a.ownerId === site.id));
};

const SCALAR_FIELDS = ['value', 'val', 'reading', 'state'];
/** An object is a reading only when it wraps a scalar ({ value, timestamp }); otherwise it is a group to descend into. */
const isReadingObject = (raw) => isPlainObject(raw) && SCALAR_FIELDS.some((k) => raw[k] !== undefined && !isPlainObject(raw[k]));

const matchMetric = (nk, parentNorm, raw) => {
    if (isPlainObject(raw) && !isReadingObject(raw)) return undefined; // e.g. powerData/solar/{voltage,current,power}
    const ctx = contextMetric(parentNorm, nk);
    if (ctx !== undefined) return ctx; // metric key or null (ignore)
    return METRIC_LOOKUP.get(nk);
};

const convertValue = (metric, nk, raw) => {
    let value = parseSensorValue(metric, raw);
    const isRawCount = RAW_ALIAS_LOOKUP.has(nk) || (metric.rawMax !== undefined && value !== null && value > metric.rawMax);
    if (value !== null && isRawCount && typeof metric.fromRaw === 'function') value = metric.fromRaw(value);
    return value;
};

/**
 * Flatten a node into
 * `{ readings: { [metricKey]: { value, raw, path, timestamp?, coords? } }, updatedAt, found, locations, center }`.
 */
export const normalizeVillageNode = (node, basePath = '', skip = null, accept = null, prefix = '') => {
    const readings = {};
    const locations = {};
    let updatedAt = null;
    let center = null;

    const visit = (obj, path, depth, parentNorm) => {
        if (!isPlainObject(obj)) return;
        for (const [key, raw] of Object.entries(obj)) {
            const nk = normKey(key);
            if (depth === 0 && skip && skip.has(nk)) continue;
            const childPath = path ? `${path}/${key}` : `${prefix}${key}`;
            const metricKey = matchMetric(nk, parentNorm, raw);
            if (metricKey === null) continue; // context rule says ignore

            if (metricKey) {
                if (accept && !accept(childPath)) continue;
                if (readings[metricKey] === undefined) { // first match wins
                    const metric = METRIC_BY_KEY[metricKey];
                    const entry = { value: convertValue(metric, nk, raw), raw, path: childPath };
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
            if (isPlainObject(raw) && depth < 3 && !isOfflineNode(raw)) visit(raw, childPath, depth + 1, nk);
        }
    };

    if (!isOfflineNode(node)) visit(node, basePath, 0, normKey(basePath.split('/').pop()));
    return { readings, updatedAt, found: Object.keys(readings).length, locations, center };
};

/** Normalise and merge several sources (see resolveVillageSources); earlier sources win. */
export const normalizeVillageSources = (sources) => {
    const merged = { readings: {}, updatedAt: null, found: 0, locations: {}, center: null, path: null, paths: [] };
    sources.forEach((source) => {
        const part = normalizeVillageNode(source.node, source.path, source.skip || null, source.accept || null, source.prefix || '');
        let used = false;
        Object.entries(part.readings).forEach(([key, entry]) => {
            if (merged.readings[key] === undefined) { merged.readings[key] = entry; used = true; }
        });
        Object.entries(part.locations).forEach(([key, coords]) => { if (!merged.locations[key]) merged.locations[key] = coords; });
        if (!merged.center && part.center) merged.center = part.center;
        if (part.updatedAt && (!merged.updatedAt || part.updatedAt > merged.updatedAt)) merged.updatedAt = part.updatedAt;
        if (used) merged.paths.push(source.path === '' ? `${source.prefix || ''}/` : `/${source.path}`);
    });
    merged.found = Object.keys(merged.readings).length;
    merged.path = merged.paths.length ? [...new Set(merged.paths)].join(' + ') : null;
    return merged;
};

/** Every sensor path in a database root that matches a known metric, with its default owner. */
export const collectMetricPaths = (root, { prototypeSiteId = DEFAULT_SITE_ID, prefix = '', ignoreKeys = null } = {}) => {
    const out = [];
    if (!isPlainObject(root)) return out;
    const { skip, containers } = inspectRoot(root, ignoreKeys);

    const walk = (obj, path, depth, ownerId, parentNorm) => {
        if (!isPlainObject(obj) || isOfflineNode(obj)) return;
        for (const [key, raw] of Object.entries(obj)) {
            const nk = normKey(key);
            if (depth === 0 && path === '' && skip.has(nk)) continue;
            const childPath = path ? `${path}/${key}` : `${prefix}${key}`;
            const metricKey = matchMetric(nk, parentNorm, raw);
            if (metricKey === null) continue;
            if (metricKey) {
                const metric = METRIC_BY_KEY[metricKey];
                out.push({ path: childPath, key: pathKey(childPath), metricKey, value: convertValue(metric, nk, raw), defaultOwnerId: ownerId });
                continue;
            }
            if (TIMESTAMP_KEYS.has(nk) || LOCATION_MAP_KEYS.has(nk) || CENTER_KEYS.has(nk)) continue;
            if (isPlainObject(raw) && depth < 3) walk(raw, childPath, depth + 1, ownerId, nk);
        }
    };

    for (const containerKey of containers) {
        for (const site of SITES) {
            const ownerKey = findKeyCI(root[containerKey], site.id) || findKeyCI(root[containerKey], site.name);
            if (ownerKey && isPlainObject(root[containerKey][ownerKey])) walk(root[containerKey][ownerKey], `${prefix}${containerKey}/${ownerKey}`, 0, site.id, normKey(ownerKey));
        }
    }
    for (const site of SITES) {
        const ownerKey = findKeyCI(root, site.id) || findKeyCI(root, site.name);
        if (ownerKey && isPlainObject(root[ownerKey])) walk(root[ownerKey], `${prefix}${ownerKey}`, 0, site.id, normKey(ownerKey));
    }
    walk(root, '', 0, prototypeSiteId, '');
    return out;
};

/** Path used when the dashboard has to write a value the node has not published yet (primary database). */
export const defaultMetricPath = (siteId, metric) => `villages/${siteId}/${metric.group}/${metric.key}`;
