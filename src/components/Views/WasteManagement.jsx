import React, { useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    MapPinned,
    Shield,
    Sprout,
    TimerReset,
    Trash2,
    TriangleAlert,
    Wind,
    Zap
} from 'lucide-react';
import { DashboardCard } from '../Shared/DashboardCard';
import { DemoEncryptionNotice } from '../Shared/DemoEncryptionNotice';
import {
    WASTE_BIN_SENSORS,
    WASTE_COLLECTION_METHODS,
    WASTE_COMPOSITION_TREND,
    WASTE_CONTROL_PROFILES,
    WASTE_GENERATION_SERIES,
    WASTE_INCIDENT_FEED,
    WASTE_SLA_BY_ZONE
} from '../../data/cps/wasteData';
import {
    buildRoutePlan,
    buildWasteForecast,
    calculateOverflowRisk,
    calculateWasteKpis,
    estimateOverflowEtaHours
} from '../../utils/wasteMetrics';
import { CPS_AXIS_TICK, CPS_GRID_STYLE, CPS_PALETTE, CPS_TOOLTIP_STYLE } from './shared/CpsChartTheme';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const StatCard = ({ label, value, unit, icon: Icon, tone = 'blue' }) => {
    const tones = {
        blue: 'bg-blue-50 border-blue-100 text-blue-600',
        green: 'bg-green-50 border-green-100 text-green-600',
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
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${tones[tone] || tones.blue}`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
};

const formatEta = (hours) => {
    if (hours <= 0) return 'Overflow';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
};

const severityTone = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    normal: 'bg-green-100 text-green-700 border-green-200'
};

const wasteTypeColors = {
    organic: CPS_PALETTE.emerald,
    recyclable: CPS_PALETTE.blue,
    hazardous: CPS_PALETTE.red,
    eWaste: CPS_PALETTE.violet,
    residual: CPS_PALETTE.slate,
    mixed: CPS_PALETTE.amber
};

const EDGE_NODE_IDS = new Set(['S-01', 'S-03', 'S-06']);
const MESH_NODE_IDS = new Set(['S-02', 'S-04', 'S-05', 'S-08']);

const CPS_ACTION_LIBRARY = [
    {
        id: 'cps-routing',
        title: 'Dynamic Dispatch Loop',
        trigger: 'Overflow risk above threshold in priority zone',
        actuation: 'Re-rank routes and push fleet updates to onboard unit',
        feedback: 'ETA and overflow risk re-evaluated every 60 seconds'
    },
    {
        id: 'cps-compactor',
        title: 'Adaptive Compaction Loop',
        trigger: 'Fill gradient exceeds projected pickup window',
        actuation: 'Auto-adjust compactor duty cycle with thermal guardrail',
        feedback: 'Fill and power draw tracked for closed-loop tuning'
    },
    {
        id: 'cps-gas',
        title: 'Gas and Odor Mitigation Loop',
        trigger: 'Methane or odor index crosses safety band',
        actuation: 'Enable scrubber and vent-control sequence',
        feedback: 'Gas slope monitored until value returns to safe envelope'
    },
    {
        id: 'cps-resource',
        title: 'Processing Plant Feed Loop',
        trigger: 'Organic stream exceeds digester feed target',
        actuation: 'Divert stream to compost/biogas intake schedule',
        feedback: 'Biogas yield and compost moisture feed next-cycle setpoints'
    }
];

const getMonitoringProfile = (binId) => {
    if (EDGE_NODE_IDS.has(binId)) {
        return {
            mode: 'edge',
            dataSource: 'Direct edge node telemetry',
            cadence: '10-30 sec',
            owner: 'Waste control gateway',
            linkPath: 'DTLS mesh -> MQTT broker'
        };
    }

    if (MESH_NODE_IDS.has(binId)) {
        return {
            mode: 'mesh',
            dataSource: 'Cluster mesh telemetry',
            cadence: '30-90 sec',
            owner: 'Zone mesh gateway',
            linkPath: 'LoRa/RS485 mesh -> edge gateway'
        };
    }

    return {
        mode: 'remote',
        dataSource: 'Remote node telemetry',
        cadence: '2-4 min',
        owner: 'Long-range gateway',
        linkPath: 'LoRaWAN uplink -> gateway bridge'
    };
};

export const WasteManagement = () => {
    const [selectedZone, setSelectedZone] = useState('All Zones');
    const [timeWindow, setTimeWindow] = useState('24h');
    const [controlProfile, setControlProfile] = useState('balanced');
    const [fleetCount, setFleetCount] = useState(3);
    const [riskThreshold, setRiskThreshold] = useState(80);
    const [simControls, setSimControls] = useState({
        compactorBoost: true,
        odorScrubber: true,
        aiRouting: true
    });

    const zones = useMemo(() => {
        return ['All Zones', ...new Set(WASTE_BIN_SENSORS.map((bin) => bin.zone))];
    }, []);

    const activeProfile = WASTE_CONTROL_PROFILES[controlProfile] || WASTE_CONTROL_PROFILES.balanced;

    const filteredBins = useMemo(() => {
        const scope = selectedZone === 'All Zones'
            ? WASTE_BIN_SENSORS
            : WASTE_BIN_SENSORS.filter((bin) => bin.zone === selectedZone);

        return scope.map((bin) => {
            const monitoring = getMonitoringProfile(bin.id);
            const compactionLift = simControls.compactorBoost ? activeProfile.compactionGainPct : 0;
            const scrubberLift = simControls.odorScrubber ? 7 : 0;
            const baselineMethane = bin.methanePpm;
            const baselineOdor = bin.odorIndex;
            const adjustedFill = clamp(bin.fillPct - compactionLift * 0.16, 0, 100);
            const adjustedOdor = clamp(baselineOdor - scrubberLift * 0.14, 0, 10);
            const adjustedSegregation = clamp(bin.segregationScore + activeProfile.segregationLiftPct, 0, 100);

            return {
                ...bin,
                fillPct: Number(adjustedFill.toFixed(1)),
                methanePpm: Number(baselineMethane.toFixed(0)),
                odorIndex: Number(adjustedOdor.toFixed(1)),
                segregationScore: Number(adjustedSegregation.toFixed(1)),
                monitoringMode: monitoring.mode,
                dataSource: monitoring.dataSource,
                verificationCadence: monitoring.cadence,
                lastVerifiedBy: monitoring.owner,
                linkPath: monitoring.linkPath
            };
        });
    }, [activeProfile, selectedZone, simControls.compactorBoost, simControls.odorScrubber]);

    const collectionSeries = useMemo(() => {
        if (timeWindow === '12h') return WASTE_GENERATION_SERIES.slice(-6);
        if (timeWindow === '8h') return WASTE_GENERATION_SERIES.slice(-4);
        return WASTE_GENERATION_SERIES;
    }, [timeWindow]);

    const forecastSeries = useMemo(() => {
        const horizon = timeWindow === '8h' ? 3 : 5;
        return buildWasteForecast(collectionSeries, horizon);
    }, [collectionSeries, timeWindow]);

    const trendSeries = useMemo(() => {
        const liveSeries = collectionSeries.map((point) => ({
            ...point,
            predictedGeneratedKg: null
        }));
        const forecast = forecastSeries.map((point) => ({
            ...point,
            generatedKg: null,
            collectedKg: null,
            predictedGeneratedKg: point.generatedKg
        }));

        return [...liveSeries, ...forecast];
    }, [collectionSeries, forecastSeries]);

    const latestComposition = WASTE_COMPOSITION_TREND[WASTE_COMPOSITION_TREND.length - 1];
    const compositionPie = useMemo(() => ([
        { name: 'Organic', value: latestComposition.organic, color: wasteTypeColors.organic },
        { name: 'Recyclable', value: latestComposition.recyclable, color: wasteTypeColors.recyclable },
        { name: 'Hazardous', value: latestComposition.hazardous, color: wasteTypeColors.hazardous },
        { name: 'E-Waste', value: latestComposition.eWaste, color: wasteTypeColors.eWaste },
        { name: 'Residual', value: latestComposition.residual, color: wasteTypeColors.residual }
    ]), [latestComposition]);

    const routePlan = useMemo(() => {
        const aiLift = simControls.aiRouting ? 1 : 0;
        return buildRoutePlan(filteredBins, fleetCount + aiLift, riskThreshold);
    }, [filteredBins, fleetCount, riskThreshold, simControls.aiRouting]);

    const kpis = useMemo(() => {
        const values = calculateWasteKpis(filteredBins, latestComposition, routePlan);
        const energyPenalty = activeProfile.energyPenaltyPct + (simControls.compactorBoost ? 2 : 0);
        const controlUplift = simControls.aiRouting ? 2.3 : 0;

        return {
            ...values,
            diversionRate: clamp(values.diversionRate + controlUplift, 0, 100),
            routeEfficiency: clamp(values.routeEfficiency + controlUplift * 1.8, 0, 100),
            projectedEnergyPenalty: energyPenalty
        };
    }, [activeProfile.energyPenaltyPct, filteredBins, latestComposition, routePlan, simControls.aiRouting, simControls.compactorBoost]);

    const monitoringStats = useMemo(() => {
        const online = filteredBins.filter((bin) => bin.connectivity === 'online').length;
        const offline = filteredBins.length - online;
        const edge = filteredBins.filter((bin) => bin.monitoringMode === 'edge').length;
        const delayed = filteredBins.filter((bin) => bin.monitoringMode === 'remote').length;

        return {
            online,
            offline,
            edge,
            delayed
        };
    }, [filteredBins]);

    const priorityStops = routePlan.priorityStops.slice(0, 6);

    const cpsActionQueue = useMemo(() => {
        const highestRisk = priorityStops[0];
        const highGasCount = filteredBins.filter((bin) => (bin.methanePpm || 0) >= 85).length;

        return CPS_ACTION_LIBRARY.map((idea) => {
            let active = false;

            if (idea.id === 'cps-routing') active = (highestRisk?.risk || 0) >= riskThreshold;
            if (idea.id === 'cps-compactor') active = simControls.compactorBoost && (kpis.avgFillPct || 0) >= 70;
            if (idea.id === 'cps-gas') active = simControls.odorScrubber && highGasCount > 0;
            if (idea.id === 'cps-resource') active = kpis.compostPotentialKg >= 500;

            return {
                ...idea,
                active
            };
        });
    }, [filteredBins, kpis.avgFillPct, kpis.compostPotentialKg, priorityStops, riskThreshold, simControls.compactorBoost, simControls.odorScrubber]);

    const impactModel = useMemo(() => {
        const overflowReduction = clamp((activeProfile.collectionSpeedGainPct + (simControls.aiRouting ? 5 : 0)) * 1.4, 0, 40);
        const segregationLift = clamp(activeProfile.segregationLiftPct + (simControls.odorScrubber ? 2 : 0), 0, 20);
        const co2Reduction = clamp(segregationLift * 5.2 + overflowReduction * 2.4, 0, 180);

        return {
            overflowReduction,
            segregationLift,
            co2Reduction
        };
    }, [activeProfile.collectionSpeedGainPct, activeProfile.segregationLiftPct, simControls.aiRouting, simControls.odorScrubber]);

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Trash2 size={24} className="text-amber-600" />
                        Waste Management
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Sensor-driven village waste CPS with closed-loop control, predictive dispatch, and process automation
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">{monitoringStats.online} nodes online</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-100 text-cyan-700">{monitoringStats.edge} edge nodes</span>
                    <span className="px-2 py-1 rounded-full bg-slate-200 text-slate-700">{monitoringStats.delayed} long-range nodes</span>
                </div>
            </div>

            <DemoEncryptionNotice />

            <DashboardCard title="How Village Waste Data Is Collected">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    {WASTE_COLLECTION_METHODS.map((method) => (
                        <div key={method.channel} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                            <p className="text-sm font-semibold text-slate-800">{method.channel}</p>
                            <p className="text-xs text-slate-600 mt-1">Coverage: {method.coverage}</p>
                            <p className="text-xs text-slate-600">Cadence: {method.cadence}</p>
                            <p className="text-xs text-slate-500 mt-1">Owner: {method.owner}</p>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-slate-600 mt-3">
                    Collection and processing are driven by a full sensor mesh: bin nodes, fleet telematics, weighbridge events, and compost/biogas controllers.
                </p>
            </DashboardCard>

            <DashboardCard title="Operations Console">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                    <label className="text-sm text-slate-600 font-medium">
                        Zone Scope
                        <select
                            value={selectedZone}
                            onChange={(event) => setSelectedZone(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                        >
                            {zones.map((zone) => (
                                <option key={zone} value={zone}>{zone}</option>
                            ))}
                        </select>
                    </label>

                    <label className="text-sm text-slate-600 font-medium">
                        Time Window
                        <select
                            value={timeWindow}
                            onChange={(event) => setTimeWindow(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                        >
                            <option value="8h">Last 8h</option>
                            <option value="12h">Last 12h</option>
                            <option value="24h">Last 24h</option>
                        </select>
                    </label>

                    <label className="text-sm text-slate-600 font-medium">
                        Control Profile
                        <select
                            value={controlProfile}
                            onChange={(event) => setControlProfile(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                        >
                            {Object.entries(WASTE_CONTROL_PROFILES).map(([key, profile]) => (
                                <option key={key} value={key}>{profile.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="text-sm text-slate-600 font-medium">
                        Fleet Count: <span className="font-bold text-slate-800">{fleetCount}</span>
                        <input
                            type="range"
                            min="2"
                            max="6"
                            value={fleetCount}
                            onChange={(event) => setFleetCount(Number(event.target.value))}
                            className="mt-2 w-full"
                        />
                    </label>

                    <label className="text-sm text-slate-600 font-medium">
                        Risk Threshold: <span className="font-bold text-slate-800">{riskThreshold}%</span>
                        <input
                            type="range"
                            min="65"
                            max="92"
                            value={riskThreshold}
                            onChange={(event) => setRiskThreshold(Number(event.target.value))}
                            className="mt-2 w-full"
                        />
                    </label>
                </div>
            </DashboardCard>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                <StatCard label="Collected" value={kpis.totalCollectedKg.toFixed(0)} unit="kg" icon={Activity} tone="blue" />
                <StatCard label="Diversion" value={kpis.diversionRate.toFixed(1)} unit="%" icon={Sprout} tone="green" />
                <StatCard label="Overflow Risk Bins" value={kpis.riskyBins} unit="" icon={AlertTriangle} tone="red" />
                <StatCard label="Route Efficiency" value={kpis.routeEfficiency.toFixed(1)} unit="%" icon={MapPinned} tone="cyan" />
                <StatCard label="Compost Potential" value={kpis.compostPotentialKg.toFixed(0)} unit="kg" icon={Wind} tone="amber" />
                <StatCard label="Missed Pickups" value={kpis.missedPickups} unit="" icon={TimerReset} tone="violet" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Bin Fill and Risk Monitor" className="xl:col-span-2">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredBins}>
                                <CartesianGrid {...CPS_GRID_STYLE} vertical={false} />
                                <XAxis dataKey="id" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} />
                                <YAxis tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} width={42} />
                                <Tooltip contentStyle={CPS_TOOLTIP_STYLE} />
                                <Bar dataKey="fillPct" name="Fill %" radius={[6, 6, 0, 0]}>
                                    {filteredBins.map((bin) => {
                                        const risk = calculateOverflowRisk(bin, riskThreshold);
                                        const color = risk >= 85 ? CPS_PALETTE.red : risk >= 70 ? CPS_PALETTE.amber : CPS_PALETTE.emerald;
                                        return <Cell key={bin.id} fill={color} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Waste Composition Intelligence">
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={compositionPie} dataKey="value" nameKey="name" innerRadius={42} outerRadius={80} paddingAngle={2}>
                                    {compositionPie.map((slice) => (
                                        <Cell key={slice.name} fill={slice.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={CPS_TOOLTIP_STYLE} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                        {compositionPie.map((item) => (
                            <div key={item.name} className="flex items-center gap-2 text-slate-600">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span>{item.name}: {item.value}%</span>
                            </div>
                        ))}
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Generation, Collection, and Forecast" className="xl:col-span-2">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendSeries}>
                                <defs>
                                    <linearGradient id="wasteGeneratedFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CPS_PALETTE.amber} stopOpacity={0.35} />
                                        <stop offset="95%" stopColor={CPS_PALETTE.amber} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid {...CPS_GRID_STYLE} vertical={false} />
                                <XAxis dataKey="time" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} />
                                <YAxis tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} width={44} />
                                <Tooltip contentStyle={CPS_TOOLTIP_STYLE} />
                                <Area type="monotone" dataKey="generatedKg" name="Generated (kg)" stroke={CPS_PALETTE.amber} fill="url(#wasteGeneratedFill)" strokeWidth={2} />
                                <Line type="monotone" dataKey="collectedKg" name="Collected (kg)" stroke={CPS_PALETTE.blue} strokeWidth={2.5} dot={false} />
                                <Line type="monotone" dataKey="predictedGeneratedKg" name="Forecast (kg)" stroke={CPS_PALETTE.red} strokeDasharray="6 4" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Collection SLA by Zone">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={WASTE_SLA_BY_ZONE} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid {...CPS_GRID_STYLE} horizontal={false} />
                                <XAxis type="number" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="zone" tick={CPS_AXIS_TICK} tickLine={false} axisLine={false} width={110} />
                                <Tooltip contentStyle={CPS_TOOLTIP_STYLE} />
                                <Bar dataKey="completed" name="Completed" stackId="sla" fill={CPS_PALETTE.emerald} radius={[0, 4, 4, 0]} />
                                <Bar dataKey="late" name="Late" stackId="sla" fill={CPS_PALETTE.amber} />
                                <Bar dataKey="overflow" name="Overflow" stackId="sla" fill={CPS_PALETTE.red} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Sensor Telemetry Register" className="xl:col-span-2">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-200">
                                    <th className="py-2 pr-3 font-semibold">Bin</th>
                                    <th className="py-2 pr-3 font-semibold">Type</th>
                                    <th className="py-2 pr-3 font-semibold">Fill</th>
                                    <th className="py-2 pr-3 font-semibold">Source</th>
                                    <th className="py-2 pr-3 font-semibold">Link Path</th>
                                    <th className="py-2 pr-3 font-semibold">ETA</th>
                                    <th className="py-2 font-semibold">Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBins.map((bin) => {
                                    const risk = calculateOverflowRisk(bin, riskThreshold);
                                    const sourceTone = bin.monitoringMode === 'edge'
                                        ? 'bg-green-100 text-green-700 border-green-200'
                                        : bin.monitoringMode === 'mesh'
                                            ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
                                            : 'bg-violet-100 text-violet-700 border-violet-200';
                                    const riskTone = risk >= 85
                                        ? 'bg-red-100 text-red-700 border-red-200'
                                        : risk >= 70
                                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                                            : 'bg-green-100 text-green-700 border-green-200';

                                    return (
                                        <tr key={bin.id} className="border-b border-slate-100 text-slate-700">
                                            <td className="py-2 pr-3 font-medium">{bin.id} ({bin.zone})</td>
                                            <td className="py-2 pr-3 capitalize">{bin.wasteType}</td>
                                            <td className="py-2 pr-3">{bin.fillPct.toFixed(0)}%</td>
                                            <td className="py-2 pr-3">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${sourceTone}`}>
                                                    {bin.dataSource}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-3">{bin.linkPath}</td>
                                            <td className="py-2 pr-3">{formatEta(estimateOverflowEtaHours(bin))}</td>
                                            <td className="py-2">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${riskTone}`}>
                                                    {risk.toFixed(0)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </DashboardCard>

                <DashboardCard title="Route Optimization Queue">
                    <div className="space-y-3">
                        {priorityStops.length === 0 ? (
                            <p className="text-sm text-slate-500">No stops in current scope.</p>
                        ) : (
                            priorityStops.map((stop) => (
                                <div key={stop.id} className="p-3 rounded-xl border border-slate-200 bg-white/70">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-slate-800">{stop.id} • {stop.zone}</p>
                                        <span className="text-xs font-semibold text-slate-500">ETA {formatEta(stop.overflowEtaHours)}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                                        <span>Risk {stop.risk.toFixed(0)}</span>
                                        <span>Distance {stop.distanceFromHubKm.toFixed(1)} km</span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-500">{stop.dataSource}</p>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-800">
                        Fleet route distance: {kpis.routeDistance.toFixed(1)} km • Efficiency: {kpis.routeEfficiency.toFixed(1)}%
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                        Route order combines distance, overflow risk, and live fleet telemetry congestion factors.
                    </p>
                </DashboardCard>
            </div>

            <DashboardCard title="CPS Closed-Loop Action Ideas">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cpsActionQueue.map((idea) => (
                        <div key={idea.id} className="rounded-xl border border-slate-200 bg-white/70 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-800">{idea.title}</p>
                                <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold border ${idea.active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                    {idea.active ? 'Active' : 'Standby'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-2"><span className="font-semibold text-slate-700">Trigger:</span> {idea.trigger}</p>
                            <p className="text-xs text-slate-600 mt-1"><span className="font-semibold text-slate-700">Actuation:</span> {idea.actuation}</p>
                            <p className="text-xs text-slate-600 mt-1"><span className="font-semibold text-slate-700">Feedback:</span> {idea.feedback}</p>
                        </div>
                    ))}
                </div>
            </DashboardCard>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="CPS Control Simulator" className="xl:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                            onClick={() => setSimControls((prev) => ({ ...prev, compactorBoost: !prev.compactorBoost }))}
                            className={`p-4 rounded-xl border text-left transition-colors ${simControls.compactorBoost ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2 font-semibold text-sm"><Zap size={16} /> Compactor Boost</div>
                            <p className="text-xs mt-2">Increase compaction density to delay overflow and reduce trips.</p>
                        </button>
                        <button
                            onClick={() => setSimControls((prev) => ({ ...prev, odorScrubber: !prev.odorScrubber }))}
                            className={`p-4 rounded-xl border text-left transition-colors ${simControls.odorScrubber ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2 font-semibold text-sm"><Wind size={16} /> Odor Scrubber</div>
                            <p className="text-xs mt-2">Reduce odor index and methane exposure in high-density waste nodes.</p>
                        </button>
                        <button
                            onClick={() => setSimControls((prev) => ({ ...prev, aiRouting: !prev.aiRouting }))}
                            className={`p-4 rounded-xl border text-left transition-colors ${simControls.aiRouting ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2 font-semibold text-sm"><Shield size={16} /> Planner-Assisted Routing</div>
                            <p className="text-xs mt-2">Blend route suggestions with local field staff inputs before dispatch.</p>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                        <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
                            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Overflow Reduction</p>
                            <p className="mt-2 text-2xl font-bold text-slate-800">{impactModel.overflowReduction.toFixed(1)}%</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
                            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Segregation Lift</p>
                            <p className="mt-2 text-2xl font-bold text-slate-800">+{impactModel.segregationLift.toFixed(1)} pts</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
                            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">CO2 Avoided</p>
                            <p className="mt-2 text-2xl font-bold text-slate-800">{impactModel.co2Reduction.toFixed(0)} kg/day</p>
                        </div>
                    </div>
                </DashboardCard>

                <DashboardCard title="Incident Timeline">
                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                        {WASTE_INCIDENT_FEED.map((incident) => (
                            <div key={incident.id} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-xs text-slate-500 font-semibold">{incident.time} • {incident.zone}</p>
                                        <p className="text-sm font-medium text-slate-800 mt-1">{incident.message}</p>
                                    </div>
                                    <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold border ${severityTone[incident.severity] || severityTone.normal}`}>
                                        {incident.severity}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-2">{incident.recommendation}</p>
                                <p className="text-[11px] text-slate-500 mt-1">Source: {incident.source}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                        <TriangleAlert size={14} className="mt-0.5" />
                        Guardrail: escalate if smart-bin methane is above 85 ppm or field teams report overflow ETA below 3h.
                    </div>
                    <div className="mt-2 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-800 flex items-start gap-2">
                        <CheckCircle2 size={14} className="mt-0.5" />
                        Current control profile energy overhead: {kpis.projectedEnergyPenalty.toFixed(1)}%.
                    </div>
                </DashboardCard>
            </div>
        </div>
    );
};