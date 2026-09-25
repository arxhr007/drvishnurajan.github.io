import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ref, onValue, push, set, update, get, query, limitToLast } from 'firebase/database';
import { sensorDb } from '../firebase.config';
import { useVillageSensors } from '../hooks/useVillageSensors';
import { useVillageInsights } from '../hooks/useVillageInsights';
import { useParking } from '../hooks/useParking';
import { buildAlertMessage, sendViaChannel, normalizePhone, formatPhone } from '../utils/alertChannels';
import { getSite } from '../data/villages';

// ---------------------------------------------------------------------------
// Watches every site for critical readings (plus model alerts on the selected
// site and the hospital emergency bay) and sends each one to the configured
// mobile number, once per cooldown window. Every send is recorded in
// alerts/outbox so a relay (npm run alert:relay) or a GSM node can deliver it
// when the browser cannot.
// ---------------------------------------------------------------------------

const AlertDispatchContext = createContext(null);

const keySafe = (key) => String(key).replace(/[.#$[\]/]/g, '_');

// alerts/outbox keeps growing as long as any critical reading stays critical
// (a stuck sensor can queue one row per cooldown window, indefinitely). Trim
// it back to the most recent rows periodically so the database — and the
// root listener every viewer subscribes to — doesn't grow without bound.
const OUTBOX_RETENTION = 60;
const PRUNE_INTERVAL_MS = 30 * 60 * 1000;

const pruneOutbox = async () => {
    try {
        const snap = await get(ref(sensorDb, 'alerts/outbox'));
        const rows = snap.val() || {};
        const ids = Object.keys(rows);
        if (ids.length <= OUTBOX_RETENTION) return;
        const oldestFirst = ids.sort((a, b) => (rows[a]?.ts || 0) - (rows[b]?.ts || 0));
        const toRemove = oldestFirst.slice(0, ids.length - OUTBOX_RETENTION);
        const updates = {};
        toRemove.forEach((id) => { updates[id] = null; });
        await update(ref(sensorDb, 'alerts/outbox'), updates);
    } catch (err) {
        console.error('Outbox prune failed:', err);
    }
};

export const AlertDispatchProvider = ({ children }) => {
    const { villageData, alertConfig, selectedVillageId, loading } = useVillageSensors();
    const { insights, dataSource } = useVillageInsights();
    const { emergencyOccupied, stats: parkingStats, config: parkingConfig, loading: parkingLoading } = useParking();

    const lastSentRef = useRef({});
    const inFlightRef = useRef(new Set());
    const [lastSent, setLastSent] = useState({});
    const [recent, setRecent] = useState([]);

    useEffect(() => {
        const unsubLast = onValue(ref(sensorDb, 'alerts/lastSent'), (snap) => {
            const v = snap.val() || {};
            lastSentRef.current = v;
            setLastSent(v);
        });
        const unsubOutbox = onValue(query(ref(sensorDb, 'alerts/outbox'), limitToLast(20)), (snap) => {
            const v = snap.val() || {};
            setRecent(Object.entries(v).map(([id, row]) => ({ id, ...row })).sort((a, b) => (b.ts || 0) - (a.ts || 0)));
        });
        return () => { unsubLast(); unsubOutbox(); };
    }, []);

    // Keep the outbox bounded so it can never grow without limit
    useEffect(() => {
        pruneOutbox();
        const interval = setInterval(pruneOutbox, PRUNE_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    const dispatch = useCallback(async (candidate, { test = false } = {}) => {
        const phone = normalizePhone(alertConfig.phone);
        if (!phone) return { dispatched: false, note: 'No phone number configured' };
        const key = keySafe(candidate.key);
        if (inFlightRef.current.has(key)) return { dispatched: false, note: 'Already sending' };
        inFlightRef.current.add(key);
        const siteName = getSite(candidate.siteId)?.name || candidate.siteId || 'Gram Vista';
        const text = buildAlertMessage(candidate, siteName);
        const ts = Date.now();
        lastSentRef.current[key] = { ts, title: candidate.title };

        try {
            const row = {
                to: formatPhone(phone),
                name: alertConfig.name || '',
                text,
                key: candidate.key,
                severity: candidate.severity,
                site: candidate.siteId || null,
                metricKey: candidate.metricKey || null,
                ts,
                status: 'pending',
                channel: alertConfig.channel || 'outbox',
                test
            };
            const outRef = push(ref(sensorDb, 'alerts/outbox'));
            await set(outRef, row);
            if (!test) await set(ref(sensorDb, `alerts/lastSent/${key}`), { ts, title: candidate.title });
            const result = await sendViaChannel(alertConfig, text);
            await update(outRef, { status: result.dispatched ? 'sent-by-browser' : 'pending', note: result.note || '' });
            return result;
        } catch (err) {
            console.error('Alert dispatch failed:', err);
            return { dispatched: false, note: err?.message || 'Dispatch failed' };
        } finally {
            inFlightRef.current.delete(key);
        }
    }, [alertConfig]);

    // Collect candidates and send those outside their cooldown
    useEffect(() => {
        if (loading || !alertConfig.enabled || !normalizePhone(alertConfig.phone)) return;
        const wantWarnings = !!alertConfig.includeWarnings;
        const matches = (sev) => sev === 'critical' || (wantWarnings && sev === 'warning');
        const candidates = [];

        Object.entries(villageData).forEach(([siteId, entry]) => {
            Object.values(entry.readings).forEach((r) => {
                if (r.value === null || r.value === undefined || !matches(r.status)) return;
                candidates.push({
                    key: `${siteId}:${r.key}:${r.status}`,
                    severity: r.status,
                    siteId,
                    metricKey: r.key,
                    title: `${r.label} ${r.status === 'critical' ? 'critical' : 'out of range'}`,
                    message: `${r.message} (now ${r.binary ? (r.value ? 'ON' : 'OFF') : `${r.value} ${r.unit}`.trim()})${r.zoneName ? ` at ${r.zoneName}` : ''}`
                });
            });
        });

        if (dataSource !== 'synthetic') {
            insights.alerts.filter((a) => matches(a.severity)).forEach((a) => {
                candidates.push({ key: `${selectedVillageId}:model:${a.metricKey}:${a.title}`, severity: a.severity, siteId: selectedVillageId, metricKey: a.metricKey, title: a.title, message: a.message });
            });
        }

        if (!parkingLoading && emergencyOccupied) {
            candidates.push({
                key: 'parking:emergency',
                severity: 'critical',
                siteId: 'campus',
                metricKey: 'parking_emergency',
                title: 'Emergency bay occupied',
                message: `${parkingConfig.name}: ambulance bay ${parkingStats.emergency?.bay} is blocked. Clear it immediately.`
            });
        }

        const cooldownMs = Math.max(1, Number(alertConfig.cooldownMinutes) || 30) * 60 * 1000;
        const now = Date.now();
        candidates.forEach((c) => {
            const last = lastSentRef.current[keySafe(c.key)];
            const lastTs = last && typeof last === 'object' ? Number(last.ts) : Number(last);
            if (lastTs && now - lastTs < cooldownMs) return;
            dispatch(c);
        });
    }, [villageData, insights.alerts, emergencyOccupied, alertConfig, loading, parkingLoading, dataSource, selectedVillageId, parkingConfig.name, parkingStats.emergency, dispatch]);

    const sendTest = useCallback(() => dispatch({
        key: `test:${Date.now()}`,
        severity: 'info',
        siteId: selectedVillageId,
        title: 'Test alert',
        message: 'Mobile alerts from the Gram Vista dashboard are configured correctly.'
    }, { test: true }), [dispatch, selectedVillageId]);

    const value = useMemo(() => ({ sendTest, recent, lastSent }), [sendTest, recent, lastSent]);
    return <AlertDispatchContext.Provider value={value}>{children}</AlertDispatchContext.Provider>;
};

export const useAlertDispatch = () => {
    const ctx = useContext(AlertDispatchContext);
    if (!ctx) throw new Error('useAlertDispatch must be used within an AlertDispatchProvider');
    return ctx;
};
