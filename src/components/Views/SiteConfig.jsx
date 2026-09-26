import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, MapPinned, Save, Send, Smartphone, Landmark, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useVillageSensors } from '../../hooks/useVillageSensors';
import { useAlertDispatch } from '../../context/AlertDispatchContext';
import { useWasteBins } from '../../hooks/useWasteBins';
import { useAuth } from '../../context/AuthContext';
import { DashboardCard } from '../Shared/DashboardCard';
import { zonesOf, getSite, resolveZoneCenter } from '../../data/villages';
import { ALERT_CHANNELS, DEFAULT_ALERT_CONFIG, normalizePhone, formatPhone } from '../../utils/alertChannels';
import { formatTimeIST } from '../../utils/timeUtils';

const inputCls = 'mt-1 w-full p-2 rounded-lg border border-slate-200 bg-white text-sm disabled:bg-slate-50 disabled:text-slate-500';
const labelCls = 'block text-xs font-semibold text-slate-600';

const SaveBar = ({ dirty, saving, error, ok, onSave, onReset, label = 'Save' }) => (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
        {error && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {error}</span>}
        {ok && !dirty && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> Saved to Firebase</span>}
        {onReset && (
            <button onClick={onReset} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50">
                <RotateCcw size={13} /> Discard
            </button>
        )}
        <button onClick={onSave} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-blue-700">
            <Save size={13} /> {saving ? 'Saving…' : label}
        </button>
    </div>
);

const useSaver = (fn) => {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [ok, setOk] = useState(false);
    const run = async (...args) => {
        setSaving(true); setError(null); setOk(false);
        try { await fn(...args); setOk(true); }
        catch (err) { setError(err?.message || 'Save failed'); }
        finally { setSaving(false); }
    };
    return { run, saving, error, ok };
};

// ── Telemetry sources (Firebase databases) ───────────────────────────────────
const SourcesCard = ({ canEdit }) => {
    const { sources, sites, parkingSourceId, saveSources, saveParkingSource } = useVillageSensors();
    const [draft, setDraft] = useState({});
    const [parking, setParking] = useState(parkingSourceId);
    const [newId, setNewId] = useState('');
    const [newUrl, setNewUrl] = useState('');
    useEffect(() => { setDraft({}); }, [sources]);
    useEffect(() => { setParking(parkingSourceId); }, [parkingSourceId]);

    const rowValue = (s) => ({ label: s.label, url: s.url, site: s.site, priority: s.priority, enabled: s.enabled, ignoreKeys: (s.ignoreKeys || []).join(', '), ...(draft[s.id] || {}) });
    const setRow = (id, patch) => setDraft((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));
    const dirty = Object.keys(draft).length > 0 || parking !== parkingSourceId || (newId.trim() && newUrl.trim());

    const saver = useSaver(async () => {
        const entries = {};
        Object.entries(draft).forEach(([id, v]) => {
            const base = sources.find((s) => s.id === id) || {};
            const merged = { ...rowValue(base), ...v };
            entries[id] = {
                label: merged.label, url: merged.url, site: merged.site, priority: Number(merged.priority) || 0, enabled: !!merged.enabled,
                ignoreKeys: String(merged.ignoreKeys || '').split(',').map((k) => k.trim()).filter(Boolean)
            };
        });
        if (newId.trim() && newUrl.trim()) {
            entries[newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')] = { label: newId.trim(), url: newUrl.trim().replace(/\/+$/, ''), site: sites[0]?.id || 'campus', priority: 50, enabled: true, ignoreKeys: [] };
        }
        if (Object.keys(entries).length) await saveSources(entries);
        if (parking !== parkingSourceId) await saveParkingSource(parking);
        setDraft({}); setNewId(''); setNewUrl('');
    });

    return (
        <DashboardCard title="Telemetry sources (Firebase databases)">
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Every database the field nodes write to. Readings from all enabled sources are merged; when the same sensor exists in more than one,
                    the <b>lowest priority number wins</b>. Each source has a default owner site for readings that are not placed explicitly.
                    Relay commands are written back to the database the reading came from. Saved to <span className="font-mono">config/sources</span>.
                </p>
                <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-left text-slate-500 uppercase tracking-wider text-[10px]">
                                <th className="px-2 py-1">Source</th><th className="px-2 py-1">Database URL</th><th className="px-2 py-1">Owner site</th><th className="px-2 py-1">Priority</th><th className="px-2 py-1">On</th><th className="px-2 py-1">Parking</th><th className="px-2 py-1">Ignore root keys</th><th className="px-2 py-1">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sources.map((s) => {
                                const v = rowValue(s);
                                return (
                                    <tr key={s.id} className={`border-t border-slate-100 align-top ${draft[s.id] ? 'bg-amber-50/60' : ''}`}>
                                        <td className="px-2 py-1.5">
                                            <p className="font-mono text-[11px] text-slate-700">{s.id}{s.primary ? <span className="ml-1 text-[9px] uppercase font-bold text-indigo-700">primary</span> : null}</p>
                                            <input type="text" value={v.label} disabled={!canEdit} onChange={(e) => setRow(s.id, { label: e.target.value })} className="mt-1 w-44 p-1 rounded border border-slate-200 bg-white text-[11px] disabled:bg-slate-50" />
                                        </td>
                                        <td className="px-2 py-1.5"><input type="url" value={v.url} disabled={!canEdit || s.primary} onChange={(e) => setRow(s.id, { url: e.target.value })} className="w-72 p-1 rounded border border-slate-200 bg-white font-mono text-[11px] disabled:bg-slate-50" /></td>
                                        <td className="px-2 py-1.5">
                                            <select value={v.site} disabled={!canEdit} onChange={(e) => setRow(s.id, { site: e.target.value })} className="p-1 rounded border border-slate-200 bg-white text-[11px] disabled:bg-slate-50">
                                                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-2 py-1.5"><input type="number" value={v.priority} disabled={!canEdit} onChange={(e) => setRow(s.id, { priority: Number(e.target.value) })} className="w-16 p-1 rounded border border-slate-200 bg-white text-[11px] disabled:bg-slate-50" /></td>
                                        <td className="px-2 py-1.5"><input type="checkbox" checked={!!v.enabled} disabled={!canEdit || s.primary} onChange={(e) => setRow(s.id, { enabled: e.target.checked })} /></td>
                                        <td className="px-2 py-1.5"><input type="radio" name="parking-source" checked={parking === s.id} disabled={!canEdit} onChange={() => setParking(s.id)} /></td>
                                        <td className="px-2 py-1.5"><input type="text" value={v.ignoreKeys} disabled={!canEdit} onChange={(e) => setRow(s.id, { ignoreKeys: e.target.value })} placeholder="e.g. Water, test" className="w-32 p-1 rounded border border-slate-200 bg-white text-[11px] disabled:bg-slate-50" /></td>
                                        <td className="px-2 py-1.5 whitespace-nowrap">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{s.connected ? 'connected' : s.enabled ? 'no data' : 'off'}</span>
                                            <p className="text-[10px] text-slate-500 mt-1">{s.lastChangeAt ? `node wrote ${formatTimeIST(s.lastChangeAt)}` : 'no node writes since page opened'}</p>
                                            {s.rootKeys.length > 0 && <p className="text-[10px] text-slate-400 mt-1 max-w-[180px] truncate" title={s.rootKeys.join(', ')}>{s.rootKeys.join(', ')}</p>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <label className={labelCls}>Add a database<input type="text" value={newId} disabled={!canEdit} onChange={(e) => setNewId(e.target.value)} placeholder="source id (e.g. rps-project-3)" className={`${inputCls} w-52`} /></label>
                    <label className={`${labelCls} flex-1 min-w-[260px]`}>URL<input type="url" value={newUrl} disabled={!canEdit} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://<project>-default-rtdb.<region>.firebasedatabase.app" className={inputCls} /></label>
                </div>
                <SaveBar dirty={!!dirty && canEdit} saving={saver.saving} error={saver.error} ok={saver.ok} onSave={saver.run} onReset={() => { setDraft({}); setParking(parkingSourceId); setNewId(''); setNewUrl(''); }} label="Save sources" />
            </div>
        </DashboardCard>
    );
};

// ── Sensor placement ──────────────────────────────────────────────────────────
const PlacementCard = ({ canEdit }) => {
    const { sensorPaths, sites, placement, prototypeSiteId, savePlacement, savePrototypeSite } = useVillageSensors();
    const [draft, setDraft] = useState({});
    const [proto, setProto] = useState(prototypeSiteId);
    useEffect(() => { setDraft({}); }, [placement]);
    useEffect(() => { setProto(prototypeSiteId); }, [prototypeSiteId]);

    const rowValue = (entry) => draft[entry.key] || { site: entry.siteId, zone: entry.zoneId };
    const setRow = (entry, patch) => setDraft((d) => {
        const current = rowValue(entry);
        const next = { ...current, ...patch };
        if (patch.site && patch.site !== current.site) {
            const site = getSite(patch.site);
            next.zone = entry.metric?.defaultZone?.[site?.type] || zonesOf(site)[0]?.id || null;
        }
        return { ...d, [entry.key]: next };
    });

    const dirty = Object.keys(draft).length > 0 || proto !== prototypeSiteId;
    const saver = useSaver(async () => {
        if (proto !== prototypeSiteId) await savePrototypeSite(proto);
        if (Object.keys(draft).length) await savePlacement(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, { site: v.site, zone: v.zone || null }])));
        setDraft({});
    });

    const grouped = useMemo(() => {
        const bySite = {};
        sensorPaths.forEach((entry) => {
            const v = rowValue(entry);
            (bySite[v.site] = bySite[v.site] || []).push(entry);
        });
        return bySite;
    }, [sensorPaths, draft]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <DashboardCard title="Sensor placement">
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Every sensor found in Firebase is listed below. Choose the site it belongs to and the block (campus) or area (village) it is installed in;
                    the map, Live Monitoring and alerts follow this placement. Saved to <span className="font-mono">config/sensorPlacement</span>.
                </p>

                <label className={labelCls}>
                    Unplaced prototype sensors (flat keys at the database root) belong to
                    <select id="proto-site" value={proto} disabled={!canEdit} onChange={(e) => setProto(e.target.value)} className={`${inputCls} max-w-sm`}>
                        {sites.map((s) => <option key={s.id} value={s.id}>{s.name}{s.fullName ? ` – ${s.fullName}` : ''}</option>)}
                    </select>
                </label>

                {sensorPaths.length === 0 ? (
                    <p className="text-sm text-slate-500">No sensor readings found in the database yet.</p>
                ) : (
                    <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left text-slate-500 uppercase tracking-wider text-[10px]">
                                    <th className="px-2 py-1">Firebase path</th>
                                    <th className="px-2 py-1">Source</th>
                                    <th className="px-2 py-1">Sensor</th>
                                    <th className="px-2 py-1 text-right">Value</th>
                                    <th className="px-2 py-1">Site</th>
                                    <th className="px-2 py-1">Block / area</th>
                                    <th className="px-2 py-1"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sites.filter((s) => grouped[s.id]?.length).map((site) => (
                                    <React.Fragment key={site.id}>
                                        <tr className="bg-slate-50"><td colSpan={7} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{site.name}</td></tr>
                                        {grouped[site.id].map((entry) => {
                                            const v = rowValue(entry);
                                            const zones = zonesOf(getSite(v.site));
                                            const changed = !!draft[entry.key];
                                            return (
                                                <tr key={entry.key} className={`border-t border-slate-100 ${changed ? 'bg-amber-50/60' : ''}`}>
                                                    <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600 break-all">{entry.path}</td>
                                                    <td className="px-2 py-1.5 text-[10px] text-slate-500 whitespace-nowrap">{entry.sourceId}</td>
                                                    <td className="px-2 py-1.5 font-semibold text-slate-700 whitespace-nowrap">{entry.metric?.label || entry.metricKey}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">{entry.value ?? '—'} {entry.metric?.unit}</td>
                                                    <td className="px-2 py-1.5">
                                                        <select value={v.site} disabled={!canEdit} onChange={(e) => setRow(entry, { site: e.target.value })} className="p-1.5 rounded-lg border border-slate-200 bg-white text-[11px] disabled:bg-slate-50">
                                                            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <select value={v.zone || ''} disabled={!canEdit} onChange={(e) => setRow(entry, { zone: e.target.value || null })} className="p-1.5 rounded-lg border border-slate-200 bg-white text-[11px] disabled:bg-slate-50">
                                                            <option value="">(none)</option>
                                                            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-[10px] text-slate-400 whitespace-nowrap">{entry.placed ? 'placed' : 'default'}</td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <SaveBar dirty={dirty && canEdit} saving={saver.saving} error={saver.error} ok={saver.ok} onSave={saver.run} onReset={() => { setDraft({}); setProto(prototypeSiteId); }} label="Save placement" />
            </div>
        </DashboardCard>
    );
};

// ── Zone positions ────────────────────────────────────────────────────────────
const ZonesCard = ({ canEdit }) => {
    const { sites, selectedVillageId, zoneOverrides, saveZoneOverrides } = useVillageSensors();
    const [siteId, setSiteId] = useState(selectedVillageId);
    const site = getSite(siteId);
    const [draft, setDraft] = useState({});
    useEffect(() => { setDraft({}); }, [siteId, zoneOverrides]);

    const current = (zone) => draft[zone.id] || (() => { const c = resolveZoneCenter(site, zone.id, zoneOverrides); return { lat: c ? c[0] : '', lng: c ? c[1] : '' }; })();
    const dirty = Object.keys(draft).length > 0;
    const saver = useSaver(async () => {
        const entries = {};
        Object.entries(draft).forEach(([zoneId, v]) => {
            const lat = Number(v.lat); const lng = Number(v.lng);
            if (Number.isFinite(lat) && Number.isFinite(lng)) entries[zoneId] = { lat, lng };
        });
        await saveZoneOverrides(siteId, entries);
        setDraft({});
    });

    return (
        <DashboardCard title="Block and area positions">
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Campus block outlines come from OpenStreetMap; blocks marked <span className="font-semibold">approx</span> and all village areas use estimated centres.
                    Correct a position here and the map and sensor markers move with it. Saved to <span className="font-mono">config/zones</span>.
                </p>
                <label className={labelCls}>
                    Site
                    <select id="zones-site" value={siteId} onChange={(e) => setSiteId(e.target.value)} className={`${inputCls} max-w-sm`}>
                        {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {zonesOf(site).map((zone) => {
                        const v = current(zone);
                        const overridden = !!zoneOverrides?.[siteId]?.[zone.id];
                        return (
                            <div key={zone.id} className={`rounded-xl border p-3 ${draft[zone.id] ? 'border-amber-200 bg-amber-50/60' : 'border-slate-100 bg-slate-50'}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-700 truncate">{zone.name}</p>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">{zone.category}</span>
                                        {zone.approx && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">approx</span>}
                                        {overridden && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">set</span>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <input type="number" step="0.00001" value={v.lat} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, [zone.id]: { ...current(zone), lat: e.target.value } }))} className="p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono disabled:bg-slate-50" aria-label={`${zone.name} latitude`} />
                                    <input type="number" step="0.00001" value={v.lng} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, [zone.id]: { ...current(zone), lng: e.target.value } }))} className="p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono disabled:bg-slate-50" aria-label={`${zone.name} longitude`} />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <SaveBar dirty={dirty && canEdit} saving={saver.saving} error={saver.error} ok={saver.ok} onSave={saver.run} onReset={() => setDraft({})} label="Save positions" />
            </div>
        </DashboardCard>
    );
};

// ── LoRaWAN waste bins (Ubidots) ─────────────────────────────────────────────
const UbidotsCard = ({ canEdit }) => {
    const { ubidotsConfig, saveUbidotsConfig, sites } = useVillageSensors();
    const { bins, stats, error, fetchedAtLabel, refresh } = useWasteBins();
    const [draft, setDraft] = useState(ubidotsConfig);
    useEffect(() => { setDraft(ubidotsConfig); }, [ubidotsConfig]);
    const dirty = JSON.stringify(draft) !== JSON.stringify(ubidotsConfig);
    const saver = useSaver(async () => saveUbidotsConfig({
        ...draft,
        pollSeconds: Math.max(15, Number(draft.pollSeconds) || 60),
        historyPoints: Math.max(2, Math.min(200, Number(draft.historyPoints) || 48)),
        offlineAfterMinutes: Math.max(1, Number(draft.offlineAfterMinutes) || 30),
        fullAlertPct: Math.max(1, Math.min(100, Number(draft.fullAlertPct) || 85))
    }));

    return (
        <DashboardCard title="LoRaWAN waste bins (Ubidots)">
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Bins publish over LoRaWAN into Ubidots. The dashboard reads the public Ubidots dashboard directly (no account key needed) and
                    attaches each bin to a site and block by its name. To move a bin, add a placement row with key
                    <span className="font-mono mx-1">ubidots~&lt;device label&gt;</span> in Sensor placement. Saved to <span className="font-mono">config/ubidots</span>.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className={`${labelCls} md:col-span-2`}>
                        Public dashboard link
                        <input id="ubidots-url" type="url" value={draft.dashboardUrl || ''} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, dashboardUrl: e.target.value })} className={inputCls} placeholder="https://stem.ubidots.com/app/dashboards/public/dashboard/…" />
                    </label>
                    <label className={labelCls}>
                        Poll every (seconds)
                        <input id="ubidots-poll" type="number" min="15" max="3600" value={draft.pollSeconds} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, pollSeconds: Number(e.target.value) })} className={inputCls} />
                    </label>
                    <label className={labelCls}>
                        History points per bin
                        <input id="ubidots-history" type="number" min="2" max="200" value={draft.historyPoints} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, historyPoints: Number(e.target.value) })} className={inputCls} />
                    </label>
                    <label className={labelCls}>
                        Offline after (minutes without uplink)
                        <input id="ubidots-offline" type="number" min="1" max="10080" value={draft.offlineAfterMinutes} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, offlineAfterMinutes: Number(e.target.value) })} className={inputCls} />
                    </label>
                    <label className={labelCls}>
                        Nearly-full alert at (%)
                        <input id="ubidots-full" type="number" min="1" max="100" value={draft.fullAlertPct} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, fullAlertPct: Number(e.target.value) })} className={inputCls} />
                    </label>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input id="ubidots-enabled" type="checkbox" checked={!!draft.enabled} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                        Poll Ubidots
                    </label>
                    <button onClick={refresh} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        <RotateCcw size={13} /> Poll now
                    </button>
                    <span className={`text-xs ${error ? 'text-red-600' : 'text-slate-500'}`}>
                        {error ? error : `${stats.online}/${stats.total} bin${stats.total === 1 ? '' : 's'} online${fetchedAtLabel ? ` · last poll ${fetchedAtLabel}` : ''}`}
                    </span>
                </div>
                {bins.length > 0 && (
                    <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left text-slate-500 uppercase tracking-wider text-[10px]">
                                    <th className="px-2 py-1">Device</th><th className="px-2 py-1">Name</th><th className="px-2 py-1 text-right">Fill</th><th className="px-2 py-1">Site / block</th><th className="px-2 py-1">Position</th><th className="px-2 py-1">Last uplink</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bins.map((bin) => (
                                    <tr key={bin.label} className="border-t border-slate-100">
                                        <td className="px-2 py-1.5 font-mono text-[11px]">{bin.label}</td>
                                        <td className="px-2 py-1.5">{bin.name}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{bin.fillPct !== null ? `${Math.round(bin.fillPct)} %` : '—'}</td>
                                        <td className="px-2 py-1.5">{sites.find((s) => s.id === bin.siteId)?.name || bin.siteId}{bin.zoneName ? ` / ${bin.zoneName}` : ''}{bin.placed ? <span className="ml-1 text-[9px] uppercase font-bold text-emerald-700">placed</span> : null}</td>
                                        <td className="px-2 py-1.5 text-slate-500">{bin.coordsSource === 'device' ? 'node GPS' : bin.coordsSource === 'zone' ? `block (GPS ${bin.gpsDistanceKm !== null ? `${bin.gpsDistanceKm.toFixed(1)} km away` : 'missing'})` : 'site centre'}</td>
                                        <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{bin.lastSeen || '—'}{bin.online ? '' : ' · offline'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <SaveBar dirty={dirty && canEdit} saving={saver.saving} error={saver.error} ok={saver.ok} onSave={saver.run} onReset={() => setDraft(ubidotsConfig)} label="Save Ubidots settings" />
            </div>
        </DashboardCard>
    );
};

// ── Mobile alerts ─────────────────────────────────────────────────────────────
const AlertsCard = ({ canEdit }) => {
    const { alertConfig, saveAlertConfig } = useVillageSensors();
    const { sendTest, recent } = useAlertDispatch();
    const [draft, setDraft] = useState(alertConfig);
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);
    useEffect(() => { setDraft(alertConfig); }, [alertConfig]);

    const channel = ALERT_CHANNELS.find((c) => c.id === draft.channel) || ALERT_CHANNELS[0];
    const dirty = JSON.stringify(draft) !== JSON.stringify(alertConfig);
    const phoneDigits = normalizePhone(draft.phone);
    const saver = useSaver(async () => saveAlertConfig({ ...draft, phone: formatPhone(phoneDigits), cooldownMinutes: Math.max(1, Number(draft.cooldownMinutes) || DEFAULT_ALERT_CONFIG.cooldownMinutes) }));

    const runTest = async () => {
        setTesting(true); setTestResult(null);
        try { setTestResult(await sendTest()); } finally { setTesting(false); }
    };

    const statusChip = (status) => ({
        'sent-by-browser': 'bg-emerald-100 text-emerald-700',
        sent: 'bg-emerald-100 text-emerald-700',
        pending: 'bg-amber-100 text-amber-700',
        failed: 'bg-red-100 text-red-700'
    }[status] || 'bg-slate-100 text-slate-600');

    return (
        <DashboardCard title="Mobile alerts">
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Critical alerts (dry soil, empty tank, flood risk, poor water quality, the emergency parking bay and so on) are sent to the number below,
                    once per cooldown window per alert. Each send is also logged in <span className="font-mono">alerts/outbox</span>, which the relay
                    (<span className="font-mono">npm run alert:relay</span>) or a GSM node can deliver as SMS.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className={labelCls}>
                        Recipient name
                        <input id="alert-name" type="text" value={draft.name || ''} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} placeholder="Duty officer" />
                    </label>
                    <label className={labelCls}>
                        Mobile number
                        <input id="alert-phone" type="tel" value={draft.phone || ''} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputCls} placeholder="+91 98765 43210" />
                        {draft.phone && <span className="text-[11px] text-slate-400">Will send to {formatPhone(phoneDigits) || 'invalid number'}</span>}
                    </label>
                    <label className={labelCls}>
                        Delivery channel
                        <select id="alert-channel" value={draft.channel} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, channel: e.target.value })} className={inputCls}>
                            {ALERT_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </label>
                    <label className={labelCls}>
                        Cooldown (minutes per alert)
                        <input id="alert-cooldown" type="number" min="1" max="1440" value={draft.cooldownMinutes} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, cooldownMinutes: Number(e.target.value) })} className={inputCls} />
                    </label>
                    {channel.needsKey && (
                        <label className={`${labelCls} md:col-span-2`}>
                            {channel.keyLabel}
                            <input id="alert-apikey" type="password" value={draft.apiKey || ''} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} className={inputCls} autoComplete="off" />
                            <span className="text-[11px] text-amber-600 block mt-0.5">Stored only in this browser (never uploaded to Firebase) — re-enter it on any other device you use to manage alerts.</span>
                            {draft.channel === 'callmebot' && <span className="text-[11px] text-slate-400 block">Send "I allow callmebot to send me messages" to +34 644 71 84 50 on WhatsApp once to receive your key.</span>}
                        </label>
                    )}
                    {channel.needsUrl && (
                        <label className={`${labelCls} md:col-span-2`}>
                            Webhook URL
                            <input id="alert-webhook" type="url" value={draft.webhookUrl || ''} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, webhookUrl: e.target.value })} className={inputCls} placeholder="https://…" />
                            <span className="text-[11px] text-amber-600 block mt-0.5">Stored only in this browser (never uploaded to Firebase) — re-enter it on any other device you use to manage alerts.</span>
                        </label>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input id="alert-enabled" type="checkbox" checked={!!draft.enabled} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                        Alerts enabled
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input id="alert-warnings" type="checkbox" checked={!!draft.includeWarnings} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, includeWarnings: e.target.checked })} />
                        Also send warnings
                    </label>
                    <button onClick={runTest} disabled={!canEdit || testing || dirty || !normalizePhone(alertConfig.phone)} title={dirty ? 'Save first' : 'Send a test message with the saved settings'} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                        <Send size={13} /> {testing ? 'Sending…' : 'Send test alert'}
                    </button>
                    {testResult && <span className={`text-xs ${testResult.dispatched ? 'text-emerald-600' : 'text-amber-600'}`}>{testResult.note}</span>}
                </div>

                <SaveBar dirty={dirty && canEdit} saving={saver.saving} error={saver.error} ok={saver.ok} onSave={saver.run} onReset={() => setDraft(alertConfig)} label="Save alert settings" />

                <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2">Recent alerts (alerts/outbox)</p>
                    {recent.length === 0 ? <p className="text-xs text-slate-400">Nothing sent yet.</p> : (
                        <div className="overflow-x-auto -mx-2">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-left text-slate-500 uppercase tracking-wider text-[10px]">
                                        <th className="px-2 py-1">Time</th><th className="px-2 py-1">To</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Message</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent.map((row) => (
                                        <tr key={row.id} className="border-t border-slate-100 align-top">
                                            <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">{row.ts ? formatTimeIST(new Date(row.ts)) : '—'}</td>
                                            <td className="px-2 py-1.5 whitespace-nowrap font-mono">{row.to}</td>
                                            <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusChip(row.status)}`}>{row.status}</span>{row.relay ? <span className="ml-1 text-[10px] text-slate-400">via {row.relay}</span> : null}</td>
                                            <td className="px-2 py-1.5 text-slate-600">{row.text}{row.note ? <span className="block text-[10px] text-slate-400">{row.note}</span> : null}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </DashboardCard>
    );
};

export const SiteConfig = () => {
    const { isAdmin } = useAuth();
    const { selectedVillage } = useVillageSensors();

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <MapPinned size={24} className="text-blue-600" />
                        Site &amp; Alerts Configuration
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Place each Firebase sensor on a campus block or village area, correct block positions, and set the mobile number that receives critical alerts.
                        Currently viewing <span className="font-semibold text-slate-700">{selectedVillage?.name}</span>.
                    </p>
                </div>
                {!isAdmin && (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 text-xs font-semibold">
                        <Landmark size={14} /> Read-only: sign in with a sahrdaya.ac.in account to edit
                    </span>
                )}
            </div>

            <SourcesCard canEdit={isAdmin} />
            <PlacementCard canEdit={isAdmin} />
            <ZonesCard canEdit={isAdmin} />
            <UbidotsCard canEdit={isAdmin} />
            <AlertsCard canEdit={isAdmin} />

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs text-slate-500 flex items-start gap-2">
                <Smartphone size={14} className="mt-0.5 shrink-0" />
                <p>
                    A web page cannot send SMS by itself. With the <b>outbox</b> channel, run <span className="font-mono">FAST2SMS_KEY=… npm run alert:relay</span>
                    (or Twilio / CallMeBot keys) on any always-on machine to turn queued alerts into messages; a GSM node subscribed to
                    <span className="font-mono mx-1">alerts/outbox</span> can do the same. The CallMeBot and Fast2SMS channels let the browser fire the message directly.
                    <BellRing size={12} className="inline ml-1" />
                </p>
            </div>
        </div>
    );
};
