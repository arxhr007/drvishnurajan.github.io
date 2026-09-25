import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useVillageSensors } from '../hooks/useVillageSensors';
import { fetchUbidotsBins, classifyBin, fillRatePerHour, ubidotsLiveUrl, DEFAULT_UBIDOTS_CONFIG } from '../utils/ubidots';
import { SITES, CAMPUS_ID, zonesOf, resolveZoneCenter } from '../data/villages';
import { formatTimeIST } from '../utils/timeUtils';

// ---------------------------------------------------------------------------
// LoRaWAN waste bins from Ubidots, polled directly by the browser. Bins are
// attached to a site and a block/area by matching their Ubidots name
// ("Bin #001 - bio block" → campus / Bio Block); an admin can override the
// match from Site & Alerts (config/sensorPlacement, key "ubidots~<label>").
// The sensor database may also carry bins under waste/bins/<label> (for a
// gateway that writes straight to Firebase); those are merged by label.
// ---------------------------------------------------------------------------

const WasteBinsContext = createContext(null);

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const haversineKm = (a, b) => {
    if (!a || !b) return null;
    const R = 6371; const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]); const dLng = toRad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

/** Site + zone for a bin from its name, unless an admin placed it explicitly. */
const placeBin = (bin, placement, zoneOverrides) => {
    const placed = placement?.[`ubidots~${bin.label}`];
    let site = placed?.site ? SITES.find((s) => s.id === placed.site) : null;
    let zoneId = placed?.zone || null;

    const nameKey = norm(bin.name) + norm(bin.label);
    if (!site) {
        site = SITES.find((s) => s.id !== CAMPUS_ID && (nameKey.includes(norm(s.name)) || nameKey.includes(norm(s.id))))
            || SITES.find((s) => s.id === CAMPUS_ID);
    }
    if (!zoneId) {
        const zone = zonesOf(site).find((z) => {
            const zk = norm(z.name); const idk = norm(z.id);
            return (zk.length >= 4 && nameKey.includes(zk)) || (idk.length >= 4 && nameKey.includes(idk));
        });
        zoneId = zone ? zone.id : null;
    }
    const zone = zonesOf(site).find((z) => z.id === zoneId) || null;
    const zoneCenter = zone ? resolveZoneCenter(site, zone.id, zoneOverrides) : null;

    // Use the node's GPS only when it is plausibly inside the site; otherwise draw it in its block
    const gps = bin.lat !== null && bin.lng !== null ? [bin.lat, bin.lng] : null;
    const distanceKm = gps && site?.center ? haversineKm(gps, site.center) : null;
    const gpsPlausible = gps && distanceKm !== null && distanceKm <= 1.5;
    const coords = gpsPlausible ? gps : (zoneCenter || site?.center || gps);

    return {
        siteId: site?.id || CAMPUS_ID,
        siteName: site?.name || 'Sahrdaya Campus',
        zoneId: zone?.id || null,
        zoneName: zone?.name || null,
        coords,
        coordsSource: gpsPlausible ? 'device' : zoneCenter ? 'zone' : 'site',
        gpsDistanceKm: distanceKm,
        placed: !!placed
    };
};

export const WasteBinsProvider = ({ children }) => {
    const { placement, zoneOverrides, ubidotsConfig, firebaseBins } = useVillageSensors();
    const [raw, setRaw] = useState({ bins: [], fetchedAt: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);
    const timerRef = useRef(null);

    const config = useMemo(() => ({ ...DEFAULT_UBIDOTS_CONFIG, ...(ubidotsConfig || {}) }), [ubidotsConfig]);

    const refresh = useCallback(async () => {
        if (!config.enabled) { setLoading(false); return; }
        try {
            const result = await fetchUbidotsBins(config);
            setRaw(result);
            setError(null);
        } catch (err) {
            console.error('Ubidots fetch failed:', err);
            setError(err?.message || 'Ubidots fetch failed');
        } finally {
            setLoading(false);
        }
    }, [config]);

    useEffect(() => {
        refresh();
        const seconds = Math.max(15, Number(config.pollSeconds) || 60);
        timerRef.current = setInterval(refresh, seconds * 1000);
        const minuteTick = setInterval(() => setTick((t) => t + 1), 60 * 1000); // re-evaluate "offline" without refetching
        return () => { clearInterval(timerRef.current); clearInterval(minuteTick); };
    }, [refresh, config.pollSeconds]);

    const bins = useMemo(() => {
        const now = Date.now();
        const offlineMs = Math.max(1, Number(config.offlineAfterMinutes) || 30) * 60 * 1000;
        const byLabel = new Map();

        raw.bins.forEach((bin) => byLabel.set(bin.label, { ...bin, source: 'ubidots' }));
        Object.entries(firebaseBins || {}).forEach(([label, fb]) => {
            if (!fb || typeof fb !== 'object') return;
            const existing = byLabel.get(label) || { label, name: fb.name || label, variables: [], history: [], source: 'firebase' };
            const ts = typeof fb.timestamp === 'number' ? (fb.timestamp < 1e12 ? fb.timestamp * 1000 : fb.timestamp) : existing.lastActivity;
            byLabel.set(label, {
                ...existing,
                name: existing.name || fb.name || label,
                fillPct: typeof fb.fillPct === 'number' ? fb.fillPct : typeof fb.fill_pct === 'number' ? fb.fill_pct : existing.fillPct ?? null,
                status: fb.status || existing.status || null,
                lat: typeof fb.lat === 'number' ? fb.lat : existing.lat ?? null,
                lng: typeof fb.lng === 'number' ? fb.lng : existing.lng ?? null,
                lastActivity: ts || existing.lastActivity || null,
                source: existing.source === 'ubidots' ? 'ubidots+firebase' : 'firebase'
            });
        });

        return [...byLabel.values()].map((bin) => {
            const placement_ = placeBin(bin, placement, zoneOverrides);
            const cls = classifyBin(bin, config.fullAlertPct);
            const online = bin.lastActivity ? now - bin.lastActivity < offlineMs : false;
            const rate = fillRatePerHour(bin.history);
            const hoursToFull = rate && rate > 0 && bin.fillPct !== null ? Math.max(0, (100 - bin.fillPct) / rate) : null;
            return {
                ...bin,
                ...placement_,
                state: cls.state,
                stateLabel: cls.label,
                online,
                lastSeen: bin.lastActivity ? formatTimeIST(new Date(bin.lastActivity)) : null,
                lastSeenAgoMin: bin.lastActivity ? Math.round((now - bin.lastActivity) / 60000) : null,
                fillRatePerHour: rate,
                hoursToFull,
                sparkline: (bin.history || []).slice(-24).map((h) => ({ t: h.ts, v: h.value }))
            };
        }).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }, [raw, firebaseBins, placement, zoneOverrides, config.offlineAfterMinutes, config.fullAlertPct, tick]); // eslint-disable-line react-hooks/exhaustive-deps

    const stats = useMemo(() => ({
        total: bins.length,
        online: bins.filter((b) => b.online).length,
        critical: bins.filter((b) => b.state === 'critical').length,
        warning: bins.filter((b) => b.state === 'warning').length,
        avgFill: bins.length ? Math.round(bins.reduce((s, b) => s + (b.fillPct || 0), 0) / bins.length) : 0
    }), [bins]);

    const binsForSite = useCallback((siteId) => bins.filter((b) => b.siteId === siteId), [bins]);

    const value = useMemo(() => ({
        bins, stats, binsForSite, loading, error, config,
        fetchedAt: raw.fetchedAt,
        fetchedAtLabel: raw.fetchedAt ? formatTimeIST(new Date(raw.fetchedAt)) : null,
        dashboardUrl: config.dashboardUrl,
        liveUrl: ubidotsLiveUrl(config.dashboardUrl),
        refresh
    }), [bins, stats, binsForSite, loading, error, config, raw.fetchedAt, refresh]);

    return <WasteBinsContext.Provider value={value}>{children}</WasteBinsContext.Provider>;
};

export const useWasteBins = () => {
    const ctx = useContext(WasteBinsContext);
    if (!ctx) throw new Error('useWasteBins must be used within a WasteBinsProvider');
    return ctx;
};
