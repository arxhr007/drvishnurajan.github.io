import React from 'react';
import { Sun, Zap, Activity, AlertTriangle, Server, Droplets, Cylinder } from 'lucide-react';
import { useVillageInsights } from '../../../hooks/useVillageInsights';
import { useAssets } from '../../../hooks/useAssets';
import { SENSOR_METRICS } from '../../../data/sensorSchema';
import { formatReading } from '../../Shared/SensorWidgets';

const KPI = ({ label, value, unit, sub, icon: Icon, color, onClick, badge }) => (
    <button
        type="button"
        onClick={onClick}
        className="bg-white/70 backdrop-blur-md border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-lg flex-1 min-w-[200px] hover:bg-white transition-colors text-left group"
    >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color} bg-opacity-20`}>
            <Icon size={24} className={color.replace('bg-', 'text-')} />
        </div>
        <div className="min-w-0">
            <div className="flex items-center gap-2">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider truncate">{label}</p>
                {badge && <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${badge === 'live' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{badge === 'live' ? 'Live' : 'Baseline'}</span>}
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-800 tracking-tight group-hover:scale-105 transition-transform origin-left truncate">{value}</span>
                <span className="text-sm text-slate-600 font-medium shrink-0">{unit}</span>
            </div>
            {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
        </div>
    </button>
);

export const VillageKPIs = ({ onNavigate }) => {
    const { effectiveReadings: r, insights, alerts, liveCount } = useVillageInsights();
    const { assets } = useAssets();
    const totals = insights.energy.totals;
    const net = totals.genToday - totals.loadToday;
    const assetsOnline = assets.filter((a) => a.status !== 'offline').length;
    const soil = r.soil_moisture;
    const tank = r.water_level_tank;
    const hoursToLow = insights.water.predictions.find((p) => p.key === 'hours_to_low');

    const goLive = (metricKey) => () => onNavigate && onNavigate('live', { metricKey });

    return (
        <div className="flex flex-wrap gap-4 w-full">
            <KPI
                label="Generation today"
                value={totals.genToday.toLocaleString('en-IN')}
                unit="Wh"
                sub={`Solar ${totals.solarToday.toLocaleString('en-IN')} · Wind ${totals.windToday.toLocaleString('en-IN')}`}
                icon={Sun}
                color="bg-green-500"
                badge={r.solar_output_wh.source}
                onClick={goLive('solar_output_wh')}
            />
            <KPI
                label="Consumption today"
                value={totals.loadToday.toLocaleString('en-IN')}
                unit="Wh"
                sub={`Peak ${totals.peakValue} Wh expected @ ${String(totals.peakHour).padStart(2, '0')}:00`}
                icon={Zap}
                color="bg-yellow-500"
                badge={r.household_consumption_wh.source}
                onClick={goLive('household_consumption_wh')}
            />
            <KPI
                label="Net balance"
                value={`${net >= 0 ? '+' : ''}${net.toLocaleString('en-IN')}`}
                unit="Wh"
                sub={`${totals.selfSufficiency} % self-sufficient · ${totals.projectedBalance >= 0 ? '+' : ''}${totals.projectedBalance} Wh by midnight`}
                icon={Activity}
                color={net >= 0 ? 'bg-emerald-500' : 'bg-blue-500'}
                onClick={() => onNavigate && onNavigate('energy-dashboard')}
            />
            <KPI
                label="Soil moisture"
                value={formatReading(soil)}
                unit="%"
                sub={soil.message}
                icon={Droplets}
                color={soil.status === 'critical' ? 'bg-red-500' : soil.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}
                badge={soil.source}
                onClick={goLive('soil_moisture')}
            />
            <KPI
                label="Tank level"
                value={formatReading(tank)}
                unit="%"
                sub={hoursToLow ? `Below 20 % in ${hoursToLow.value}${hoursToLow.unit ? ` ${hoursToLow.unit}` : ''} · pump ${r.pump.value ? 'ON' : 'OFF'}` : `Pump ${r.pump.value ? 'ON' : 'OFF'}`}
                icon={Cylinder}
                color={tank.status === 'critical' ? 'bg-red-500' : tank.status === 'warning' ? 'bg-amber-500' : 'bg-cyan-500'}
                badge={tank.source}
                onClick={goLive('water_level_tank')}
            />
            <KPI
                label="Active alerts"
                value={alerts.length}
                unit="Alerts"
                sub={alerts.length ? alerts[0].title : 'All systems normal'}
                icon={AlertTriangle}
                color={alerts.some((a) => a.severity === 'critical') ? 'bg-red-500' : alerts.length ? 'bg-amber-500' : 'bg-emerald-500'}
            />
            <KPI
                label="Nodes reporting"
                value={`${liveCount}/${SENSOR_METRICS.length}`}
                unit="Sensors"
                sub={`${assetsOnline} registered assets online`}
                icon={Server}
                color="bg-purple-500"
                onClick={() => onNavigate && onNavigate('live')}
            />
        </div>
    );
};
