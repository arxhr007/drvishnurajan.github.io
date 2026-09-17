import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, BrainCircuit, Gauge } from 'lucide-react';
import { useVillageInsights } from '../../../hooks/useVillageInsights';
import { useAssets } from '../../../hooks/useAssets';
import { useParking } from '../../../hooks/useParking';

const SEVERITY_STYLES = {
    critical: { wrap: 'bg-red-50 border-red-100', icon: 'text-red-500', title: 'text-red-700', text: 'text-red-600/90', chip: 'bg-red-100 text-red-700', Icon: AlertCircle },
    warning: { wrap: 'bg-orange-50 border-orange-100', icon: 'text-orange-500', title: 'text-orange-700', text: 'text-orange-600/90', chip: 'bg-orange-100 text-orange-700', Icon: AlertTriangle },
    info: { wrap: 'bg-sky-50 border-sky-100', icon: 'text-sky-500', title: 'text-sky-700', text: 'text-sky-600/90', chip: 'bg-sky-100 text-sky-700', Icon: Info }
};

const GROUP_CHIP = {
    agriculture: 'bg-emerald-100 text-emerald-700',
    water: 'bg-cyan-100 text-cyan-700',
    energy: 'bg-amber-100 text-amber-700',
    parking: 'bg-rose-100 text-rose-700',
    asset: 'bg-slate-100 text-slate-600'
};

export const AlertsPanel = ({ onNavigate, className = '' }) => {
    const { alerts, village } = useVillageInsights();
    const { assets } = useAssets();
    const { emergencyOccupied, stats: parkingStats, config: parkingConfig } = useParking();

    const parkingAlerts = emergencyOccupied ? [{
        id: 'parking-emergency',
        severity: 'critical',
        group: 'parking',
        view: 'parking',
        title: 'Emergency bay occupied',
        message: `${parkingConfig.name}: ambulance bay ${parkingStats.emergency?.bay} is blocked (${parkingStats.emergency?.distance ?? '—'} cm). Clear it immediately.`,
        source: 'threshold'
    }] : [];

    const assetAlerts = assets
        .filter((asset) => asset.status === 'critical' || asset.status === 'warning')
        .map((asset) => ({
            id: `asset-${asset.id}`,
            severity: asset.status,
            group: 'asset',
            assetId: asset.id,
            title: asset.type,
            message: (asset.incidents && asset.incidents[0]) || asset.details || 'Threshold exceeded',
            source: 'threshold'
        }));

    const all = [...parkingAlerts, ...alerts, ...assetAlerts];
    const criticalCount = all.filter((a) => a.severity === 'critical').length;

    return (
        <div className={`bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-xl flex flex-col overflow-hidden ${className}`}>
            <h3 className="text-slate-600 font-semibold mb-3 text-sm uppercase tracking-wider flex items-center justify-between">
                <span>Alerts · {village?.name}</span>
                {all.length > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${criticalCount ? 'bg-red-100 text-red-600 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                        {all.length} active
                    </span>
                )}
            </h3>

            <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0">
                {all.length > 0 ? all.map((alert) => {
                    const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
                    const Icon = style.Icon;
                    return (
                        <button
                            key={alert.id}
                            onClick={() => onNavigate && (alert.view ? onNavigate(alert.view) : onNavigate('live', alert.assetId ? { assetId: alert.assetId } : { metricKey: alert.metricKey }))}
                            className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all hover:shadow-md active:scale-[0.99] ${style.wrap}`}
                        >
                            <Icon size={18} className={`${style.icon} shrink-0 mt-0.5`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className={`${style.title} text-sm font-semibold`}>{alert.title}</h4>
                                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${GROUP_CHIP[alert.group] || GROUP_CHIP.asset}`}>{alert.group}</span>
                                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/70 text-slate-500 border border-slate-200 inline-flex items-center gap-1" title={alert.source === 'model' ? 'Raised by the ML model' : 'Raised by a threshold rule'}>
                                        {alert.source === 'model' ? <BrainCircuit size={9} /> : <Gauge size={9} />}
                                        {alert.source === 'model' ? 'model' : 'rule'}
                                    </span>
                                </div>
                                <p className={`${style.text} text-xs leading-relaxed mt-1`}>{alert.message}</p>
                            </div>
                        </button>
                    );
                }) : (
                    <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-100 rounded-xl">
                        <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-green-700 text-sm font-medium">All Systems Normal</h4>
                            <p className="text-green-600/80 text-xs mt-1">No threshold or model alerts for {village?.name}.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
