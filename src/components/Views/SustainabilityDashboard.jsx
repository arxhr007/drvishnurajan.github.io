import React, { useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Droplets,
    Leaf,
    Shield,
    Sprout,
    TimerReset,
    Wind,
    Zap
} from 'lucide-react';
import { DashboardCard } from '../Shared/DashboardCard';
import { DemoEncryptionNotice } from '../Shared/DemoEncryptionNotice';
import {
    BASELINE_SUSTAINABILITY_PROFILE,
    EMISSIONS_BY_SECTOR,
    RESOURCE_COUPLING_SERIES,
    SUSTAINABILITY_COLLECTION_METHODS,
    SUSTAINABILITY_METRIC_CONFIDENCE,
    SUSTAINABILITY_ANOMALIES,
    SUSTAINABILITY_SCENARIOS,
    SUSTAINABILITY_TARGETS,
    SUSTAINABILITY_TREND_SERIES,
    ZONE_SUSTAINABILITY_STATUS
} from '../../data/cps/sustainabilityData';
import {
    applySustainabilityScenario,
    buildScenarioAdjustedTrend,
    summarizeTargetProgress
} from '../../utils/sustainabilityMetrics';
import { CPS_AXIS_TICK, CPS_GRID_STYLE, CPS_PALETTE, CPS_TOOLTIP_STYLE } from './shared/CpsChartTheme';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const StatCard = ({ label, value, unit, icon: Icon, tone = 'green' }) => {
    const tones = {
        green: 'bg-green-50 border-green-100 text-green-600',
        blue: 'bg-blue-50 border-blue-100 text-blue-600',
        amber: 'bg-amber-50 border-amber-100 text-amber-600',
        red: 'bg-red-50 border-red-100 text-red-600',
        cyan: 'bg-cyan-50 border-cyan-100 text-cyan-600',
        violet: 'bg-violet-50 border-violet-100 text-violet-600'
    };

    return (
        <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{value}</span>
                        {unit ? <span className="text-sm text-slate-500">{unit}</span> : null}
                    </div>
                </div>
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${tones[tone] || tones.green}`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
};

const statusTone = {
    'on-track': 'bg-green-100 text-green-700 border-green-200',
    watch: 'bg-amber-100 text-amber-700 border-amber-200',
    'off-track': 'bg-red-100 text-red-700 border-red-200'
};

const anomalyTone = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    normal: 'bg-green-100 text-green-700 border-green-200'
};

export const SustainabilityDashboard = () => {
    const [scenarioKey, setScenarioKey] = useState('baseline');
    const [adoptionPct, setAdoptionPct] = useState(75);
    const [focusZone, setFocusZone] = useState('All Zones');
    const [resilienceBias, setResilienceBias] = useState(0);

    const scenario = SUSTAINABILITY_SCENARIOS[scenarioKey] || SUSTAINABILITY_SCENARIOS.baseline;

    const scenarioMetrics = useMemo(() => {
        const projected = applySustainabilityScenario(BASELINE_SUSTAINABILITY_PROFILE, scenario, adoptionPct);
        const adjustedResilience = clamp(projected.resilienceScore + resilienceBias, 0, 100);

        return {
            ...projected,
            resilienceScore: adjustedResilience,
            ecoScore: clamp(projected.ecoScore + resilienceBias * 0.12, 0, 100)
        };
    }, [adoptionPct, resilienceBias, scenario]);

    const trendSeries = useMemo(() => {
        return buildScenarioAdjustedTrend(SUSTAINABILITY_TREND_SERIES, scenario, adoptionPct).map((point) => ({
            ...point,
            ecoScore: clamp(point.ecoScore + resilienceBias * 0.12, 0, 100)
        }));
    }, [adoptionPct, resilienceBias, scenario]);

    const zoneOptions = useMemo(() => ['All Zones', ...ZONE_SUSTAINABILITY_STATUS.map((zone) => zone.zone)], []);

    const zoneRows = useMemo(() => {
        const adoption = adoptionPct / 100;
        const selected = focusZone === 'All Zones'
            ? ZONE_SUSTAINABILITY_STATUS
            : ZONE_SUSTAINABILITY_STATUS.filter((zone) => zone.zone === focusZone);

        return selected.map((zone) => {
            const energy = clamp(zone.energy + (scenario.renewableDeltaPct || 0) * 0.35 * adoption, 0, 100);
            const water = clamp(zone.water + (scenario.waterEfficiencyDeltaPct || 0) * 0.45 * adoption, 0, 100);
            const waste = clamp(zone.waste + (scenario.wasteDiversionDeltaPct || 0) * 0.4 * adoption, 0, 100);
            const resilience = clamp(zone.resilience + (scenario.resilienceDeltaPct || 0) * 0.5 * adoption + resilienceBias, 0, 100);
            const score = energy * 0.28 + water * 0.24 + waste * 0.24 + resilience * 0.24;

            return {
                zone: zone.zone,
                energy,
                water,
                waste,
                resilience,
                score: Number(score.toFixed(1))
            };
        });
    }, [adoptionPct, focusZone, resilienceBias, scenario]);

    const emissionsSeries = useMemo(() => {
        const emissionsLift = (scenario.emissionsDeltaPct || 0) * (adoptionPct / 100);
        return EMISSIONS_BY_SECTOR.map((item) => ({
            ...item,
            emissionsKg: Number((item.emissionsKg * (1 + emissionsLift / 100)).toFixed(1))
        }));
    }, [adoptionPct, scenario.emissionsDeltaPct]);

    const couplingSeries = useMemo(() => {
        const emissionsLift = (scenario.emissionsDeltaPct || 0) * (adoptionPct / 100);
        const waterLift = (scenario.waterEfficiencyDeltaPct || 0) * (adoptionPct / 100);
        const wasteLift = (scenario.wasteDiversionDeltaPct || 0) * (adoptionPct / 100);

        return RESOURCE_COUPLING_SERIES.map((item) => ({
            ...item,
            microgridKw: Number((item.microgridKw * (1 + emissionsLift * 0.25 / 100)).toFixed(1)),
            irrigationKl: Number((item.irrigationKl * (1 - waterLift * 0.35 / 100)).toFixed(1)),
            treatmentKl: Number((item.treatmentKl * (1 - waterLift * 0.28 / 100)).toFixed(1)),
            wasteToEnergyKw: Number((item.wasteToEnergyKw * (1 + wasteLift * 0.4 / 100)).toFixed(1))
        }));
    }, [adoptionPct, scenario.emissionsDeltaPct, scenario.waterEfficiencyDeltaPct, scenario.wasteDiversionDeltaPct]);

    const targetProgress = useMemo(() => {
        return summarizeTargetProgress(scenarioMetrics, SUSTAINABILITY_TARGETS);
    }, [scenarioMetrics]);

    const filteredAnomalies = useMemo(() => {
        if (focusZone === 'All Zones') return SUSTAINABILITY_ANOMALIES;
        const scoped = SUSTAINABILITY_ANOMALIES.filter((incident) => incident.zone === focusZone);
        return scoped.length ? scoped : SUSTAINABILITY_ANOMALIES;
    }, [focusZone]);

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Sprout size={24} className="text-green-600" />
                        Sustainability Dashboard
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Real-time village sustainability view from feeder, water, and waste sensor networks with cross-domain analytics
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">Scenario: {scenario.label}</span>
                    <span className="px-2 py-1 rounded-full bg-slate-200 text-slate-700">Adoption {adoptionPct}%</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-100 text-cyan-700">Unified sensor mesh</span>
                </div>
            </div>

            <DemoEncryptionNotice />

            <DashboardCard title="How Sustainability Data Is Collected">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Village Data Channels</p>
                        <div className="space-y-2">
                            {SUSTAINABILITY_COLLECTION_METHODS.map((method) => (
                                <div key={method.channel} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                                    <p className="text-sm font-semibold text-slate-800">{method.channel}</p>
                                    <p className="text-xs text-slate-600 mt-1">Coverage: {method.coverage}</p>
                                    <p className="text-xs text-slate-600">Cadence: {method.cadence}</p>
                                    <p className="text-xs text-slate-500 mt-1">Owner: {method.owner}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Metric Confidence</p>
                        <div className="space-y-2">
                            {SUSTAINABILITY_METRIC_CONFIDENCE.map((item) => (
                                <div key={item.metric} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-slate-800">{item.metric}</p>
                                        <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold border ${
                                            item.confidence === 'High'
                                                ? 'bg-green-100 text-green-700 border-green-200'
                                                : item.confidence === 'Medium'
                                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}>
                                            {item.confidence}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1">{item.sourceMix}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <p className="text-xs text-slate-600 mt-3">
                    Zone-level and system-level scores are computed from continuous sensor streams synchronized through gateway brokers and edge analytics.
                </p>
            </DashboardCard>

            <DashboardCard title="Sustainability Scenario Console">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <label className="text-sm text-slate-600 font-medium">
                        Scenario
                        <select
                            value={scenarioKey}
                            onChange={(event) => setScenarioKey(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                        >
                            {Object.entries(SUSTAINABILITY_SCENARIOS).map(([key, value]) => (
                                <option key={key} value={key}>{value.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="text-sm text-slate-600 font-medium">
                        Zone Lens
                        <select
                            value={focusZone}
                            onChange={(event) => setFocusZone(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                        >
                            {zoneOptions.map((zone) => (
                                <option key={zone} value={zone}>{zone}</option>
                            ))}
                        </select>
                    </label>

                    <label className="text-sm text-slate-600 font-medium">
                        Policy Adoption: <span className="font-bold text-slate-800">{adoptionPct}%</span>
                        <input
                            type="range"
                            min="25"
                            max="100"
                            value={adoptionPct}
                            onChange={(event) => setAdoptionPct(Number(event.target.value))}
                            className="mt-2 w-full"
                        />
                    </label>

                    <label className="text-sm text-slate-600 font-medium">
                        Resilience Bias: <span className="font-bold text-slate-800">{resilienceBias > 0 ? `+${resilienceBias}` : resilienceBias}</span>
                        <input
                            type="range"
                            min="-8"
                            max="12"
                            value={resilienceBias}
                            onChange={(event) => setResilienceBias(Number(event.target.value))}
                            className="mt-2 w-full"
                        />
                    </label>
                </div>
            </DashboardCard>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                <StatCard label="Eco Score" value={scenarioMetrics.ecoScore.toFixed(1)} unit="" icon={Leaf} tone="green" />
                <StatCard label="Carbon Intensity" value={scenarioMetrics.carbonIntensity.toFixed(3)} unit="kg/kWh" icon={Wind} tone="red" />
                <StatCard label="Renewable Share" value={scenarioMetrics.renewableShare.toFixed(1)} unit="%" icon={Zap} tone="amber" />
                <StatCard label="Water Efficiency" value={scenarioMetrics.waterEfficiency.toFixed(1)} unit="%" icon={Droplets} tone="cyan" />
                <StatCard label="Circularity Index" value={scenarioMetrics.circularityIndex.toFixed(1)} unit="" icon={Activity} tone="violet" />
                <StatCard label="Resilience" value={scenarioMetrics.resilienceScore.toFixed(1)} unit="" icon={Shield} tone="blue" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Eco Score and Circularity Trend" className="xl:col-span-2">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendSeries}>
                                <CartesianGrid {...CPS_GRID_STYLE} vertical={false} />
                                <XAxis dataKey="time" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} />
                                <YAxis tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} width={44} domain={[50, 100]} />
                                <Tooltip contentStyle={CPS_TOOLTIP_STYLE} />
                                <Line type="monotone" dataKey="ecoScore" name="Eco Score" stroke={CPS_PALETTE.emerald} strokeWidth={2.5} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="circularity" name="Circularity" stroke={CPS_PALETTE.violet} strokeWidth={2.5} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="waterEfficiency" name="Water Efficiency" stroke={CPS_PALETTE.cyan} strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Carbon Intensity and Renewable Share">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendSeries}>
                                <defs>
                                    <linearGradient id="carbonFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CPS_PALETTE.red} stopOpacity={0.35} />
                                        <stop offset="95%" stopColor={CPS_PALETTE.red} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid {...CPS_GRID_STYLE} vertical={false} />
                                <XAxis dataKey="time" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="left" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} width={42} domain={[0.2, 0.55]} />
                                <YAxis yAxisId="right" orientation="right" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} width={40} domain={[40, 90]} />
                                <Tooltip contentStyle={CPS_TOOLTIP_STYLE} />
                                <Area yAxisId="left" type="monotone" dataKey="carbonIntensity" name="Carbon" stroke={CPS_PALETTE.red} fill="url(#carbonFill)" strokeWidth={2} />
                                <Line yAxisId="right" type="monotone" dataKey="renewableShare" name="Renewable %" stroke={CPS_PALETTE.amber} strokeWidth={2.5} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Emissions by Sector" className="xl:col-span-1">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={emissionsSeries} layout="vertical" margin={{ left: 30 }}>
                                <CartesianGrid {...CPS_GRID_STYLE} horizontal={false} />
                                <XAxis type="number" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="sector" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} width={120} />
                                <Tooltip contentStyle={CPS_TOOLTIP_STYLE} />
                                <Bar dataKey="emissionsKg" name="kg CO2e" fill={CPS_PALETTE.red} radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Cross-Domain Resource Coupling" className="xl:col-span-2">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={couplingSeries}>
                                <defs>
                                    <linearGradient id="gridFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CPS_PALETTE.blue} stopOpacity={0.25} />
                                        <stop offset="95%" stopColor={CPS_PALETTE.blue} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid {...CPS_GRID_STYLE} vertical={false} />
                                <XAxis dataKey="time" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} />
                                <YAxis tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} width={46} />
                                <Tooltip contentStyle={CPS_TOOLTIP_STYLE} />
                                <Area type="monotone" dataKey="microgridKw" name="Microgrid kW" stroke={CPS_PALETTE.blue} fill="url(#gridFill)" strokeWidth={2} />
                                <Line type="monotone" dataKey="irrigationKl" name="Irrigation kL" stroke={CPS_PALETTE.cyan} strokeWidth={2.2} dot={false} />
                                <Line type="monotone" dataKey="treatmentKl" name="Treatment kL" stroke={CPS_PALETTE.emerald} strokeWidth={2.2} dot={false} />
                                <Line type="monotone" dataKey="wasteToEnergyKw" name="Waste-to-Energy kW" stroke={CPS_PALETTE.amber} strokeWidth={2.2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Zone Sustainability Watch" className="xl:col-span-2">
                    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 mb-3">
                        <p className="text-xs text-cyan-800 font-semibold uppercase tracking-wider">What Zone Sustainability Means</p>
                        <p className="text-xs text-cyan-800 mt-1">
                            Each zone score (0-100) combines Energy Reliability (28%), Water Service Efficiency (24%), Waste Circularity (24%), and Resilience Uptime (24%) from zone sensor feeds.
                        </p>
                        <p className="text-[11px] text-cyan-700 mt-1">
                            Above 75 is healthy, 60-75 needs intervention planning, below 60 requires active control actions.
                        </p>
                    </div>
                    <div className="space-y-3">
                        {zoneRows.map((zone) => (
                            <div key={zone.zone} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-800">{zone.zone}</p>
                                    <span className="text-sm font-bold text-slate-800">Score {zone.score.toFixed(1)}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                                    {[
                                        { label: 'Energy', value: zone.energy, color: 'bg-amber-500' },
                                        { label: 'Water', value: zone.water, color: 'bg-cyan-500' },
                                        { label: 'Waste', value: zone.waste, color: 'bg-emerald-500' },
                                        { label: 'Resilience', value: zone.resilience, color: 'bg-violet-500' }
                                    ].map((item) => (
                                        <div key={item.label}>
                                            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{item.label}</p>
                                            <div className="mt-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                                                <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }} />
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1">{item.value.toFixed(1)}%</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </DashboardCard>

                <DashboardCard title="Target Tracker">
                    <div className="space-y-3">
                        {targetProgress.map((target) => (
                            <div key={target.metric} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-800">{target.metric}</p>
                                    <span className={`text-[11px] px-2 py-1 rounded-full border font-semibold ${statusTone[target.status] || statusTone.watch}`}>
                                        {target.status}
                                    </span>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(target.progress, 100)}%` }} />
                                </div>
                                <p className="mt-2 text-xs text-slate-600">
                                    Current {target.current.toFixed(target.metric === 'Carbon Intensity' ? 3 : 1)} • Target {target.target}
                                    {' '}• Deadline {target.deadline}
                                </p>
                            </div>
                        ))}
                    </div>
                </DashboardCard>
            </div>

            <DashboardCard title="Anomaly and Recommendation Feed">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                    {filteredAnomalies.map((anomaly) => (
                        <div key={anomaly.id} className="rounded-xl border border-slate-200 bg-white/70 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-slate-500 font-semibold">{anomaly.time} • {anomaly.zone}</p>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${anomalyTone[anomaly.severity] || anomalyTone.normal}`}>
                                    {anomaly.severity}
                                </span>
                            </div>
                            <p className="text-sm font-medium text-slate-800 mt-2">{anomaly.message}</p>
                            <p className="text-xs text-slate-600 mt-2">{anomaly.recommendation}</p>
                            <p className="text-[11px] text-slate-500 mt-1">Source: {anomaly.source} • Confidence: {anomaly.confidence}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                        <AlertTriangle size={14} className="mt-0.5" />
                        Trigger demand response when carbon intensity crosses 0.40 kg/kWh for 2 consecutive intervals.
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex items-start gap-2">
                        <TimerReset size={14} className="mt-0.5" />
                        Shift non-critical pumping cycles to solar-rich windows between 10:00 and 15:00.
                    </div>
                    <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-800 flex items-start gap-2">
                        <CheckCircle2 size={14} className="mt-0.5" />
                        Current scenario improves circularity by {(scenarioMetrics.circularityIndex - BASELINE_SUSTAINABILITY_PROFILE.wasteDiversion).toFixed(1)} points.
                    </div>
                </div>
            </DashboardCard>
        </div>
    );
};