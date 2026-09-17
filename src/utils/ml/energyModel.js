// ---------------------------------------------------------------------------
// Energy-management model
//  • Solar & household forecast: hour-of-day seasonal profile learned from the
//    last 7 days, scaled by today's actual/expected ratio (seasonal-naive with
//    level adjustment).
//  • Wind forecast: Holt smoothing (wind has no clean daily cycle).
//  • Balance: generation vs consumption today, self-sufficiency ratio and the
//    projected surplus/deficit at midnight.
//  • Peak-load prediction from the consumption profile.
//  • Anomalies: daytime solar far below its profile (soiling / fault) and
//    consumption z-score against the same-hour history.
// ---------------------------------------------------------------------------
import { clamp, round, isNum, last, mean, sum, hourOfDayProfile, holtForecast, zScore, forecastConfidence } from './core.js';
import { formatHourLabel, istHourOf, istDayStart, HOUR_MS } from '../../data/syntheticHistory.js';

const HORIZON = 6;

export const runEnergyModel = ({ hourly, readings, now }) => {
    const week = hourly.slice(-168);
    const solarProfile = hourOfDayProfile(week, 'solar_output_wh');
    const loadProfile = hourOfDayProfile(week, 'household_consumption_wh');
    const windSeries = week.map((s) => s.windmill_output_wh).filter(isNum);

    const solar = readings.solar_output_wh?.value ?? last(week.map((s) => s.solar_output_wh).filter(isNum)) ?? 0;
    const wind = readings.windmill_output_wh?.value ?? last(windSeries) ?? 0;
    const load = readings.household_consumption_wh?.value ?? last(week.map((s) => s.household_consumption_wh).filter(isNum)) ?? 0;

    const hourNow = Math.floor(istHourOf(now)) % 24;
    const dayStart = istDayStart(now);
    const today = hourly.filter((s) => s.ts >= dayStart);

    // Level adjustment: how today compares with the learned profile so far
    const ratioFor = (profile, key) => {
        const pairs = today.map((s) => [s[key], profile[Math.floor(istHourOf(s.ts)) % 24]]).filter(([a, p]) => isNum(a) && p > 40);
        if (!pairs.length) return 1;
        return clamp(sum(pairs.map(([a]) => a)) / sum(pairs.map(([, p]) => p)), 0.4, 1.8);
    };
    const solarRatio = ratioFor(solarProfile, 'solar_output_wh');
    const loadRatio = ratioFor(loadProfile, 'household_consumption_wh');

    const solarForecast = Array.from({ length: HORIZON }, (_, i) => round(solarProfile[(hourNow + i + 1) % 24] * solarRatio, 0));
    const loadForecast = Array.from({ length: HORIZON }, (_, i) => round(loadProfile[(hourNow + i + 1) % 24] * loadRatio, 0));
    const windForecast = holtForecast(windSeries.slice(-24), HORIZON, 0.4, 0.1).map((v) => round(clamp(v, 0, 400), 0));

    // Today's totals (Wh)
    const genToday = sum(today.map((s) => (s.solar_output_wh || 0) + (s.windmill_output_wh || 0)));
    const loadToday = sum(today.map((s) => s.household_consumption_wh || 0));
    const hoursLeft = 23 - hourNow;
    const genRest = sum(Array.from({ length: hoursLeft }, (_, i) => solarProfile[(hourNow + i + 1) % 24] * solarRatio + mean(windSeries.slice(-24) || [0])));
    const loadRest = sum(Array.from({ length: hoursLeft }, (_, i) => loadProfile[(hourNow + i + 1) % 24] * loadRatio));
    const projectedBalance = Math.round(genToday + genRest - loadToday - loadRest);
    const selfSufficiency = loadToday > 0 ? Math.round(100 * clamp(genToday / loadToday, 0, 3)) : 0;

    // Peak load in the next 24 h
    let peakHour = hourNow; let peakValue = 0;
    for (let i = 1; i <= 24; i++) {
        const h = (hourNow + i) % 24;
        const v = loadProfile[h] * loadRatio;
        if (v > peakValue) { peakValue = v; peakHour = h; }
    }

    // Anomalies
    const expectedSolar = solarProfile[hourNow];
    const solarUnderperforming = expectedSolar > 150 && solar < 0.45 * expectedSolar;
    const sameHourLoads = week.filter((s) => Math.floor(istHourOf(s.ts)) % 24 === hourNow).map((s) => s.household_consumption_wh).filter(isNum);
    const loadAnomaly = zScore(sameHourLoads, load);

    // --- Alerts -------------------------------------------------------------
    const alerts = [];
    if (solarUnderperforming) {
        alerts.push({ severity: 'warning', metricKey: 'solar_output_wh', title: 'Solar under-performing', message: `Producing ${round(solar, 0)} Wh vs ${round(expectedSolar, 0)} Wh expected for this hour. Check for shading, soiling or an inverter fault.` });
    }
    if (loadAnomaly.anomalous && load > loadAnomaly.mean) {
        alerts.push({ severity: 'warning', metricKey: 'household_consumption_wh', title: 'Consumption spike', message: `${round(load, 0)} Wh is ${round(Math.abs(loadAnomaly.z))}σ above the usual ${round(loadAnomaly.mean, 0)} Wh for this hour.` });
    }
    if (projectedBalance < -500) {
        alerts.push({ severity: 'info', metricKey: 'household_consumption_wh', title: 'Grid import expected', message: `Projected deficit of ${Math.abs(projectedBalance)} Wh by midnight. Shift flexible loads to daylight hours.` });
    }
    if (wind < 15 && solar < 50 && load > 200) {
        alerts.push({ severity: 'info', metricKey: 'windmill_output_wh', title: 'Low renewable output', message: 'Both wind and solar are low while demand is high.' });
    }

    // --- Predictions --------------------------------------------------------
    const predictions = [
        { key: 'solar_next', label: 'Solar next hour', value: solarForecast[0], unit: 'Wh', confidence: Math.round(clamp(92 - 40 * Math.abs(1 - solarRatio), 50, 92)), method: 'Hour-of-day profile' },
        { key: 'gen_6h', label: 'Generation next 6 h', value: Math.round(sum(solarForecast) + sum(windForecast)), unit: 'Wh', confidence: 70, method: 'Profile + Holt' },
        { key: 'load_6h', label: 'Consumption next 6 h', value: Math.round(sum(loadForecast)), unit: 'Wh', confidence: forecastConfidence(week.map((s) => s.household_consumption_wh), 6), method: 'Hour-of-day profile' },
        { key: 'peak_load', label: 'Peak load expected', value: `${Math.round(peakValue)} @ ${String(peakHour).padStart(2, '0')}:00`, unit: 'Wh', confidence: 74, method: 'Profile argmax' },
        { key: 'self_sufficiency', label: 'Self-sufficiency today', value: selfSufficiency, unit: '%', confidence: 90, method: 'Energy balance' },
        { key: 'balance', label: 'Projected balance at midnight', value: `${projectedBalance >= 0 ? '+' : ''}${projectedBalance}`, unit: 'Wh', confidence: 65, method: 'Profile projection' }
    ];

    // --- Chart series: last 12 h actual + 6 h forecast ----------------------
    const past = hourly.slice(-12).map((s) => ({
        time: formatHourLabel(s.ts), solar: s.solar_output_wh ?? null, wind: s.windmill_output_wh ?? null, load: s.household_consumption_wh ?? null, source: s.source
    }));
    const lastTs = last(hourly)?.ts ?? now;
    const future = solarForecast.map((v, i) => ({
        time: formatHourLabel(lastTs + (i + 1) * HOUR_MS), solarForecast: v, windForecast: windForecast[i], loadForecast: loadForecast[i]
    }));
    if (past.length) {
        const tail = past[past.length - 1];
        tail.solarForecast = tail.solar; tail.windForecast = tail.wind; tail.loadForecast = tail.load;
    }
    const series = [...past, ...future];

    const summary = solarUnderperforming
        ? 'Solar array is producing far less than expected – inspect the panels.'
        : projectedBalance >= 0
            ? `Village is on track for a ${projectedBalance} Wh surplus today (${selfSufficiency} % self-sufficient).`
            : `Expect a ${Math.abs(projectedBalance)} Wh deficit by midnight; peak demand around ${String(peakHour).padStart(2, '0')}:00.`;

    return {
        group: 'energy',
        label: 'Energy Management',
        methods: ['Hour-of-day seasonal profile (7 d)', 'Level-adjusted seasonal naive forecast', 'Holt wind smoothing', 'z-score anomaly detection'],
        predictions,
        alerts,
        series,
        seriesKeys: { solar: 'Solar', wind: 'Wind', load: 'Consumption', solarForecast: 'Solar forecast', windForecast: 'Wind forecast', loadForecast: 'Load forecast' },
        unit: 'Wh',
        summary,
        score: clamp(selfSufficiency, 0, 100),
        totals: { genToday: Math.round(genToday), loadToday: Math.round(loadToday), solarToday: Math.round(sum(today.map((s) => s.solar_output_wh || 0))), windToday: Math.round(sum(today.map((s) => s.windmill_output_wh || 0))), projectedBalance, selfSufficiency, peakHour, peakValue: Math.round(peakValue) }
    };
};
