import React, { useState } from 'react';
import { Power, Activity, Settings2, Droplets, AlertCircle } from 'lucide-react';
import { useAssets } from '../../../hooks/useAssets';
import { useAuth } from '../../../context/AuthContext';
import { useVillageSensors } from '../../../hooks/useVillageSensors';
import { useVillageInsights } from '../../../hooks/useVillageInsights';

const Toggle = ({ isOn, disabled, busy, onToggle, title }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            if (!disabled && !busy) onToggle();
        }}
        disabled={disabled || busy}
        title={title}
        className={`
            relative w-12 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shrink-0
            ${isOn ? 'bg-green-500' : 'bg-slate-300'}
            ${(disabled || busy) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
    >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${isOn ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
);

const ControlItem = ({ asset, onToggle, onClick, disabled }) => {
    const isOn = asset.status !== 'offline';

    return (
        <div
            onClick={() => onClick(asset)}
            className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors gap-3"
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`p-2 rounded-lg shrink-0 ${isOn ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                    <Power size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-700 truncate">{asset.type}</p>
                        {asset.flowType && (
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0 ${asset.flowType === 'producer' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                asset.flowType === 'consumer' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    'bg-purple-50 text-purple-600 border-purple-100'
                                }`}>
                                {asset.flowType}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500 truncate">{asset.details}</p>
                        <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-medium shrink-0">
                            {isOn ? Math.abs(asset.val || 0) : 'Off'}
                        </span>
                    </div>
                </div>
            </div>
            <Toggle isOn={isOn} disabled={disabled} onToggle={() => onToggle(asset)} title={disabled ? 'Admin access needed' : 'Toggle Power'} />
        </div>
    );
};

export const SystemControls = ({ onNavigate, className = 'h-64' }) => {
    const { assets, updateAsset } = useAssets();
    const { isAdmin } = useAuth();
    const { selectedVillage, selectedVillageId, setMetricValue } = useVillageSensors();
    const { effectiveReadings, insights } = useVillageInsights();
    const [pumpBusy, setPumpBusy] = useState(false);
    const [pumpError, setPumpError] = useState(null);

    const pump = effectiveReadings.pump;
    const pumpOn = pump?.value === 1;
    const isLiveVillage = selectedVillage?.deployment === 'live';
    const tank = effectiveReadings.water_level_tank;
    const pumpAdvice = insights.water.alerts.find((a) => a.metricKey === 'pump' || a.metricKey === 'water_level_tank');

    const controllableAssets = assets.filter((a) => a.category === 'controls' || (a.category === 'energy' && a.flowType !== 'sensor'));

    const handleAssetToggle = async (asset) => {
        if (!isAdmin) return;
        const newStatus = asset.status === 'offline' ? 'normal' : 'offline';
        try {
            await updateAsset(asset.firebaseId || asset.id, { status: newStatus });
        } catch (error) {
            console.error('Failed to toggle asset:', error);
        }
    };

    const handlePumpToggle = async () => {
        if (!isAdmin) return;
        setPumpBusy(true);
        setPumpError(null);
        try {
            await setMetricValue(selectedVillageId, 'pump', !pumpOn);
        } catch (error) {
            console.error('Failed to toggle pump:', error);
            setPumpError(error?.message || 'Write failed');
        } finally {
            setPumpBusy(false);
        }
    };

    return (
        <div className={`bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-xl flex flex-col overflow-hidden ${className}`}>
            <h3 className="text-slate-600 font-semibold mb-4 text-sm uppercase tracking-wider flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Settings2 size={16} />
                    System Controls
                </div>
                {!isAdmin && (
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold border border-slate-200">
                        View Only
                    </span>
                )}
            </h3>

            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {/* Village water pump (rps-sahrdaya sensor DB) */}
                {isLiveVillage && pump && (
                    <div
                        onClick={() => onNavigate && onNavigate('live', { metricKey: 'pump' })}
                        className="flex items-center justify-between p-3 bg-cyan-50/60 rounded-xl border border-cyan-100 cursor-pointer hover:bg-cyan-50 transition-colors gap-3"
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`p-2 rounded-lg shrink-0 ${pumpOn ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                <Droplets size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-700 truncate">Water Pump · {selectedVillage.name}</p>
                                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${pump.source === 'live' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {pump.source === 'live' ? 'Live' : 'Baseline'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">
                                    Tank {tank?.value ?? '—'} % · {pumpAdvice ? pumpAdvice.title : pumpOn ? 'Running' : 'Idle'}
                                </p>
                                {pumpError && (
                                    <p className="text-[11px] text-red-600 flex items-center gap-1 mt-0.5"><AlertCircle size={11} /> {pumpError}</p>
                                )}
                            </div>
                        </div>
                        <Toggle isOn={pumpOn} disabled={!isAdmin} busy={pumpBusy} onToggle={handlePumpToggle} title={!isAdmin ? 'Admin access needed' : (pumpOn ? 'Turn pump OFF' : 'Turn pump ON')} />
                    </div>
                )}

                {controllableAssets.map((asset) => (
                    <ControlItem
                        key={asset.id}
                        asset={asset}
                        onToggle={handleAssetToggle}
                        onClick={() => onNavigate && onNavigate('live', { assetId: asset.id })}
                        disabled={!isAdmin}
                    />
                ))}

                {!isLiveVillage && controllableAssets.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm p-4 text-center">
                        <Activity size={24} className="mb-2 opacity-50" />
                        No controllable systems online.
                    </div>
                )}
            </div>
        </div>
    );
};
