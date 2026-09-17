// ---------------------------------------------------------------------------
// Water-management model
//  • Tank depletion / refill: least-squares regression on the last 12 h of tank
//    level gives %/h and the time to the 20 % (low) and 10 % (critical) marks.
//  • Flood risk: logistic score from rain intensity, 3 h rain accumulation and
//    dam level.
//  • Water Quality Index (WQI): penalty model on pH deviation and turbidity.
//  • Rain nowcast: Holt smoothing on the last 12 h of rain intensity.
//  • Anomaly detection: z-score of turbidity vs the last 72 h.
// ---------------------------------------------------------------------------
import { clamp, round, isNum, last, mean, sum, linearRegression, holtForecast, zScore, logistic, forecastConfidence } from './core.js';
import { formatHourLabel, HOUR_MS } from '../../data/syntheticHistory.js';

const HORIZON = 12;

export const waterQualityIndex = (ph, turbidity) => clamp(100 - 15 * Math.abs(ph - 7.2) - 5 * turbidity, 0, 100);

export const wqiGrade = (wqi) => (wqi >= 85 ? 'Excellent' : wqi >= 70 ? 'Good' : wqi >= 50 ? 'Fair' : 'Poor');

export const runWaterModel = ({ hourly, readings, now }) => {
    const recent = hourly.slice(-72);
    const tankSeries = recent.map((s) => s.water_level_tank).filter(isNum);
    const rainSeries = recent.map((s) => s.rain_intensity).filter(isNum);
    const turbSeries = recent.map((s) => s.turbidity).filter(isNum);
    const pumpSeries = recent.slice(-24).map((s) => s.pump).filter(isNum);

    const tank = readings.water_level_tank?.value ?? last(tankSeries) ?? 50;
    const dam = readings.water_level_dam?.value ?? last(recent.map((s) => s.water_level_dam).filter(isNum)) ?? 60;
    const rain = readings.rain_intensity?.value ?? last(rainSeries) ?? 0;
    const ph = readings.ph?.value ?? last(recent.map((s) => s.ph).filter(isNum)) ?? 7.1;
    const turbidity = readings.turbidity?.value ?? last(turbSeries) ?? 2;
    const pumpOn = (readings.pump?.value ?? last(pumpSeries) ?? 0) === 1;

    // --- Tank dynamics --------------------------------------------------------
    const window = [...tankSeries.slice(-11), tank];
    const { slope, r2 } = linearRegression(window.map((_, i) => i), window); // % per hour
    const tankForecast = Array.from({ length: HORIZON }, (_, i) => clamp(tank + slope * (i + 1), 0, 100));
    const hoursToLow = slope < -0.05 && tank > 20 ? round((tank - 20) / -slope, 1) : tank <= 20 ? 0 : null;
    const hoursToEmpty = slope < -0.05 && tank > 10 ? round((tank - 10) / -slope, 1) : null;
    const hoursToFull = slope > 0.05 && tank < 95 ? round((95 - tank) / slope, 1) : null;

    // --- Flood risk -----------------------------------------------------------
    const rain3h = sum(rainSeries.slice(-2)) + rain;
    const floodRisk = Math.round(100 * logistic(0.06 * (rain - 20) + 0.04 * (rain3h - 40) + 0.12 * (dam - 82)));
    const rainForecast = holtForecast([...rainSeries.slice(-11), rain], 6, 0.5, 0.2).map((v) => clamp(v, 0, 120));
    const expectedRain3h = round(sum(rainForecast.slice(0, 3)), 1);

    // --- Water quality --------------------------------------------------------
    const wqi = Math.round(waterQualityIndex(ph, turbidity));
    const grade = wqiGrade(wqi);
    const turbAnomaly = zScore(turbSeries.slice(0, -1), turbidity);
    const pumpDuty = pumpSeries.length ? Math.round(100 * mean(pumpSeries)) : 0;

    // --- Alerts ---------------------------------------------------------------
    const alerts = [];
    if (floodRisk >= 60) {
        alerts.push({ severity: 'critical', metricKey: 'water_level_dam', title: 'Flood risk high', message: `Flood risk ${floodRisk} % – rain ${round(rain)} mm/h with dam at ${round(dam)} %. Prepare spillway release.` });
    } else if (floodRisk >= 40) {
        alerts.push({ severity: 'warning', metricKey: 'water_level_dam', title: 'Flood watch', message: `Flood risk ${floodRisk} %. Monitor dam level and rainfall.` });
    }
    if (tank <= 20) {
        alerts.push({ severity: tank <= 10 ? 'critical' : 'warning', metricKey: 'water_level_tank', title: 'Tank level low', message: `Overhead tank at ${round(tank)} %${pumpOn ? ' – pump already running.' : ' – switch the pump ON.'}` });
    } else if (hoursToLow !== null && hoursToLow <= 6 && !pumpOn) {
        alerts.push({ severity: 'warning', metricKey: 'water_level_tank', title: 'Tank will run low', message: `Draining at ${round(-slope, 2)} %/h – below 20 % in ~${hoursToLow} h. Schedule the pump.` });
    }
    if (pumpOn && tank >= 96) {
        alerts.push({ severity: 'warning', metricKey: 'pump', title: 'Tank overflow risk', message: 'Pump is ON with the tank nearly full. Switch it OFF.' });
    }
    if (turbAnomaly.anomalous && turbidity > turbAnomaly.mean) {
        alerts.push({ severity: 'warning', metricKey: 'turbidity', title: 'Turbidity spike', message: `${round(turbidity)} NTU is ${round(Math.abs(turbAnomaly.z))}σ above the 72 h mean. Check intake filtration.` });
    }
    if (wqi < 50) {
        alerts.push({ severity: 'critical', metricKey: 'ph', title: 'Poor water quality', message: `WQI ${wqi} (pH ${round(ph, 2)}, turbidity ${round(turbidity)} NTU). Treatment recommended before use.` });
    } else if (wqi < 70) {
        alerts.push({ severity: 'info', metricKey: 'ph', title: 'Water quality fair', message: `WQI ${wqi}. Keep monitoring pH and turbidity.` });
    }

    // --- Predictions ----------------------------------------------------------
    const tankConfidence = Math.round(clamp(45 + 50 * r2, 45, 92));
    const predictions = [
        { key: 'tank_6h', label: 'Tank level in 6 h', value: round(tankForecast[5]), unit: '%', confidence: tankConfidence, method: 'Linear regression' },
        { key: 'hours_to_low', label: 'Hours until tank < 20 %', value: hoursToLow === null ? (slope >= -0.05 ? 'Stable' : '> 12') : hoursToLow, unit: hoursToLow === null ? '' : 'h', confidence: tankConfidence, method: 'Linear regression' },
        { key: 'flood_risk', label: 'Flood risk (next 6 h)', value: floodRisk, unit: '%', confidence: 72, method: 'Logistic risk model' },
        { key: 'rain_3h', label: 'Expected rain next 3 h', value: expectedRain3h, unit: 'mm', confidence: forecastConfidence(rainSeries.slice(-12), 3), method: 'Holt smoothing' },
        { key: 'wqi', label: 'Water Quality Index', value: wqi, unit: `/100 · ${grade}`, confidence: 85, method: 'Penalty index' },
        { key: 'pump_duty', label: 'Pump duty (24 h)', value: pumpDuty, unit: '%', confidence: 90, method: 'Duty-cycle analysis' }
    ];
    if (hoursToFull !== null) {
        predictions.splice(1, 0, { key: 'hours_to_full', label: 'Hours until tank full', value: hoursToFull, unit: 'h', confidence: tankConfidence, method: 'Linear regression' });
    }

    // --- Chart series ---------------------------------------------------------
    const past = hourly.slice(-12).map((s) => ({ time: formatHourLabel(s.ts), actual: s.water_level_tank ?? null, rain: s.rain_intensity ?? 0, source: s.source }));
    const lastTs = last(hourly)?.ts ?? now;
    const future = tankForecast.map((v, i) => ({ time: formatHourLabel(lastTs + (i + 1) * HOUR_MS), forecast: round(v), rain: i < rainForecast.length ? round(rainForecast[i]) : 0 }));
    if (past.length) past[past.length - 1].forecast = past[past.length - 1].actual;
    const series = [...past, ...future];

    const summary = floodRisk >= 60
        ? 'Flood risk is high – dam and rainfall need attention.'
        : tank <= 20
            ? 'Overhead tank is low – run the pump.'
            : hoursToLow !== null && hoursToLow <= 6
                ? `Tank will need refilling in ~${hoursToLow} h.`
                : `Water supply stable; quality ${grade.toLowerCase()} (WQI ${wqi}).`;

    return {
        group: 'water',
        label: 'Water Management',
        methods: ['Least-squares tank regression', 'Logistic flood-risk model', 'Water Quality Index', 'Holt rain nowcast', 'z-score anomaly detection'],
        predictions,
        alerts,
        series,
        seriesKeys: { actual: 'Tank level', forecast: 'Forecast', rain: 'Rain (mm/h)' },
        unit: '%',
        summary,
        score: Math.round(clamp((wqi + (100 - floodRisk) + clamp(tank, 0, 100)) / 3, 0, 100)),
        hoursToEmpty
    };
};
