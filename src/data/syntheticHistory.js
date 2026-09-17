// ---------------------------------------------------------------------------
// Synthetic historical telemetry (baseline data)
//
// Produces a deterministic 7-day, hourly history for a village so the
// dashboard, trend charts and ML models have context before (and alongside)
// live readings. Values follow simple physical rules: diurnal temperature and
// solar curves, morning/evening household peaks, monsoon-style rain events
// that raise turbidity, dam and soil moisture, evapotranspiration drying the
// soil, and a pump that refills the tank / irrigates when levels get low.
//
// Every sample is tagged `source: 'synthetic'`; live samples from Firebase are
// tagged `source: 'live'` and always take precedence when merged.
// ---------------------------------------------------------------------------
import { DEFAULT_VILLAGE_ID } from './villages.js';

export const HOUR_MS = 60 * 60 * 1000;
export const SYNTHETIC_DAYS = 7;
export const IST_OFFSET_MS = 5.5 * HOUR_MS;

export const METRIC_KEYS = [
    'soil_moisture', 'temperature', 'humidity',
    'ph', 'rain_intensity', 'water_level_dam', 'water_level_tank', 'pump', 'turbidity',
    'solar_output_wh', 'windmill_output_wh', 'household_consumption_wh'
];

// Seeded PRNG so every reload shows the same baseline for a village
const mulberry32 = (seed) => () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hashSeed = (text) => {
    let h = 2166136261;
    for (const ch of String(text)) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/** Fractional hour of day in IST for a timestamp. */
export const istHourOf = (ts) => ((ts + IST_OFFSET_MS) / HOUR_MS) % 24;

/** Start of the current IST day (ms since epoch). */
export const istDayStart = (ts) => Math.floor((ts + IST_OFFSET_MS) / (24 * HOUR_MS)) * 24 * HOUR_MS - IST_OFFSET_MS;

export const generateSyntheticHistory = (villageId = DEFAULT_VILLAGE_ID, { days = SYNTHETIC_DAYS, endTime = Date.now() } = {}) => {
    const rand = mulberry32(hashSeed(villageId));
    const gauss = () => {
        const u = 1 - rand();
        const v = rand();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    const end = Math.floor(endTime / HOUR_MS) * HOUR_MS;
    const steps = days * 24;
    const start = end - steps * HOUR_MS;

    // Village character: capacity of the solar array / demand differs slightly per site
    const siteFactor = 0.9 + rand() * 0.2;

    // Rain events (monsoon style, mostly afternoons)
    const rainEvents = [];
    for (let d = 0; d <= days; d++) {
        if (rand() < 0.55) {
            rainEvents.push({ day: d, startH: 12 + rand() * 9, dur: 1.5 + rand() * 3, peak: 8 + rand() * 35 });
        }
    }

    // State variables
    let soil = 45;
    let tank = 70;
    let dam = 70;
    let ph = 7.1;
    let turb = 2.2;
    let pump = 0;
    let irrigating = false;
    let wind = 45;

    const samples = [];
    for (let i = 0; i <= steps; i++) {
        const ts = start + i * HOUR_MS;
        const h = istHourOf(ts);
        const day = Math.floor((ts - start) / (24 * HOUR_MS));

        // Rain intensity (mm/h)
        let rain = 0;
        for (const event of rainEvents) {
            if (event.day !== day) continue;
            const dt = h - event.startH;
            if (dt >= 0 && dt <= event.dur) rain += event.peak * Math.sin(Math.PI * dt / event.dur);
        }
        rain = clamp(rain + (rain > 0 ? gauss() * 2 : 0), 0, 80);
        const raining = rain > 0.5;

        // Weather
        const cloud = raining ? 0.35 : 0.75 + rand() * 0.25;
        const temp = 26 + 5.5 * Math.sin(((h - 8) / 24) * 2 * Math.PI) * (raining ? 0.6 : 1) - (raining ? 2 : 0) + gauss() * 0.6;
        const hum = clamp(88 - (temp - 24) * 4 + (raining ? 8 : 0) + gauss() * 2.5, 40, 98);

        // Energy (Wh produced / consumed in the hour)
        const sunAngle = Math.sin(Math.PI * (h - 6) / 12);
        const solar = h > 6 && h < 18 ? clamp(600 * sunAngle * cloud * siteFactor + gauss() * 20, 0, 720) : 0;
        wind = clamp(wind + gauss() * 8 + (h > 15 && h < 22 ? 2 : -1), 10, 160);
        const windOut = round(wind + (raining ? 15 : 0), 0);
        const peaks = 120 * Math.exp(-((h - 7.5) ** 2) / 2) + 200 * Math.exp(-((h - 19.5) ** 2) / 3.5);
        const household = round(clamp((160 + peaks + gauss() * 14) * siteFactor, 80, 520), 0);

        // Soil water balance: evapotranspiration vs rain / irrigation
        const et = clamp(0.35 + 0.05 * (temp - 24) + 0.01 * (60 - hum), 0.1, 1.2) * (h > 8 && h < 18 ? 2.6 : 1.0);
        // Irrigation valve opens below 26 % and closes again at 45 %
        irrigating = soil < 26 ? true : (irrigating && soil < 45);
        soil = clamp(soil - et + Math.min(rain * 0.15, 3.5) + (irrigating ? 2.5 : 0) + gauss() * 0.3, 8, 90);

        // Tank / pump control loop (pump also runs while irrigating)
        tank = clamp(tank - household / 60 + (pump ? 6 : 0) + gauss() * 0.3, 3, 100);
        if (!pump && tank < 32) pump = 1;
        else if (pump && tank > 88) pump = 0;

        // Dam and water quality
        dam = clamp(dam + rain * 0.08 - 0.07 + gauss() * 0.1, 30, 98);
        ph = clamp(ph + gauss() * 0.04 - (rain > 10 ? 0.03 : 0) + (7.1 - ph) * 0.05, 5.8, 8.6);
        turb = clamp(turb * 0.85 + 0.35 + rain * 0.12 + gauss() * 0.15, 0.5, 14);

        samples.push({
            ts,
            source: 'synthetic',
            soil_moisture: round(soil),
            temperature: round(temp),
            humidity: round(hum),
            ph: round(ph, 2),
            rain_intensity: round(rain),
            water_level_dam: round(dam),
            water_level_tank: round(tank),
            pump: pump || irrigating ? 1 : 0,
            turbidity: round(turb),
            solar_output_wh: round(solar, 0),
            windmill_output_wh: windOut,
            household_consumption_wh: household
        });
    }
    return samples;
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

/**
 * Merge live samples (irregular timestamps) into the hourly synthetic baseline.
 * A live hour replaces the synthetic values for every metric it reported.
 */
export const buildHourlySeries = (synthetic, liveSamples = []) => {
    if (!liveSamples.length) return synthetic;

    const byHour = new Map(synthetic.map((s) => [s.ts, { ...s }]));
    const groups = new Map();
    liveSamples.forEach((sample) => {
        const hour = Math.floor(sample.ts / HOUR_MS) * HOUR_MS;
        if (!groups.has(hour)) groups.set(hour, []);
        groups.get(hour).push(sample);
    });

    groups.forEach((list, hour) => {
        const base = byHour.get(hour) || { ts: hour };
        const merged = { ...base, source: 'live' };
        METRIC_KEYS.forEach((key) => {
            const values = list.map((s) => s[key]).filter(isNum);
            if (!values.length) return;
            merged[key] = key === 'pump' ? values[values.length - 1] : round(mean(values), 2);
        });
        byHour.set(hour, merged);
    });

    return [...byHour.values()].sort((a, b) => a.ts - b.ts);
};

export const formatHourLabel = (ts) => new Date(ts).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
});

export const formatDayHourLabel = (ts) => new Date(ts).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
});
