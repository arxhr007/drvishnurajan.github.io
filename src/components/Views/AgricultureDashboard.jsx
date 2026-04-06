import React, { useMemo, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Droplets, Eye, Flame, ImagePlus, MapPinned, Mic, Shield, Sprout, TimerReset, TriangleAlert, Wind, Wifi, Zap } from 'lucide-react';
import { DashboardCard } from '../Shared/DashboardCard';
import { DemoEncryptionNotice } from '../Shared/DemoEncryptionNotice';

const PREDICTION_API_BASE = 'https://aaronthomas123-ice.hf.space';

const dashboardTrend = [
    { time: '06:00', health: 76, risk: 34, confidence: 81, alerts: 1 },
    { time: '09:00', health: 78, risk: 38, confidence: 84, alerts: 1 },
    { time: '12:00', health: 74, risk: 52, confidence: 87, alerts: 2 },
    { time: '15:00', health: 71, risk: 61, confidence: 89, alerts: 2 },
    { time: '18:00', health: 73, risk: 58, confidence: 91, alerts: 1 },
    { time: '21:00', health: 75, risk: 49, confidence: 92, alerts: 1 }
];

const vasaHeatmap = [
    { node: 'NW', intensity: 18 },
    { node: 'N', intensity: 41 },
    { node: 'NE', intensity: 22 },
    { node: 'W', intensity: 57 },
    { node: 'Center', intensity: 86 },
    { node: 'E', intensity: 49 },
    { node: 'SW', intensity: 24 },
    { node: 'S', intensity: 35 },
    { node: 'SE', intensity: 19 }
];

const fusionConfidence = [
    { name: 'Vision', value: 0.78, fill: '#2563eb' },
    { name: 'Environment', value: 0.82, fill: '#16a34a' },
    { name: 'Plant Response', value: 0.88, fill: '#f59e0b' },
    { name: 'Fusion', value: 0.96, fill: '#7c3aed' }
];

const triModalEngine = [
    {
        title: 'Environment',
        icon: Wind,
        score: '82%',
        tone: 'green',
        note: 'Humidity, leaf wetness, and temperature are in risk range.'
    },
    {
        title: 'Plant Response',
        icon: Activity,
        score: '88%',
        tone: 'amber',
        note: 'VOC and bio-response signals are increasing.'
    },
    {
        title: 'Fusion Decision',
        icon: Zap,
        score: '96%',
        tone: 'violet',
        note: 'Signals align, so the dashboard shows a strong alert.'
    }
];

const fieldNodes = [
    { label: 'ESP32 Node', value: 'Online', tone: 'green' },
    { label: 'MQTT Link', value: 'Stable', tone: 'blue' },
    { label: 'VASA Array', value: 'Active', tone: 'violet' },
    { label: 'Database Sync', value: 'Healthy', tone: 'cyan' }
];

const sensorStatus = [
    { label: 'Temperature & Humidity', value: 'Stable', detail: 'Fungal window monitored', icon: Wind },
    { label: 'Soil Moisture', value: 'Moderate', detail: 'No water stress spike', icon: Droplets },
    { label: 'Leaf Wetness', value: 'Rising', detail: 'Early morning moisture detected', icon: Activity },
    { label: 'VOC + Bio Response', value: 'Alerting', detail: 'Plant response increasing', icon: Eye }
];

const activeAlerts = [
    {
        title: 'High disease risk in central plots',
        time: '10 min ago',
        severity: 'Critical',
        note: 'Humidity and leaf wetness suggest a 72-hour outbreak window.'
    },
    {
        title: 'VASA acoustic cluster detected',
        time: '18 min ago',
        severity: 'Warning',
        note: 'Source localized near Center node with strong AE intensity.'
    },
    {
        title: 'Preventive action recommended',
        time: '32 min ago',
        severity: 'Advisory',
        note: 'Reduce irrigation tonight and inspect affected zones tomorrow morning.'
    }
];

const recommendedActions = [
    'Reduce irrigation for the next night cycle.',
    'Inspect the central field block for early visual lesions.',
    'Check leaf underside for wetness and discolouration.',
    'Watch the VASA center heat zone for new acoustic spikes.'
];

const quickFacts = [
    { label: 'Forecast Window', value: '72 hrs' },
    { label: 'VASA Coverage', value: 'Village wide' },
    { label: 'Update Cycle', value: '15 min' },
    { label: 'Fusion Confidence', value: '96%' }
];

const StatCard = ({ label, value, unit, icon: Icon, tone = 'blue', subtext }) => {
    const tones = {
        blue: 'bg-blue-50 border-blue-100 text-blue-600',
        green: 'bg-green-50 border-green-100 text-green-600',
        amber: 'bg-amber-50 border-amber-100 text-amber-600',
        violet: 'bg-violet-50 border-violet-100 text-violet-600',
        cyan: 'bg-cyan-50 border-cyan-100 text-cyan-600',
        rose: 'bg-rose-50 border-rose-100 text-rose-600'
    };

    return (
        <div className="bg-white/85 backdrop-blur-md border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                    <div className="mt-1 flex items-baseline gap-1 flex-wrap">
                        <span className="text-2xl font-bold text-slate-800">{value}</span>
                        {unit ? <span className="text-sm text-slate-500">{unit}</span> : null}
                    </div>
                    {subtext ? <p className="mt-1 text-xs text-slate-500">{subtext}</p> : null}
                </div>
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${tones[tone] || tones.blue}`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
};

const badgeStyles = {
    Critical: 'bg-red-100 text-red-700 border-red-200',
    Warning: 'bg-amber-100 text-amber-700 border-amber-200',
    Advisory: 'bg-blue-100 text-blue-700 border-blue-200'
};

const toneStyles = {
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    green: 'bg-green-50 border-green-100 text-green-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    violet: 'bg-violet-50 border-violet-100 text-violet-600'
};

export const AgricultureDashboard = () => {
    const [uploadedLeafFile, setUploadedLeafFile] = useState(null);
    const [uploadedLeafName, setUploadedLeafName] = useState('No leaf image uploaded yet');
    const [isPredictingLeaf, setIsPredictingLeaf] = useState(false);
    const [predictionError, setPredictionError] = useState('');
    const [predictionResult, setPredictionResult] = useState(null);

    const latest = dashboardTrend[dashboardTrend.length - 1];
    const avgRisk = useMemo(() => dashboardTrend.reduce((sum, point) => sum + point.risk, 0) / dashboardTrend.length, []);
    const peakNode = useMemo(() => vasaHeatmap.reduce((max, item) => (item.intensity > max.intensity ? item : max), vasaHeatmap[0]), []);

    const handleLeafUpload = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadedLeafFile(file);
            setUploadedLeafName(file.name);
            setPredictionError('');
            setPredictionResult(null);
        }
    };

    const runLeafPrediction = async () => {
        if (!uploadedLeafFile) {
            setPredictionError('Please upload a leaf image first.');
            return;
        }

        if (!uploadedLeafFile.type?.startsWith('image/')) {
            setPredictionError('Please upload a valid image file.');
            return;
        }

        setIsPredictingLeaf(true);
        setPredictionError('');
        setPredictionResult(null);

        try {
            const formData = new FormData();
            formData.append('file', uploadedLeafFile);

            const response = await fetch(`${PREDICTION_API_BASE}/predict`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.detail || 'Prediction failed');
            }

            setPredictionResult(data);
        } catch (error) {
            setPredictionError(error?.message || 'Prediction request failed');
        } finally {
            setIsPredictingLeaf(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Sprout size={24} className="text-green-600" />
                        GRAM-DRISHTI Monitoring Dashboard
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 max-w-4xl">
                        This page shows what the user actually sees while using the system: live risk, VASA localization, crop alert status, sensor state, and recommended actions.
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-700 text-xs font-semibold">
                    <Shield size={14} />
                    Field monitoring view
                </div>
            </div>

            <DemoEncryptionNotice />

            <DashboardCard title="Tri-Modal Decision Engine">
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 md:p-5 mb-4">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="max-w-3xl">
                            <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm uppercase tracking-wider">
                                <Eye size={16} />
                                Vision Leaf Checker
                            </div>
                            <p className="mt-2 text-sm text-slate-700">
                                Upload a leaf picture here. The AI/ML checker analyzes the image and returns a disease prediction before the other tri-modal signals are combined.
                            </p>
                        </div>
                        <div className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-sm font-bold text-blue-700">
                            Vision is the first input
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 rounded-xl border border-dashed border-blue-200 bg-white/90 p-4">
                            <label className="flex flex-col items-center justify-center gap-3 cursor-pointer text-center min-h-[11rem]">
                                <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                    <ImagePlus size={22} />
                                </div>
                                <div>
                                    <p className="text-base font-semibold text-slate-800">Upload a leaf picture</p>
                                    <p className="text-sm text-slate-500 mt-1">The AI/ML checker will analyze the leaf image and predict disease status.</p>
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleLeafUpload} />
                            </label>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Selected file</p>
                                <p className="mt-2 text-sm font-bold text-slate-800 break-words">{uploadedLeafName}</p>
                            </div>

                            <div className="mt-4 space-y-3">
                                <button
                                    type="button"
                                    onClick={runLeafPrediction}
                                    disabled={isPredictingLeaf || !uploadedLeafFile}
                                    className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                                        isPredictingLeaf || !uploadedLeafFile
                                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                >
                                    {isPredictingLeaf ? 'Analyzing leaf...' : 'Analyze Leaf'}
                                </button>

                                {predictionError ? (
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                        {predictionError}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {predictionResult?.prediction ? (
                        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="rounded-xl border border-green-200 bg-green-50 p-4 lg:col-span-1">
                                <p className="text-xs uppercase tracking-wider text-green-700 font-semibold">Top prediction</p>
                                <p className="mt-2 text-lg font-bold text-green-900">{predictionResult.prediction.class_name}</p>
                                <p className="mt-1 text-sm text-green-800">
                                    Confidence: {(Number(predictionResult.prediction.confidence || 0) * 100).toFixed(2)}%
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Top 3 predictions</p>
                                <div className="mt-3 space-y-2">
                                    {predictionResult.top3.map((entry, idx) => (
                                        <div key={`${entry.class_index}-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                            <span className="text-sm font-medium text-slate-800">{entry.class_name}</span>
                                            <span className="text-sm font-bold text-slate-700">{(Number(entry.confidence || 0) * 100).toFixed(2)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {triModalEngine.map((item) => (
                        <div key={item.title} className={`rounded-xl border p-4 ${toneStyles[item.tone] || toneStyles.blue}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-semibold">{item.title}</p>
                                    <p className="mt-1 text-2xl font-bold text-slate-800">{item.score}</p>
                                </div>
                                <div className="w-11 h-11 rounded-xl border border-white/60 bg-white/70 flex items-center justify-center shrink-0 text-slate-700">
                                    <item.icon size={20} />
                                </div>
                            </div>
                            <p className="mt-3 text-sm text-slate-600">{item.note}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">How the user interprets it</p>
                                <p className="mt-1 text-lg font-bold text-slate-800">Signals agree, so the system raises the risk level.</p>
                            </div>
                            <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-700">
                                96% confidence
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-lg bg-white border border-slate-200 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Agreement</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">Vision + Environment + Plant Response</p>
                            </div>
                            <div className="rounded-lg bg-white border border-slate-200 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Meaning</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">The alert is supported by all three inputs.</p>
                            </div>
                            <div className="rounded-lg bg-white border border-slate-200 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Action</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">Inspect central plots and reduce irrigation.</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Current fused result</p>
                        <div className="mt-2 flex items-center gap-2 text-slate-800 font-bold text-lg">
                            <TriangleAlert size={18} className="text-rose-500" />
                            High disease risk
                        </div>
                        <p className="mt-2 text-sm text-slate-600">The combined tri-modal score is elevated and the dashboard shows a visible alert state.</p>
                        <div className="mt-4 h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full w-[96%] rounded-full bg-violet-500" />
                        </div>
                    </div>
                </div>
            </DashboardCard>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Village Health Score" value={latest.health} unit="/100" icon={CheckCircle2} tone="green" subtext="Composite field state" />
                <StatCard label="Disease Risk" value={latest.risk} unit="/100" icon={TriangleAlert} tone="rose" subtext="72-hour risk forecast" />
                <StatCard label="Fusion Confidence" value={latest.confidence} unit="%" icon={Zap} tone="violet" subtext="Vision + environment + plant response" />
                <StatCard label="Alerts Active" value={latest.alerts} unit="now" icon={AlertTriangle} tone="amber" subtext="Current visible alerts" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Live Trend and Risk">
                    <div className="h-72 min-h-[18rem]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dashboardTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} width={40} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                                <Line type="monotone" dataKey="health" name="Health Score" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="risk" name="Risk" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="confidence" name="Confidence" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Tri-Modal Confidence">
                    <div className="h-72 min-h-[18rem]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={fusionConfidence} dataKey="value" nameKey="name" innerRadius={45} outerRadius={82} paddingAngle={2}>
                                    {fusionConfidence.map((entry) => (
                                        <Cell key={entry.name} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Quick Facts">
                    <div className="grid grid-cols-2 gap-3">
                        {quickFacts.map((item) => (
                            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{item.label}</p>
                                <p className="mt-1 text-lg font-bold text-slate-800">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="VASA Heatmap and Acoustic Alerts" className="xl:col-span-2">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 h-72 min-h-[18rem]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vasaHeatmap}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="node" tick={{ fontSize: 11 }} stroke="#64748b" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" width={40} />
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                                    <Bar dataKey="intensity" name="AE Intensity" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Peak node</p>
                            <div className="mt-2 flex items-center gap-2 text-slate-800 font-bold text-lg">
                                <MapPinned size={18} className="text-cyan-600" />
                                {peakNode.node}
                            </div>
                            <p className="mt-2 text-sm text-slate-600">Highest localized acoustic intensity: {peakNode.intensity}%</p>
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold">Farmers see</p>
                                <p className="mt-1 text-sm text-amber-800">A centered risk zone with active VASA localization and field-wide alerting.</p>
                            </div>
                        </div>
                    </div>
                </DashboardCard>

                <DashboardCard title="Sensor State">
                    <div className="space-y-3">
                        {sensorStatus.map((item) => (
                            <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                        <item.icon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                                        <p className="text-xs text-slate-500">{item.detail}</p>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                    <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</span>
                                    <span className="text-sm font-bold text-slate-800">{item.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Active Alerts" className="xl:col-span-2">
                    <div className="space-y-3">
                        {activeAlerts.map((alert) => (
                            <div key={alert.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-800">{alert.title}</p>
                                    <p className="mt-1 text-sm text-slate-600">{alert.note}</p>
                                    <p className="mt-1 text-xs text-slate-500">{alert.time}</p>
                                </div>
                                <span className={`inline-flex shrink-0 items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${badgeStyles[alert.severity]}`}>
                                    {alert.severity}
                                </span>
                            </div>
                        ))}
                    </div>
                </DashboardCard>

                <DashboardCard title="Recommended Actions">
                    <div className="space-y-3">
                        {recommendedActions.map((item) => (
                            <div key={item} className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-start gap-2 text-green-800">
                                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                <p className="text-sm">{item}</p>
                            </div>
                        ))}
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Field Node Status">
                    <div className="grid grid-cols-2 gap-3">
                        {fieldNodes.map((node) => (
                            <div key={node.label} className="rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{node.label}</p>
                                <p className="mt-1 text-lg font-bold text-slate-800">{node.value}</p>
                            </div>
                        ))}
                    </div>
                </DashboardCard>

                <DashboardCard title="System Flow Seen by User" className="xl:col-span-2">
                    <div className="space-y-3 text-sm text-slate-700">
                        <p>1. The field node collects sensor readings and sends them through MQTT every 15 minutes.</p>
                        <p>2. The backend validates the reading, updates the database, and runs the model pipeline.</p>
                        <p>3. The dashboard shows crop risk, VASA acoustic localization, and sensor confidence.</p>
                        <p>4. The user receives clear alert cards and practical recommendations for action.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Current average risk</p>
                                <p className="mt-1 text-xl font-bold text-slate-800">{avgRisk.toFixed(0)}/100</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Latest confidence</p>
                                <p className="mt-1 text-xl font-bold text-slate-800">{latest.confidence}%</p>
                            </div>
                        </div>
                    </div>
                </DashboardCard>
            </div>
        </div>
    );
};
