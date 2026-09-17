import { useEffect, useMemo, useState } from 'react';
import { useVillageSensors } from './useVillageSensors';
import { generateSyntheticHistory, buildHourlySeries, HOUR_MS } from '../data/syntheticHistory';
import { SENSOR_METRICS, evaluateMetric } from '../data/sensorSchema';
import { runVillageModels } from '../utils/ml';
import { sortAlerts } from '../utils/ml/core';
import { formatTimeIST } from '../utils/timeUtils';

const EMPTY = [];

/**
 * Village analytics: merges the synthetic 7-day baseline with live samples
 * from Firebase, fills gaps in the current readings from the baseline, and
 * runs the agriculture / water / energy models.
 */
export const useVillageInsights = () => {
    const { selectedVillage, selectedVillageId, readings, liveSamples, hasData, connected } = useVillageSensors();

    // Re-anchor the synthetic baseline every hour so it always ends "now"
    const [hourKey, setHourKey] = useState(() => Math.floor(Date.now() / HOUR_MS));
    useEffect(() => {
        const id = setInterval(() => setHourKey(Math.floor(Date.now() / HOUR_MS)), 60 * 1000);
        return () => clearInterval(id);
    }, []);

    const synthetic = useMemo(
        () => generateSyntheticHistory(selectedVillageId, { endTime: hourKey * HOUR_MS }),
        [selectedVillageId, hourKey]
    );

    const villageLive = liveSamples[selectedVillageId] || EMPTY;
    const hourly = useMemo(() => buildHourlySeries(synthetic, villageLive), [synthetic, villageLive]);
    const baseline = hourly[hourly.length - 1];

    // Live reading when present, otherwise the latest baseline value (tagged)
    const effectiveReadings = useMemo(() => {
        const out = {};
        SENSOR_METRICS.forEach((metric) => {
            const live = readings[metric.key];
            if (live && live.value !== null && live.value !== undefined) {
                out[metric.key] = { ...live, source: 'live' };
                return;
            }
            const value = baseline?.[metric.key] ?? null;
            out[metric.key] = {
                ...metric,
                ...live,
                value,
                ...evaluateMetric(metric, value),
                source: 'synthetic',
                lastUpdated: baseline ? formatTimeIST(new Date(baseline.ts)) : null,
                history: live?.history || []
            };
        });
        return out;
    }, [readings, baseline]);

    const liveCount = useMemo(
        () => Object.values(effectiveReadings).filter((r) => r.source === 'live').length,
        [effectiveReadings]
    );
    const dataSource = liveCount === SENSOR_METRICS.length ? 'live' : liveCount > 0 ? 'mixed' : 'synthetic';

    const insights = useMemo(
        () => runVillageModels({ hourly, readings: effectiveReadings, now: Date.now() }),
        [hourly, effectiveReadings]
    );

    // Threshold alerts from the readings themselves + model alerts
    const alerts = useMemo(() => {
        const threshold = Object.values(effectiveReadings)
            .filter((r) => r.status === 'critical' || r.status === 'warning')
            .map((r) => ({
                id: `threshold-${r.key}`,
                severity: r.status,
                group: r.group,
                metricKey: r.key,
                title: `${r.label} ${r.status === 'critical' ? 'critical' : 'out of range'}`,
                message: `${r.message} (now ${r.binary ? (r.value ? 'ON' : 'OFF') : `${r.value} ${r.unit}`.trim()}).`,
                source: 'threshold'
            }));
        const seen = new Set();
        return sortAlerts([...insights.alerts, ...threshold]).filter((a) => {
            const key = `${a.metricKey}:${a.severity}:${a.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [effectiveReadings, insights.alerts]);

    const recent24h = useMemo(() => hourly.slice(-24), [hourly]);

    return {
        village: selectedVillage,
        villageId: selectedVillageId,
        hourly,
        recent24h,
        synthetic,
        liveSamples: villageLive,
        effectiveReadings,
        insights,
        alerts,
        liveCount,
        dataSource,
        hasLiveData: hasData,
        connected
    };
};
