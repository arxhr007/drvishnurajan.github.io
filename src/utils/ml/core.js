// ---------------------------------------------------------------------------
// Lightweight statistical / machine-learning primitives used by the village
// models. Everything runs in the browser on the hourly series, so the
// algorithms are deliberately small: least-squares regression, Holt's double
// exponential smoothing, hour-of-day seasonal profiles, z-score anomaly
// detection and logistic risk scoring.
// ---------------------------------------------------------------------------
import { istHourOf } from '../../data/syntheticHistory.js';

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const round = (v, d = 1) => (isNum(v) ? Math.round(v * 10 ** d) / 10 ** d : v);
export const last = (arr) => (arr.length ? arr[arr.length - 1] : undefined);

export const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
export const sum = (arr) => arr.reduce((s, v) => s + v, 0);

export const std = (arr) => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
};

/** Ordinary least squares y = slope * x + intercept, with R². */
export const linearRegression = (xs, ys) => {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0, n };
    const mx = mean(xs.slice(0, n));
    const my = mean(ys.slice(0, n));
    let sxy = 0; let sxx = 0; let syy = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx; const dy = ys[i] - my;
        sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    const slope = sxx ? sxy / sxx : 0;
    const intercept = my - slope * mx;
    const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
    return { slope, intercept, r2, n };
};

/** Trend of an evenly spaced series, in units per step. */
export const trendSlope = (values) => linearRegression(values.map((_, i) => i), values).slope;

/**
 * Holt's double exponential smoothing (level + trend). Returns `horizon`
 * forecasts one step apart.
 */
export const holtForecast = (values, horizon, alpha = 0.5, beta = 0.3) => {
    const v = values.filter(isNum);
    if (v.length === 0) return Array(horizon).fill(0);
    if (v.length === 1) return Array(horizon).fill(v[0]);
    let level = v[0];
    let trend = v[1] - v[0];
    for (let i = 1; i < v.length; i++) {
        const prevLevel = level;
        level = alpha * v[i] + (1 - alpha) * (level + trend);
        trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }
    return Array.from({ length: horizon }, (_, k) => level + (k + 1) * trend);
};

/** Simple exponential smoothing of the latest level. */
export const smoothedLevel = (values, alpha = 0.4) => {
    const v = values.filter(isNum);
    if (!v.length) return 0;
    return v.reduce((level, x, i) => (i === 0 ? x : alpha * x + (1 - alpha) * level), v[0]);
};

/**
 * Average value for each hour of the day (IST) across the sample set.
 * Missing hours are linearly interpolated so the profile is always complete.
 */
export const hourOfDayProfile = (samples, key) => {
    const sums = Array(24).fill(0);
    const counts = Array(24).fill(0);
    samples.forEach((s) => {
        const v = s[key];
        if (!isNum(v)) return;
        const h = Math.floor(istHourOf(s.ts)) % 24;
        sums[h] += v;
        counts[h] += 1;
    });
    const profile = sums.map((s, h) => (counts[h] ? s / counts[h] : null));
    for (let h = 0; h < 24; h++) {
        if (profile[h] !== null) continue;
        let prev = h; let next = h;
        while (profile[prev] === null && prev !== (h + 1) % 24) prev = (prev + 23) % 24;
        while (profile[next] === null && next !== (h + 23) % 24) next = (next + 1) % 24;
        profile[h] = profile[prev] === null ? 0 : profile[next] === null ? profile[prev] : (profile[prev] + profile[next]) / 2;
    }
    return profile;
};

/** z-score of `latest` against a reference window. */
export const zScore = (window, latest) => {
    const w = window.filter(isNum);
    const m = mean(w);
    const s = std(w);
    if (!s || !isNum(latest)) return { z: 0, anomalous: false, mean: m, std: s };
    const z = (latest - m) / s;
    return { z, anomalous: Math.abs(z) > 2.5, mean: m, std: s };
};

export const logistic = (x) => 1 / (1 + Math.exp(-x));

/**
 * Heuristic confidence (40–95 %) for a forecast: penalises volatile series and
 * short histories.
 */
export const forecastConfidence = (values, horizonSteps = 1) => {
    const v = values.filter(isNum);
    if (v.length < 4) return 45;
    const m = Math.abs(mean(v)) || 1;
    const cv = std(v) / m;
    const base = 95 - clamp(cv, 0, 1) * 45 - horizonSteps * 1.5;
    return Math.round(clamp(base, 40, 95));
};

export const severityRank = { critical: 3, warning: 2, info: 1 };

export const sortAlerts = (alerts) => [...alerts].sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0));
