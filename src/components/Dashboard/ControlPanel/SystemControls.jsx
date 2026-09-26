import React, { useState } from 'react';
import { Power, Activity, Settings2, AlertCircle, ShieldAlert, Droplets, Sprout, Waves } from 'lucide-react';
import { useAssets } from '../../../hooks/useAssets';
import { useAuth } from '../../../context/AuthContext';
import { useVillageSensors } from '../../../hooks/useVillageSensors';
import { useVillageInsights } from '../../../hooks/useVillageInsights';
import { CONTROLLABLE_METRICS } from '../../../data/sensorSchema';
import { parseSourcePath } from '../../../data/sensorSources';

const Toggle = ({ isOn, disabled, busy, onToggle, title, tone = 'green' }) => (
    <button
        onClick={(e) => { e.stopPropagation(); if (!disabled && !busy) onToggle(); }}
        disabled={disabled || busy}
        title={title}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shrink-0 ${isOn ? (tone === 'amber' ? 'bg-amber-500' : 'bg-green-500') : 'bg-slate-300'} ${(disabled || busy) ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${isOn ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
);

const CONTROL_ICONS = { pump: Droplets, irrigation_pump: Sprout, pump_safety_cutoff: ShieldAlert, lake_pump: Waves };

const ControlItem = ({ asset, onToggle, onClick, disabled }) => {
    const isOn = asset.status !== 'offline';
    return (
        <div onClick={() => onClick(asset)} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`p-2 rounded-lg shrink-0 ${isOn ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}><Power size={18} /></div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-700 truncate">{asset.type}</p>
                        {asset.flowType && (
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0 ${asset.flowType === 'producer' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : asset.flowType === 'consumer' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>{asset.flowType}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500 truncate">{asset.details}</p>
                        <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-medium shrink-0">{isOn ? Math.abs(asset.val || 0) : 'Off'}</span>
                    </div>
                </div>
            </div>
            <Toggle isOn={isOn} disabled={disabled} onToggle={() => onToggle(asset)} title={disabled ? 'Admin access needed' : 'Toggle Power'} />
        </div>
    );
};

/** One actuator from the sensor database (water pump relay, irrigation relay, safety cutoff). */
const ActuatorItem = ({ reading, siteName, onNavigate, disabled, busy, error, onToggle, sources }) => {
    const Icon = CONTROL_ICONS[reading.key] || Power;
    const isOn = reading.value === 1;
    const isCutoff = reading.key === 'pump_safety_cutoff';
    const live = reading.source === 'live';
    const source = reading.path ? sources.find((s) => s.id === parseSourcePath(reading.path).sourceId) : null;
    const tone = isCutoff ? 'amber' : 'green';
    const onColour = isCutoff ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-600';

    return (
        <div
            onClick={() => onNavigate && onNavigate('live', { metricKey: reading.key })}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors gap-3 ${isCutoff ? 'bg-amber-50/60 border-amber-100 hover:bg-amber-50' : 'bg-cyan-50/60 border-cyan-100 hover:bg-cyan-50'}`}
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`p-2 rounded-lg shrink-0 ${isOn ? onColour : 'bg-slate-200 text-slate-500'}`}><Icon size={18} /></div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-700 truncate">{reading.label} · {siteName}</p>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${live ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{live ? 'Live' : 'Baseline'}</span>
                        {source && !source.primary && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700" title={source.url}>{source.id}</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                        {reading.message}{reading.zoneName ? ` · ${reading.zoneName}` : ''}
                    </p>
                    {reading.path
                        ? <p className="text-[10px] text-slate-400 font-mono truncate">{reading.path}</p>
                        : reading.controlPath && <p className="text-[10px] text-amber-600 font-mono truncate">not published yet · will write {reading.controlPath}</p>}
                    {error && <p className="text-[11px] text-red-600 flex items-center gap-1 mt-0.5"><AlertCircle size={11} /> {error}</p>}
                </div>
            </div>
            <Toggle
                isOn={isOn}
                disabled={disabled}
                busy={busy}
                tone={tone}
                onToggle={onToggle}
                title={disabled ? 'Admin access needed' : isCutoff ? (isOn ? 'Clear the safety cutoff' : 'Engage the safety cutoff (locks the pump off)') : (isOn ? `Switch ${reading.label} OFF` : `Switch ${reading.label} ON`)}
            />
        </div>
    );
};

export const SystemControls = ({ onNavigate, className = 'h-64' }) => {
    const { assets, updateAsset } = useAssets();
    const { isAdmin } = useAuth();
    const { selectedVillage, selectedVillageId, setMetricValue, sources } = useVillageSensors();
    const { effectiveReadings } = useVillageInsights();
    const [busyKey, setBusyKey] = useState(null);
    const [errors, setErrors] = useState({});

    const isLiveVillage = !!selectedVillage?.isLive;
    // Actuators the nodes publish, plus those with a known control key the dashboard can create
    const actuators = CONTROLLABLE_METRICS
        .map((metric) => effectiveReadings[metric.key])
        .filter((reading) => reading && (reading.source === 'live' || reading.controlPath));

    const controllableAssets = assets.filter((a) => a.category === 'controls' || (a.category === 'energy' && a.flowType !== 'sensor'));

    const handleAssetToggle = async (asset) => {
        if (!isAdmin) return;
        try { await updateAsset(asset.firebaseId || asset.id, { status: asset.status === 'offline' ? 'normal' : 'offline' }); }
        catch (error) { console.error('Failed to toggle asset:', error); }
    };

    const handleActuator = async (reading) => {
        if (!isAdmin) return;
        setBusyKey(reading.key);
        setErrors((e) => ({ ...e, [reading.key]: null }));
        try {
            await setMetricValue(selectedVillageId, reading.key, reading.value !== 1);
        } catch (error) {
            console.error('Failed to switch actuator:', error);
            setErrors((e) => ({ ...e, [reading.key]: error?.message || 'Write failed' }));
        } finally {
            setBusyKey(null);
        }
    };

    return (
        <div className={`bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-xl flex flex-col overflow-hidden ${className}`}>
            <h3 className="text-slate-600 font-semibold mb-4 text-sm uppercase tracking-wider flex items-center justify-between">
                <div className="flex items-center gap-2"><Settings2 size={16} /> System Controls</div>
                {!isAdmin && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold border border-slate-200">View Only</span>}
            </h3>

            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {isLiveVillage && actuators.map((reading) => (
                    <ActuatorItem
                        key={reading.key}
                        reading={reading}
                        siteName={selectedVillage.name}
                        onNavigate={onNavigate}
                        disabled={!isAdmin}
                        busy={busyKey === reading.key}
                        error={errors[reading.key]}
                        onToggle={() => handleActuator(reading)}
                        sources={sources}
                    />
                ))}

                {controllableAssets.map((asset) => (
                    <ControlItem key={asset.id} asset={asset} onToggle={handleAssetToggle} onClick={() => onNavigate && onNavigate('live', { assetId: asset.id })} disabled={!isAdmin} />
                ))}

                {(!isLiveVillage || actuators.length === 0) && controllableAssets.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm p-4 text-center">
                        <Activity size={24} className="mb-2 opacity-50" />
                        No controllable systems online.
                    </div>
                )}
            </div>
        </div>
    );
};
