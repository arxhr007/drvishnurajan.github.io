import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
    SquareParking, Car, Ambulance, Siren, Wifi, WifiOff, Settings2, Save, Volume2, VolumeX,
    CheckCircle2, AlertTriangle, Radar, Hospital
} from 'lucide-react';
import { useParking, DEFAULT_PARKING_CONFIG } from '../../hooks/useParking';
import { useAuth } from '../../context/AuthContext';
import { DashboardCard } from '../Shared/DashboardCard';
import { DemoEncryptionNotice } from '../Shared/DemoEncryptionNotice';

const CAR_COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#334155', '#0e7490', '#4d7c0f', '#9333ea', '#c2410c'];

// Top-down car drawn in SVG; colour per bay so the lot reads at a glance
const CarTopView = ({ color = '#2563eb', className = '' }) => (
    <svg viewBox="0 0 60 120" className={className} aria-hidden="true">
        <defs>
            <linearGradient id="carShade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#000" stopOpacity="0.18" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.12" />
                <stop offset="1" stopColor="#000" stopOpacity="0.22" />
            </linearGradient>
        </defs>
        <rect x="4" y="18" width="8" height="18" rx="2" fill="#1f2937" />
        <rect x="48" y="18" width="8" height="18" rx="2" fill="#1f2937" />
        <rect x="4" y="84" width="8" height="18" rx="2" fill="#1f2937" />
        <rect x="48" y="84" width="8" height="18" rx="2" fill="#1f2937" />
        <rect x="8" y="6" width="44" height="108" rx="14" fill={color} />
        <rect x="8" y="6" width="44" height="108" rx="14" fill="url(#carShade)" />
        <rect x="13" y="26" width="34" height="18" rx="5" fill="#0f172a" opacity="0.85" />
        <rect x="13" y="76" width="34" height="14" rx="5" fill="#0f172a" opacity="0.8" />
        <rect x="15" y="48" width="30" height="24" rx="4" fill="#fff" opacity="0.12" />
        <rect x="12" y="8" width="8" height="4" rx="2" fill="#fef3c7" />
        <rect x="40" y="8" width="8" height="4" rx="2" fill="#fef3c7" />
        <rect x="12" y="108" width="8" height="4" rx="2" fill="#fca5a5" />
        <rect x="40" y="108" width="8" height="4" rx="2" fill="#fca5a5" />
    </svg>
);

const AmbulanceTopView = ({ className = '' }) => (
    <svg viewBox="0 0 60 130" className={className} aria-hidden="true">
        <rect x="4" y="22" width="8" height="18" rx="2" fill="#1f2937" />
        <rect x="48" y="22" width="8" height="18" rx="2" fill="#1f2937" />
        <rect x="4" y="94" width="8" height="18" rx="2" fill="#1f2937" />
        <rect x="48" y="94" width="8" height="18" rx="2" fill="#1f2937" />
        <rect x="8" y="6" width="44" height="118" rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        <rect x="13" y="14" width="34" height="16" rx="4" fill="#0f172a" opacity="0.85" />
        <rect x="8" y="34" width="44" height="6" fill="#dc2626" />
        <rect x="26" y="52" width="8" height="40" rx="1" fill="#dc2626" />
        <rect x="10" y="68" width="40" height="8" rx="1" fill="#dc2626" />
        <rect x="18" y="8" width="24" height="5" rx="2" fill="#3b82f6" className="animate-pulse" />
        <rect x="12" y="118" width="8" height="4" rx="2" fill="#fca5a5" />
        <rect x="40" y="118" width="8" height="4" rx="2" fill="#fca5a5" />
    </svg>
);

const STATE_META = {
    occupied: { label: 'Occupied', chip: 'bg-red-100 text-red-700 border-red-200' },
    free: { label: 'Free', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    offline: { label: 'Sensor offline', chip: 'bg-amber-100 text-amber-700 border-amber-200' },
    'no-sensor': { label: 'No sensor', chip: 'bg-slate-200 text-slate-600 border-slate-300' }
};

// One parking bay: painted lines, bay number, vehicle when occupied
const Bay = ({ slot, thresholdCm }) => {
    const { bay, isEmergency, state, distance, sensor } = slot;
    const occupied = state === 'occupied';
    const free = state === 'free';
    const colour = CAR_COLORS[(bay - 1) % CAR_COLORS.length];

    const border = isEmergency
        ? (occupied ? 'border-red-500' : 'border-red-300')
        : free ? 'border-emerald-300/70' : occupied ? 'border-slate-300/60' : 'border-slate-500/40 border-dashed';

    return (
        <div
            className={`relative w-[104px] h-[196px] shrink-0 rounded-md border-x-4 border-t-4 ${border} bg-slate-700/60 flex flex-col items-center justify-end overflow-hidden transition-colors duration-500`}
            title={sensor ? `${sensor.path} · ${distance ?? '—'} cm (threshold ${thresholdCm} cm)` : 'No sensor assigned to this bay'}
        >
            {/* Emergency hatch */}
            {isEmergency && (
                <div className="absolute inset-0 opacity-25 pointer-events-none"
                    style={{ backgroundImage: 'repeating-linear-gradient(45deg, #ef4444 0 8px, transparent 8px 20px)' }} />
            )}
            {/* Free glow */}
            {free && !isEmergency && <div className="absolute inset-0 bg-emerald-400/10 pointer-events-none" />}
            {free && isEmergency && <div className="absolute inset-0 bg-red-400/5 pointer-events-none" />}

            {/* Vehicle */}
            <div className={`absolute inset-x-0 top-4 flex justify-center transition-all duration-700 ease-out ${occupied ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'}`}>
                {isEmergency ? <AmbulanceTopView className="w-14 drop-shadow-lg" /> : <CarTopView color={colour} className="w-14 drop-shadow-lg" />}
            </div>

            {/* Status text when empty */}
            {!occupied && (
                <div className="absolute inset-x-0 top-14 text-center px-1">
                    {state === 'free' && (
                        <p className={`text-lg font-black tracking-widest ${isEmergency ? 'text-red-300' : 'text-emerald-300'}`}>FREE</p>
                    )}
                    {state === 'offline' && <p className="text-[11px] font-bold text-amber-300 uppercase">Sensor offline</p>}
                    {state === 'no-sensor' && <p className="text-[11px] font-bold text-slate-400 uppercase">No sensor</p>}
                </div>
            )}

            {/* Bay label */}
            <div className="relative w-full px-2 pb-2 text-center">
                {isEmergency ? (
                    <p className="text-[10px] font-black tracking-wider text-red-200 flex items-center justify-center gap-1"><Siren size={11} /> EMERGENCY</p>
                ) : (
                    <p className="text-[10px] font-semibold tracking-wider text-slate-300">BAY</p>
                )}
                <p className="text-2xl font-black text-white leading-none">{isEmergency ? 'E' : bay}</p>
                <p className="text-[10px] text-slate-300 mt-1 font-mono">{distance !== null ? `${distance} cm` : '—'}</p>
            </div>
        </div>
    );
};

const Stat = ({ label, value, unit, tone = 'slate', icon: Icon, sub }) => {
    const tones = {
        slate: 'bg-slate-50 border-slate-200 text-slate-600',
        red: 'bg-red-50 border-red-200 text-red-600',
        green: 'bg-emerald-50 border-emerald-200 text-emerald-600',
        blue: 'bg-blue-50 border-blue-200 text-blue-600',
        amber: 'bg-amber-50 border-amber-200 text-amber-600'
    };
    return (
        <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-3">
            <div className="min-w-0">
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-800">{value}</span>
                    {unit && <span className="text-sm text-slate-500">{unit}</span>}
                </div>
                {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
            </div>
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${tones[tone]}`}>
                <Icon size={20} />
            </div>
        </div>
    );
};

const ConfigPanel = ({ config, sensors, onSave, saving, saveError, canEdit, configSource }) => {
    const [draft, setDraft] = useState(config);
    useEffect(() => { setDraft(config); }, [config]);

    const setField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
    const setMap = (bay, path) => setDraft((d) => {
        const sensorMap = { ...d.sensorMap };
        if (path) sensorMap[bay] = path; else delete sensorMap[bay];
        return { ...d, sensorMap };
    });
    const dirty = JSON.stringify(draft) !== JSON.stringify(config);
    const total = Math.min(40, Math.max(1, Number(draft.totalSlots) || 1));

    return (
        <DashboardCard title="Parking Setup">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="text-xs font-semibold text-slate-600">
                        Number of slots
                        <input id="parking-total-slots" type="number" min="1" max="40" value={draft.totalSlots} disabled={!canEdit}
                            onChange={(e) => setField('totalSlots', Number(e.target.value))}
                            className="mt-1 w-full p-2 rounded-lg border border-slate-200 bg-white text-sm font-normal disabled:bg-slate-50" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                        Occupied below (cm)
                        <input id="parking-threshold" type="number" min="5" max="500" value={draft.thresholdCm} disabled={!canEdit}
                            onChange={(e) => setField('thresholdCm', Number(e.target.value))}
                            className="mt-1 w-full p-2 rounded-lg border border-slate-200 bg-white text-sm font-normal disabled:bg-slate-50" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                        Emergency bay
                        <select id="parking-emergency-slot" value={Math.min(draft.emergencySlot, total)} disabled={!canEdit}
                            onChange={(e) => setField('emergencySlot', Number(e.target.value))}
                            className="mt-1 w-full p-2 rounded-lg border border-slate-200 bg-white text-sm font-normal disabled:bg-slate-50">
                            {Array.from({ length: total }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Bay {n}</option>)}
                        </select>
                    </label>
                </div>

                <label className="block text-xs font-semibold text-slate-600">
                    Car park name
                    <input id="parking-name" type="text" value={draft.name} disabled={!canEdit}
                        onChange={(e) => setField('name', e.target.value)}
                        className="mt-1 w-full p-2 rounded-lg border border-slate-200 bg-white text-sm font-normal disabled:bg-slate-50" />
                </label>

                <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2">Sensor → bay mapping <span className="font-normal text-slate-400">(blank = automatic, in path order)</span></p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                        {Array.from({ length: total }, (_, i) => i + 1).map((bay) => (
                            <label key={bay} className="flex items-center gap-2 text-xs text-slate-600">
                                <span className={`w-14 shrink-0 font-bold ${bay === Number(draft.emergencySlot) ? 'text-red-600' : ''}`}>{bay === Number(draft.emergencySlot) ? 'Emerg.' : `Bay ${bay}`}</span>
                                <select id={`parking-map-${bay}`} value={draft.sensorMap?.[bay] || ''} disabled={!canEdit}
                                    onChange={(e) => setMap(bay, e.target.value)}
                                    className="flex-1 p-1.5 rounded-lg border border-slate-200 bg-white font-mono text-[11px] disabled:bg-slate-50 min-w-0">
                                    <option value="">auto</option>
                                    {sensors.map((s) => <option key={s.path} value={s.path}>{s.path}</option>)}
                                </select>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <p className="text-[11px] text-slate-400">
                        Settings {configSource === 'firebase' ? 'shared via Firebase (parking/config)' : 'are defaults – save to share with all viewers'}.
                        {!canEdit && ' Sign in with a sahrdaya.ac.in account to edit.'}
                    </p>
                    <div className="flex items-center gap-2">
                        {saveError && <span className="text-xs text-red-600">{saveError}</span>}
                        <button
                            onClick={() => onSave(draft)}
                            disabled={!canEdit || !dirty || saving}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-blue-700"
                        >
                            <Save size={13} /> {saving ? 'Saving…' : 'Save setup'}
                        </button>
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
};

export const ParkingDashboard = () => {
    const { config, configSource, saveConfig, saving, saveError, sensors, slots, stats, emergencyOccupied, history, connected, loading, lastUpdate } = useParking();
    const { isAdmin } = useAuth();
    const [soundOn, setSoundOn] = useState(false);
    const audioRef = useRef(null);

    // Audible alarm while the emergency bay is blocked (opt-in; browsers block autoplay)
    useEffect(() => {
        if (!soundOn || !emergencyOccupied) return undefined;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return undefined;
        const ctx = audioRef.current || new Ctx();
        audioRef.current = ctx;
        const id = setInterval(() => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = 880;
            gain.gain.value = 0.05;
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.18);
        }, 900);
        return () => clearInterval(id);
    }, [soundOn, emergencyOccupied]);

    const rows = useMemo(() => {
        const perRow = slots.length > 8 ? Math.ceil(slots.length / 2) : slots.length;
        return [slots.slice(0, perRow), slots.slice(perRow)].filter((r) => r.length);
    }, [slots]);

    if (loading) {
        return <div className="p-6 flex items-center justify-center h-full text-slate-500">Connecting to parking sensors…</div>;
    }

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Hospital size={24} className="text-blue-600" />
                        {config.name}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Live bay occupancy from ultrasonic sensors · {stats.sensorsDetected} sensor{stats.sensorsDetected === 1 ? '' : 's'} detected in Firebase
                        {lastUpdate ? ` · updated ${lastUpdate}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${connected ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                        {connected ? <Wifi size={12} /> : <WifiOff size={12} />} {connected ? 'Live' : 'Disconnected'}
                    </span>
                    <button
                        onClick={() => setSoundOn((s) => !s)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${soundOn ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-600 border-slate-200'}`}
                        title="Sound an alarm while the emergency bay is occupied"
                    >
                        {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} />} Alarm {soundOn ? 'on' : 'off'}
                    </button>
                </div>
            </div>

            {/* Emergency banner */}
            {stats.emergency && (
                <div className={`rounded-2xl border p-4 flex items-center gap-4 shadow-sm ${emergencyOccupied
                    ? 'bg-red-600 border-red-700 text-white animate-pulse'
                    : stats.emergency.state === 'free'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${emergencyOccupied ? 'bg-white/20' : 'bg-white border border-current/20'}`}>
                        {emergencyOccupied ? <Siren size={22} /> : stats.emergency.state === 'free' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-black uppercase tracking-wider">
                            {emergencyOccupied ? 'Emergency bay occupied – clear immediately' : stats.emergency.state === 'free' ? 'Emergency bay free' : 'Emergency bay sensor not reporting'}
                        </p>
                        <p className={`text-xs ${emergencyOccupied ? 'text-red-100' : 'opacity-80'}`}>
                            Bay {stats.emergency.bay} reserved for ambulances
                            {stats.emergency.sensor ? ` · ${stats.emergency.sensor.path} = ${stats.emergency.distance ?? '—'} cm (occupied below ${config.thresholdCm} cm)` : ' · assign a sensor in Parking Setup'}
                        </p>
                    </div>
                </div>
            )}

            <DemoEncryptionNotice />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <Stat label="Total slots" value={stats.total} icon={SquareParking} tone="blue" />
                <Stat label="Occupied" value={stats.occupied} icon={Car} tone="red" />
                <Stat label="Free" value={stats.free} icon={CheckCircle2} tone="green" />
                <Stat label="Occupancy" value={stats.occupancyPct} unit="%" icon={Radar} tone={stats.occupancyPct >= 90 ? 'red' : stats.occupancyPct >= 70 ? 'amber' : 'slate'} sub={stats.unknown ? `${stats.unknown} bay${stats.unknown === 1 ? '' : 's'} without reading` : 'all bays sensed'} />
                <Stat label="Emergency bay" value={stats.emergency ? STATE_META[stats.emergency.state].label : '—'} icon={Ambulance} tone={emergencyOccupied ? 'red' : 'green'} />
                <Stat label="Sensors online" value={`${stats.sensorsOnline}/${stats.sensorsDetected}`} icon={Wifi} tone={stats.sensorsOnline === stats.sensorsDetected && stats.sensorsDetected ? 'green' : 'amber'} />
            </div>

            {/* Lot visualisation */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-xl overflow-x-auto">
                <div className="flex items-center justify-between mb-4 text-slate-300 text-xs font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-2"><SquareParking size={14} /> Live bay map</span>
                    <span className="flex items-center gap-4 normal-case font-normal">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-400/60 border border-emerald-300" /> free</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-500 border border-slate-300" /> occupied</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm border border-red-400" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #ef4444 0 2px, transparent 2px 5px)' }} /> emergency</span>
                    </span>
                </div>
                <div className="flex flex-col gap-6 min-w-max">
                    {rows.map((row, idx) => (
                        <React.Fragment key={idx}>
                            <div className="flex gap-2 items-end">
                                <div className="w-8 text-slate-500 text-[10px] font-bold uppercase self-center -rotate-90 origin-center whitespace-nowrap">Entry →</div>
                                {row.map((slot) => <Bay key={slot.bay} slot={slot} thresholdCm={config.thresholdCm} />)}
                            </div>
                            {idx === 0 && rows.length > 1 && (
                                <div className="h-8 border-y border-dashed border-slate-500/60 flex items-center justify-center text-[10px] text-slate-400 uppercase tracking-[0.3em]">Drive aisle</div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Sensor table */}
                <DashboardCard title="Ultrasonic sensors" className="xl:col-span-1">
                    {sensors.length ? (
                        <div className="overflow-x-auto -mx-2">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-left text-slate-500 uppercase tracking-wider text-[10px]">
                                        <th className="px-2 py-1">Bay</th>
                                        <th className="px-2 py-1">Path</th>
                                        <th className="px-2 py-1 text-right">Distance</th>
                                        <th className="px-2 py-1">State</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {slots.filter((s) => s.sensor).map((slot) => (
                                        <tr key={slot.bay} className="border-t border-slate-100">
                                            <td className="px-2 py-1.5 font-bold">{slot.isEmergency ? 'E' : slot.bay}</td>
                                            <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600 break-all">{slot.sensor.path}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{slot.distance ?? '—'} cm</td>
                                            <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${STATE_META[slot.state].chip}`}>{STATE_META[slot.state].label}</span></td>
                                        </tr>
                                    ))}
                                    {sensors.filter((s) => !slots.some((slot) => slot.sensor?.path === s.path)).map((s) => (
                                        <tr key={s.path} className="border-t border-slate-100 text-slate-400">
                                            <td className="px-2 py-1.5">—</td>
                                            <td className="px-2 py-1.5 font-mono text-[11px] break-all">{s.path}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{s.distance ?? '—'} cm</td>
                                            <td className="px-2 py-1.5 text-[10px]">unassigned</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">
                            No ultrasonic readings found yet. Publish <span className="font-mono">parking/slots/1/distance</span> … and <span className="font-mono">parking/emergency/distance</span> (cm) from the nodes.
                        </p>
                    )}
                </DashboardCard>

                {/* Occupancy timeline */}
                <DashboardCard title="Occupancy this session" className="xl:col-span-2">
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} axisLine={false} />
                                <YAxis allowDecimals={false} domain={[0, stats.total]} tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} axisLine={false} width={30} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12, fontSize: 12 }} />
                                <Area type="stepAfter" dataKey="occupied" name="Occupied" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} isAnimationActive={false} />
                                <Area type="stepAfter" dataKey="free" name="Free" stroke="#10b981" fill="#10b981" fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>
            </div>

            <ConfigPanel
                config={config}
                sensors={sensors}
                onSave={(draft) => saveConfig(draft).catch(() => { })}
                saving={saving}
                saveError={saveError}
                canEdit={isAdmin}
                configSource={configSource}
            />

            <DashboardCard title="Firmware note">
                <p className="text-sm text-slate-600">
                    Each bay node should write its distance in centimetres to
                    <span className="font-mono mx-1">parking/slots/&lt;n&gt;/distance</span> and the ambulance bay to
                    <span className="font-mono mx-1">parking/emergency/distance</span>. A reading below the threshold ({config.thresholdCm} cm) marks the bay occupied.
                    Any other key containing <span className="font-mono">ultrasonic</span> or <span className="font-mono">distance</span> is detected too, so the current
                    <span className="font-mono mx-1">Agriculture/ultrasonicDistance</span> reading already appears as a bay.
                    Defaults: {DEFAULT_PARKING_CONFIG.totalSlots} slots, bay {DEFAULT_PARKING_CONFIG.emergencySlot} for emergencies.
                </p>
            </DashboardCard>
        </div>
    );
};
