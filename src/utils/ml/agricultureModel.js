// ---------------------------------------------------------------------------
// Agriculture model
//  • Soil-moisture forecast: Holt double-exponential smoothing on the last 24 h,
//    corrected by an evapotranspiration (ET) term derived from temperature and
//    humidity (Hargreaves-style proxy).
//  • Irrigation need: logistic model on current moisture and ET.
//  • Crop stress index: weighted dryness / heat / dry-air components.
//  • Anomaly detection: z-score of the latest temperature against the last 72 h.
// ---------------------------------------------------------------------------
import { clamp, round, isNum, last, holtForecast, trendSlope, zScore, logistic, forecastConfidence } from './core.js';
import { formatHourLabel, HOUR_MS } from '../../data/syntheticHistory.js';

const DRY_THRESHOLD = 25;
const HORIZON = 12;

const etRate = (temp, hum) => clamp(0.35 + 0.05 * (temp - 24) + 0.01 * (60 - hum), 0.1, 1.2);

export const runAgricultureModel = ({ hourly, readings, now }) => {
    const recent = hourly.slice(-72);
    const soilSeries = recent.map((s) => s.soil_moisture).filter(isNum);
    const tempSeries = recent.map((s) => s.temperature).filter(isNum);
    const humSeries = recent.map((s) => s.humidity).filter(isNum);

    const soil = readings.soil_moisture?.value ?? last(soilSeries) ?? 0;
    const temp = readings.temperature?.value ?? last(tempSeries) ?? 28;
    const hum = readings.humidity?.value ?? last(humSeries) ?? 70;

    // --- Forecast -----------------------------------------------------------
    const et = etRate(temp, hum);
    const etRecent = recent.slice(-12).map((s) => etRate(s.temperature ?? temp, s.humidity ?? hum));
    const etBias = et - (etRecent.length ? etRecent.reduce((a, b) => a + b, 0) / etRecent.length : et);
    const base = holtForecast([...soilSeries.slice(-23), soil], HORIZON, 0.55, 0.15);
    const forecast = base.map((v, i) => clamp(v - etBias * 0.6 * (i + 1), 3, 100));

    const hoursToDry = soil <= DRY_THRESHOLD ? 0 : (() => {
        const idx = forecast.findIndex((v) => v < DRY_THRESHOLD);
        return idx === -1 ? null : idx + 1;
    })();

    const slope24 = trendSlope([...soilSeries.slice(-23), soil]); // % per hour
    const irrigationProb = round(100 * logistic(-(soil - 30) / 6 + (et - 0.5) * 1.5), 0);

    const dryness = clamp((30 - soil) / 25, 0, 1);
    const heat = clamp((temp - 30) / 10, 0, 1);
    const dryAir = clamp((45 - hum) / 25, 0, 1);
    const stress = Math.round(100 * (0.45 * dryness + 0.35 * heat + 0.2 * dryAir));

    const tempAnomaly = zScore(tempSeries.slice(0, -1), temp);
    const diseaseRisk = hum > 88 && temp >= 24 && temp <= 32;

    const soilConfidence = forecastConfidence(soilSeries.slice(-24), 6);

    // --- Alerts -------------------------------------------------------------
    const alerts = [];
    if (soil < 20) {
        alerts.push({ severity: 'critical', metricKey: 'soil_moisture', title: 'Irrigate now', message: `Soil moisture is ${round(soil)} %, below the 20 % wilting margin.` });
    } else if (hoursToDry !== null && hoursToDry <= 6) {
        alerts.push({ severity: 'warning', metricKey: 'soil_moisture', title: 'Irrigation due soon', message: `Model expects soil to drop below ${DRY_THRESHOLD} % in about ${hoursToDry} h.` });
    }
    if (stress >= 60) {
        alerts.push({ severity: 'warning', metricKey: 'temperature', title: 'High crop stress', message: `Crop stress index ${stress}/100 from heat and dry soil.` });
    }
    if (tempAnomaly.anomalous) {
        alerts.push({ severity: 'warning', metricKey: 'temperature', title: 'Temperature anomaly', message: `${round(temp)} °C is ${round(Math.abs(tempAnomaly.z))}σ from the 72 h mean (${round(tempAnomaly.mean)} °C).` });
    }
    if (diseaseRisk) {
        alerts.push({ severity: 'info', metricKey: 'humidity', title: 'Fungal disease window', message: `Humidity ${round(hum)} % with ${round(temp)} °C favours fungal spread. Scout the crop.` });
    }

    // --- Predictions --------------------------------------------------------
    const predictions = [
        { key: 'soil_6h', label: 'Soil moisture in 6 h', value: round(forecast[5]), unit: '%', confidence: soilConfidence, method: 'Holt smoothing + ET' },
        { key: 'soil_12h', label: 'Soil moisture in 12 h', value: round(forecast[11]), unit: '%', confidence: Math.max(40, soilConfidence - 8), method: 'Holt smoothing + ET' },
        { key: 'hours_to_dry', label: `Hours until < ${DRY_THRESHOLD} %`, value: hoursToDry === null ? '> 12' : hoursToDry, unit: 'h', confidence: soilConfidence, method: 'Forecast crossing' },
        { key: 'irrigation_prob', label: 'Irrigation need', value: irrigationProb, unit: '%', confidence: 80, method: 'Logistic model' },
        { key: 'crop_stress', label: 'Crop stress index', value: stress, unit: '/100', confidence: 75, method: 'Weighted index' },
        { key: 'soil_trend', label: 'Moisture trend', value: `${slope24 >= 0 ? '+' : ''}${round(slope24, 2)}`, unit: '%/h', confidence: 70, method: 'Linear regression' }
    ];

    // --- Chart series: last 12 h actual + 12 h forecast ---------------------
    const past = hourly.slice(-12).map((s) => ({ time: formatHourLabel(s.ts), actual: s.soil_moisture ?? null, source: s.source }));
    const lastTs = last(hourly)?.ts ?? now;
    const future = forecast.map((v, i) => ({ time: formatHourLabel(lastTs + (i + 1) * HOUR_MS), forecast: round(v) }));
    if (past.length) past[past.length - 1].forecast = past[past.length - 1].actual;
    const series = [...past, ...future];

    const summary = soil < 20
        ? 'Soil is critically dry – start irrigation.'
        : hoursToDry !== null && hoursToDry <= 6
            ? `Irrigation will be needed within ~${hoursToDry} h.`
            : stress >= 60
                ? 'Crop under heat/moisture stress – consider evening irrigation.'
                : 'Soil water balance is healthy for the next 12 h.';

    return {
        group: 'agriculture',
        label: 'Agriculture',
        methods: ['Holt double-exponential smoothing', 'Evapotranspiration correction', 'Logistic irrigation model', 'z-score anomaly detection'],
        predictions,
        alerts,
        series,
        seriesKeys: { actual: 'Soil moisture', forecast: 'Forecast' },
        unit: '%',
        summary,
        score: 100 - stress
    };
};
