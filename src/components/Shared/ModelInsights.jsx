import React from 'react';
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BrainCircuit, Sprout, Droplets, Zap } from 'lucide-react';
import { useVillageInsights } from '../../hooks/useVillageInsights';

const GROUP_META = {
    agriculture: { Icon: Sprout, tone: 'text-emerald-600 bg-emerald-50 border-emerald-100', bar: 'bg-emerald-500', stroke: '#10b981' },
    water: { Icon: Droplets, tone: 'text-cyan-600 bg-cyan-50 border-cyan-100', bar: 'bg-cyan-500', stroke: '#06b6d4' },
    energy: { Icon: Zap, tone: 'text-amber-600 bg-amber-50 border-amber-100', bar: 'bg-amber-500', stroke: '#f59e0b' }
};

const TOOLTIP_STYLE = { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 12, color: '#1e293b', fontSize: 12 };

const Prediction = ({ prediction, bar }) => (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 min-w-0" title={prediction.method}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">{prediction.label}</p>
        <p className="text-base font-bold text-slate-800 truncate">
            {prediction.value}
            {prediction.unit && <span className="text-[11px] font-medium text-slate-500 ml-1">{prediction.unit}</span>}
        </p>
        <div className="mt-1 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-slate-200 overflow-hidden">
                <div className={`h-full ${bar}`} style={{ width: `${prediction.confidence}%` }} />
            </div>
            <span className="text-[9px] text-slate-400 shrink-0">{prediction.confidence}% conf.</span>
        </div>
    </div>
);

const ForecastChart = ({ group, model }) => {
    const meta = GROUP_META[group];
    if (group === 'energy') {
        return (
            <ComposedChart data={model.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="solar" name="Solar" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="wind" name="Wind" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="load" name="Consumption" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="solarForecast" name="Solar forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="windForecast" name="Wind forecast" stroke="#06b6d4" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="loadForecast" name="Load forecast" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
            </ComposedChart>
        );
    }
    return (
        <ComposedChart data={model.series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} axisLine={false} width={36} />
            {group === 'water' && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#94a3b8" tickLine={false} axisLine={false} width={36} />}
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {group === 'water' && <Bar yAxisId="right" dataKey="rain" name="Rain (mm/h)" fill="#3b82f6" fillOpacity={0.35} isAnimationActive={false} />}
            <Area yAxisId="left" type="monotone" dataKey="actual" name={model.seriesKeys.actual} stroke={meta.stroke} fill={meta.stroke} fillOpacity={0.2} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            <Line yAxisId="left" type="monotone" dataKey="forecast" name={model.seriesKeys.forecast} stroke={meta.stroke} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
        </ComposedChart>
    );
};

/**
 * ML predictions + forecast chart for one domain (agriculture / water / energy)
 * of the selected village.
 */
export const ModelInsights = ({ group, compact = false, className = '' }) => {
    const { insights, dataSource, village } = useVillageInsights();
    const model = insights[group];
    const meta = GROUP_META[group] || GROUP_META.water;
    const Icon = meta.Icon;
    if (!model) return null;

    return (
        <div className={`bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-xl flex flex-col gap-3 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${meta.tone}`}>
                        <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-slate-700 font-semibold text-sm uppercase tracking-wider truncate">{model.label} · Predictions</h3>
                        <p className="text-[11px] text-slate-500 truncate">{village?.name} · {dataSource === 'live' ? 'live data' : dataSource === 'mixed' ? 'live + baseline' : 'synthetic baseline'}</p>
                    </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                    <BrainCircuit size={11} /> ML
                </span>
            </div>

            <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">{model.summary}</p>

            <div className={`grid gap-2 ${compact ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
                {model.predictions.slice(0, compact ? 6 : 6).map((prediction) => (
                    <Prediction key={prediction.key} prediction={prediction} bar={meta.bar} />
                ))}
            </div>

            <div className={compact ? 'h-44' : 'h-52'}>
                <ResponsiveContainer width="100%" height="100%">
                    <ForecastChart group={group} model={model} />
                </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {model.methods.map((method) => (
                    <span key={method} className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">{method}</span>
                ))}
            </div>
        </div>
    );
};
