import React, { useMemo, useState } from 'react';
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useVillageInsights } from '../../../hooks/useVillageInsights';
import { formatHourLabel, formatDayHourLabel } from '../../../data/syntheticHistory';

const RANGES = [
    { id: '24h', label: '24 h', hours: 24 },
    { id: '72h', label: '3 d', hours: 72 },
    { id: '7d', label: '7 d', hours: 168 }
];

const TOOLTIP_STYLE = { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 12, color: '#1e293b', fontSize: 12 };

const ChartCard = ({ title, subtitle, children }) => (
    <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-xl flex flex-col h-72">
        <div className="mb-3">
            <h3 className="text-slate-600 font-semibold text-sm uppercase tracking-wider">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
    </div>
);

const axisProps = { tick: { fontSize: 10 }, stroke: '#94a3b8', tickLine: false, axisLine: false };

export const TrendCharts = () => {
    const { hourly, village, dataSource, liveSamples } = useVillageInsights();
    const [rangeId, setRangeId] = useState('24h');
    const range = RANGES.find((r) => r.id === rangeId) || RANGES[0];

    const data = useMemo(() => {
        const slice = hourly.slice(-range.hours);
        const label = range.hours > 24 ? formatDayHourLabel : formatHourLabel;
        return slice.map((s) => ({ ...s, time: label(s.ts) }));
    }, [hourly, range]);

    const liveHours = data.filter((d) => d.source === 'live').length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Trends · {village?.name}</h3>
                    <span className="text-[11px] text-slate-400">
                        {dataSource === 'synthetic'
                            ? 'synthetic 7-day baseline'
                            : `${liveHours} live hour${liveHours === 1 ? '' : 's'} over synthetic baseline (${liveSamples.length} samples)`}
                    </span>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {RANGES.map((r) => (
                        <button
                            key={r.id}
                            onClick={() => setRangeId(r.id)}
                            className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition-all ${rangeId === r.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ChartCard title="Energy (Wh / hour)" subtitle="Solar, windmill and household consumption">
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="time" {...axisProps} interval="preserveStartEnd" minTickGap={28} />
                        <YAxis {...axisProps} width={40} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Area type="monotone" dataKey="solar_output_wh" name="Solar" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Area type="monotone" dataKey="windmill_output_wh" name="Wind" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="household_consumption_wh" name="Consumption" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                </ChartCard>

                <ChartCard title="Water (levels & rain)" subtitle="Tank and dam level (%) with rain index (%)">
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="time" {...axisProps} interval="preserveStartEnd" minTickGap={28} />
                        <YAxis yAxisId="left" domain={[0, 100]} {...axisProps} width={36} />
                        <YAxis yAxisId="right" orientation="right" {...axisProps} width={36} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar yAxisId="right" dataKey="rain_intensity" name="Rain" fill="#3b82f6" fillOpacity={0.35} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="water_level_tank" name="Tank" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="water_level_dam" name="Dam" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line yAxisId="left" type="step" dataKey="pump" name="Pump (0/1)" stroke="#94a3b8" strokeWidth={1} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                </ChartCard>

                <ChartCard title="Agriculture (field climate)" subtitle="Soil moisture (%), temperature (°C) and humidity (%)">
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="time" {...axisProps} interval="preserveStartEnd" minTickGap={28} />
                        <YAxis yAxisId="left" domain={[0, 100]} {...axisProps} width={36} />
                        <YAxis yAxisId="right" orientation="right" domain={[15, 45]} {...axisProps} width={36} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Area yAxisId="left" type="monotone" dataKey="soil_moisture" name="Soil moisture" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line yAxisId="left" type="monotone" dataKey="humidity" name="Humidity" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="temperature" name="Temperature" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                </ChartCard>
            </div>
        </div>
    );
};
