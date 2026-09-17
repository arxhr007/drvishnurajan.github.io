#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Field-node simulator for the RPS Sahrdaya sensor database.
//
// Streams realistic readings for the 12 village sensors into
//   villages/<village>/{agriculture,water,energy}/...
// using the Realtime Database REST API, so the dashboard can be demonstrated
// before the ESP32 nodes are online. The pump state is READ from the database
// before each write, so toggles made from the dashboard are respected.
//
// Usage:
//   node scripts/simulate-sensors.mjs                 # Puthenchira, every 5 s
//   node scripts/simulate-sensors.mjs --once          # write a single snapshot
//   VILLAGE=karumathra INTERVAL=10 node scripts/simulate-sensors.mjs
//   SENSOR_DB_URL=https://<other>.firebasedatabase.app node scripts/simulate-sensors.mjs
//   DB_AUTH=<database secret or id token> ...         # if rules require auth
// ---------------------------------------------------------------------------

const DB_URL = (process.env.SENSOR_DB_URL || 'https://rps-sahrdaya-bfe70-default-rtdb.asia-southeast1.firebasedatabase.app').replace(/\/+$/, '');
const VILLAGE = (process.env.VILLAGE || 'puthenchira').toLowerCase();
const INTERVAL_S = Number(process.env.INTERVAL || 5);
const ONCE = process.argv.includes('--once');
const AUTH = process.env.DB_AUTH ? `?auth=${encodeURIComponent(process.env.DB_AUTH)}` : '';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const istHour = () => ((Date.now() / 3600000 + 5.5) % 24);

// Slowly drifting state
const state = { soil: 42, tank: 68, dam: 61, ph: 7.1, turb: 2.1, wind: 45, rainEventUntil: 0, rainPeak: 0 };

const nextReadings = (pump) => {
    const h = istHour();
    const now = Date.now();

    if (now > state.rainEventUntil && Math.random() < 0.004) {
        state.rainEventUntil = now + (10 + Math.random() * 20) * 60 * 1000;
        state.rainPeak = 8 + Math.random() * 30;
    }
    const raining = now < state.rainEventUntil;
    const rain = raining ? clamp(state.rainPeak + gauss() * 2, 0, 80) : 0;

    const cloud = raining ? 0.35 : 0.85;
    const temp = 26 + 5.5 * Math.sin(((h - 8) / 24) * 2 * Math.PI) - (raining ? 2 : 0) + gauss() * 0.3;
    const hum = clamp(88 - (temp - 24) * 4 + (raining ? 8 : 0) + gauss() * 1.5, 40, 98);
    const sun = Math.sin(Math.PI * (h - 6) / 12);
    const solar = h > 6 && h < 18 ? clamp(600 * sun * cloud + gauss() * 20, 0, 720) : 0;
    state.wind = clamp(state.wind + gauss() * 4, 10, 160);
    const peaks = 120 * Math.exp(-((h - 7.5) ** 2) / 2) + 200 * Math.exp(-((h - 19.5) ** 2) / 3.5);
    const household = clamp(160 + peaks + gauss() * 12, 80, 520);

    const dt = INTERVAL_S / 3600; // hours per tick
    const et = clamp(0.35 + 0.05 * (temp - 24) + 0.01 * (60 - hum), 0.1, 1.2) * (h > 8 && h < 18 ? 2.6 : 1.0);
    state.soil = clamp(state.soil + (-et + Math.min(rain * 0.15, 3.5) + (pump ? 2.5 : 0)) * dt * 12 + gauss() * 0.05, 8, 90);
    state.tank = clamp(state.tank + (-household / 60 + (pump ? 6 : 0)) * dt * 12 + gauss() * 0.05, 3, 100);
    state.dam = clamp(state.dam + (rain * 0.08 - 0.12) * dt * 12, 30, 98);
    state.ph = clamp(state.ph + gauss() * 0.01 + (7.1 - state.ph) * 0.02, 5.8, 8.6);
    state.turb = clamp(state.turb * 0.98 + 0.05 + rain * 0.01 + gauss() * 0.05, 0.5, 14);

    return {
        agriculture: { soil_moisture: round(state.soil), temperature: round(temp), humidity: round(hum) },
        water: {
            ph: round(state.ph, 2),
            rain_intensity: round(rain),
            water_level_dam: round(state.dam),
            water_level_tank: round(state.tank),
            pump: pump ? 'on' : 'off',
            turbidity: round(state.turb)
        },
        energy: {
            solar_output_wh: round(solar, 0),
            windmill_output_wh: round(state.wind + (raining ? 15 : 0), 0),
            household_consumption_wh: round(household, 0)
        },
        updated_at: Math.floor(now / 1000)
    };
};

const readPump = async () => {
    try {
        const res = await fetch(`${DB_URL}/villages/${VILLAGE}/water/pump.json${AUTH}`);
        const raw = await res.json();
        const word = String(raw ?? 'off').toLowerCase();
        return raw === true || raw === 1 || ['on', '1', 'true', 'active'].includes(word);
    } catch {
        return false;
    }
};

const writeSnapshot = async () => {
    const pump = await readPump();
    const payload = nextReadings(pump);
    const res = await fetch(`${DB_URL}/villages/${VILLAGE}.json${AUTH}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} ${text}`);
    }
    const a = payload.agriculture; const w = payload.water; const e = payload.energy;
    console.log(`[${new Date().toLocaleTimeString('en-IN', { hour12: false })}] ${VILLAGE} soil ${a.soil_moisture}% temp ${a.temperature}°C hum ${a.humidity}% | pH ${w.ph} rain ${w.rain_intensity} dam ${w.water_level_dam}% tank ${w.water_level_tank}% pump ${w.pump} turb ${w.turbidity} | solar ${e.solar_output_wh} wind ${e.windmill_output_wh} load ${e.household_consumption_wh} Wh`);
};

const main = async () => {
    console.log(`Simulating ${VILLAGE} -> ${DB_URL}/villages/${VILLAGE} every ${INTERVAL_S}s${ONCE ? ' (once)' : ''}. Ctrl+C to stop.`);
    try {
        await writeSnapshot();
    } catch (err) {
        console.error('Write failed:', err.message);
        console.error('If the database rules require authentication, pass DB_AUTH=<secret or id token>.');
        process.exit(1);
    }
    if (ONCE) return;
    setInterval(() => writeSnapshot().catch((err) => console.error('Write failed:', err.message)), INTERVAL_S * 1000);
};

main();
