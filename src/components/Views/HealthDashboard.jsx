import React, { useMemo, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { HeartPulse, Thermometer, Activity, Users, AlertTriangle, Eye, Cpu, Languages, ShieldCheck, Clock3 } from 'lucide-react';
import { DashboardCard } from '../Shared/DashboardCard';
import { DemoEncryptionNotice } from '../Shared/DemoEncryptionNotice';

const StatCard = ({ label, value, unit, icon: Icon, tone = 'red' }) => {
    const tones = {
        red: 'bg-red-50 border-red-100 text-red-600',
        blue: 'bg-blue-50 border-blue-100 text-blue-600',
        green: 'bg-green-50 border-green-100 text-green-600',
        amber: 'bg-amber-50 border-amber-100 text-amber-600'
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
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${tones[tone] || tones.red}`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
};

const HEALTH_ROWS = [
    { id: 'P-001', name: 'Vishal A', age: 34, temperature: 98.4, spo2: 99, heartRate: 76, bp: '118/78', symptom: 'None', zone: 'North' },
    { id: 'P-002', name: 'Manoj R.', age: 57, temperature: 99.1, spo2: 96, heartRate: 88, bp: '130/84', symptom: 'Mild cough', zone: 'East' },
    { id: 'P-003', name: 'Lakshmi P.', age: 41, temperature: 100.2, spo2: 94, heartRate: 98, bp: '136/88', symptom: 'Fever', zone: 'South' },
    { id: 'P-004', name: 'Rahul V.', age: 23, temperature: 98.1, spo2: 99, heartRate: 71, bp: '112/74', symptom: 'None', zone: 'West' },
    { id: 'P-005', name: 'Devika S.', age: 66, temperature: 99.8, spo2: 93, heartRate: 102, bp: '142/90', symptom: 'Breathlessness', zone: 'North' },
    { id: 'P-006', name: 'Nirmal T.', age: 49, temperature: 98.9, spo2: 97, heartRate: 82, bp: '124/80', symptom: 'Headache', zone: 'Central' }
];

const TEMP_SERIES = [
    { time: '09:00', avgTemp: 98.7, elevatedCount: 1 },
    { time: '09:15', avgTemp: 98.9, elevatedCount: 1 },
    { time: '09:30', avgTemp: 99.1, elevatedCount: 2 },
    { time: '09:45', avgTemp: 99.0, elevatedCount: 2 },
    { time: '10:00', avgTemp: 99.2, elevatedCount: 2 },
    { time: '10:15', avgTemp: 99.0, elevatedCount: 1 },
    { time: '10:30', avgTemp: 98.8, elevatedCount: 1 }
];

const ZONE_RISK = [
    { zone: 'North', risk: 68 },
    { zone: 'East', risk: 45 },
    { zone: 'South', risk: 73 },
    { zone: 'West', risk: 33 },
    { zone: 'Central', risk: 52 }
];

const DRISHTI_CORE_METRICS = [
    { label: 'Global Diabetics', value: '463M', icon: Users, tone: 'blue', detail: 'WHO-scale burden addressed' },
    { label: 'India Diabetics', value: '77M', icon: Activity, tone: 'amber', detail: 'High-need screening population' },
    { label: 'Preventable Blindness', value: '80%', icon: Eye, tone: 'green', detail: 'With timely detection and care' },
    { label: 'Per Screen Cost', value: 'Rs 81', icon: ShieldCheck, tone: 'red', detail: 'Village-level operational cost' }
];

const DRISHTI_WORKFLOW = [
    { step: '1. Intake', seconds: 45, action: 'ABHA-linked registration and risk profile pull' },
    { step: '2. Capture', seconds: 90, action: 'IMU-guided fundus capture with stability lock' },
    { step: '3. QC Check', seconds: 5, action: 'MobileNetV3 image quality accept/reject' },
    { step: '4. AI Grading', seconds: 3, action: 'DR + glaucoma + AMD + retinal age inference' },
    { step: '5. Counselling', seconds: 8, action: 'On-device vernacular LLM counselling + TTS' },
    { step: '6. Referral', seconds: 30, action: 'Referral packet and follow-up scheduling' }
];

const DRISHTI_MODEL_OPTIONS = [
    { model: 'EyePACS / KMesa', sensitivity: 87, auc: 0.9, offline: 'No', indiaData: 'Partial' },
    { model: 'Google Health AI', sensitivity: 90, auc: 0.91, offline: 'Partnership', indiaData: 'Pilot' },
    { model: 'Aravind / LVPEI', sensitivity: 89, auc: 0.92, offline: 'Yes', indiaData: 'Primary' }
];

const DRISHTI_ROLLOUT = [
    { phase: 'Phase 1', timeline: 'Months 1-6', scope: '2 CHCs, 2 units', goal: 'Parallel validation with ophthalmologists' },
    { phase: 'Phase 2', timeline: 'Months 7-18', scope: '20 PHCs district-wide', goal: 'Referral corridor and federated learning' },
    { phase: 'Phase 3', timeline: 'State Integration', scope: 'NHM + NPCDCS', goal: 'ABHA sync and statewide procurement' }
];

const symptomsBreakup = (rows) => {
    const symptomCounts = rows.reduce((acc, row) => {
        const key = row.symptom === 'None' ? 'No Symptoms' : row.symptom;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(symptomCounts).map(([name, value]) => ({ name, value }));
};

const getRiskLabel = (person) => {
    const fever = person.temperature >= 100.0;
    const lowSpo2 = person.spo2 <= 94;
    const highPulse = person.heartRate >= 100;

    if ((fever && lowSpo2) || (lowSpo2 && highPulse)) return 'High';
    if (fever || lowSpo2 || highPulse) return 'Medium';
    return 'Low';
};

export const HealthDashboard = () => {
    const [rows] = useState(HEALTH_ROWS);

    const computed = useMemo(() => {
        const alerts = rows.filter((p) => getRiskLabel(p) === 'High').length;
        const avgTemp = rows.reduce((sum, p) => sum + p.temperature, 0) / rows.length;
        const avgSpo2 = rows.reduce((sum, p) => sum + p.spo2, 0) / rows.length;
        const monitored = rows.length;

        const triage = rows.map((p) => ({ ...p, risk: getRiskLabel(p) }));

        return {
            alerts,
            avgTemp,
            avgSpo2,
            monitored,
            triage
        };
    }, [rows]);

    const pieData = useMemo(() => symptomsBreakup(rows), [rows]);
    const colors = ['#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#6366f1'];

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <HeartPulse size={24} className="text-red-500" />
                        Health Dashboard
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Public health monitoring with vitals analytics, symptom clustering, and early warning signals
                    </p>
                </div>
            </div>

            <DemoEncryptionNotice />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="People Monitored" value={computed.monitored} unit="" icon={Users} tone="blue" />
                <StatCard label="Avg Body Temp" value={computed.avgTemp.toFixed(1)} unit="deg F" icon={Thermometer} tone="amber" />
                <StatCard label="Avg SpO2" value={computed.avgSpo2.toFixed(0)} unit="%" icon={Activity} tone="green" />
                <StatCard label="High Risk Alerts" value={computed.alerts} unit="" icon={AlertTriangle} tone="red" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Temperature Trend and Elevated Cases" className="xl:col-span-2">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={TEMP_SERIES}>
                                <defs>
                                    <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} />
                                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} width={42} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} width={32} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                                <Area yAxisId="left" type="monotone" dataKey="avgTemp" name="Avg Temp" stroke="#ef4444" strokeWidth={2} fill="url(#tempFill)" />
                                <Bar yAxisId="right" dataKey="elevatedCount" name="Elevated Cases" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={20} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Symptom Distribution">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                                    {pieData.map((entry, idx) => (
                                        <Cell key={entry.name} fill={colors[idx % colors.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Zone Outbreak Radar" className="xl:col-span-1">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ZONE_RISK} layout="vertical" margin={{ top: 6, right: 8, left: 6, bottom: 6 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#64748b" />
                                <YAxis type="category" dataKey="zone" tick={{ fontSize: 11 }} stroke="#64748b" width={62} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                                <Bar dataKey="risk" fill="#6366f1" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="People Health Data" className="xl:col-span-2">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-200">
                                    <th className="py-2 pr-3 font-semibold">Name</th>
                                    <th className="py-2 pr-3 font-semibold">Temp (F)</th>
                                    <th className="py-2 pr-3 font-semibold">SpO2</th>
                                    <th className="py-2 pr-3 font-semibold">Heart Rate</th>
                                    <th className="py-2 pr-3 font-semibold">BP</th>
                                    <th className="py-2 pr-3 font-semibold">Symptom</th>
                                    <th className="py-2 font-semibold">Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {computed.triage.map((p) => {
                                    const badgeColor = p.risk === 'High'
                                        ? 'bg-red-100 text-red-700 border-red-200'
                                        : p.risk === 'Medium'
                                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                                            : 'bg-green-100 text-green-700 border-green-200';

                                    return (
                                        <tr key={p.id} className="border-b border-slate-100 text-slate-700">
                                            <td className="py-2 pr-3 font-medium">{p.name}</td>
                                            <td className="py-2 pr-3">{p.temperature.toFixed(1)}</td>
                                            <td className="py-2 pr-3">{p.spo2}%</td>
                                            <td className="py-2 pr-3">{p.heartRate} bpm</td>
                                            <td className="py-2 pr-3">{p.bp}</td>
                                            <td className="py-2 pr-3">{p.symptom}</td>
                                            <td className="py-2">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}>
                                                    {p.risk}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </DashboardCard>
            </div>

            {/* DRISHTI Blueprint Section (merged below existing health dashboard) */}
            <div className="pt-2 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-50 via-cyan-50 to-emerald-50 p-5">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Eye size={20} className="text-blue-600" />
                        DRISHTI Blueprint Dashboard
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {DRISHTI_CORE_METRICS.map((metric) => (
                        <div key={metric.label} className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{metric.label}</p>
                                    <p className="mt-1 text-2xl font-bold text-slate-800">{metric.value}</p>
                                    <p className="text-xs text-slate-500 mt-1">{metric.detail}</p>
                                </div>
                                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${metric.tone === 'blue'
                                    ? 'bg-blue-50 border-blue-100 text-blue-600'
                                    : metric.tone === 'green'
                                        ? 'bg-green-50 border-green-100 text-green-600'
                                        : metric.tone === 'amber'
                                            ? 'bg-amber-50 border-amber-100 text-amber-600'
                                            : 'bg-red-50 border-red-100 text-red-600'}`}>
                                    <metric.icon size={18} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <DashboardCard title="4-Minute Screening Workflow" className="xl:col-span-2">
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={DRISHTI_WORKFLOW} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="step" tick={{ fontSize: 10 }} stroke="#64748b" interval={0} angle={-20} textAnchor="end" height={52} />
                                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" width={36} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }}
                                        formatter={(value) => [`${value}s`, 'Time']}
                                        labelFormatter={(label, payload) => {
                                            const item = payload?.[0]?.payload;
                                            return `${label} - ${item?.action || ''}`;
                                        }}
                                    />
                                    <Bar dataKey="seconds" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </DashboardCard>

                    <DashboardCard title="Technology Stack Signals">
                        <div className="space-y-3 text-sm">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="font-semibold text-slate-700 flex items-center gap-2"><Cpu size={14} /> On-device AI</p>
                                <p className="text-slate-600 mt-1">EfficientNet-B3 multi-task inference in ~2.6s with offline execution.</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="font-semibold text-slate-700 flex items-center gap-2"><Languages size={14} /> Vernacular Counselling</p>
                                <p className="text-slate-600 mt-1">Gemma-2 2B INT4 messaging for local-language patient guidance.</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="font-semibold text-slate-700 flex items-center gap-2"><Clock3 size={14} /> Camp Throughput</p>
                                <p className="text-slate-600 mt-1">Designed for 30+ patients per camp day without cloud dependency.</p>
                            </div>
                        </div>
                    </DashboardCard>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <DashboardCard title="AI Model Options" className="xl:col-span-2">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-500 border-b border-slate-200">
                                        <th className="py-2 pr-3 font-semibold">Model</th>
                                        <th className="py-2 pr-3 font-semibold">Sensitivity</th>
                                        <th className="py-2 pr-3 font-semibold">AUC</th>
                                        <th className="py-2 pr-3 font-semibold">Offline</th>
                                        <th className="py-2 font-semibold">India Data Fit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {DRISHTI_MODEL_OPTIONS.map((m) => (
                                        <tr key={m.model} className="border-b border-slate-100 text-slate-700">
                                            <td className="py-2 pr-3 font-medium">{m.model}</td>
                                            <td className="py-2 pr-3">{m.sensitivity}%</td>
                                            <td className="py-2 pr-3">{m.auc.toFixed(2)}</td>
                                            <td className="py-2 pr-3">{m.offline}</td>
                                            <td className="py-2">{m.indiaData}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </DashboardCard>

                    <DashboardCard title="Rollout Roadmap">
                        <div className="space-y-2">
                            {DRISHTI_ROLLOUT.map((phase) => (
                                <div key={phase.phase} className="rounded-xl border border-slate-200 p-3 bg-white">
                                    <p className="text-sm font-semibold text-slate-700">{phase.phase} <span className="text-slate-500 font-normal">({phase.timeline})</span></p>
                                    <p className="text-xs text-slate-500 mt-1">{phase.scope}</p>
                                    <p className="text-xs text-slate-600 mt-1">{phase.goal}</p>
                                </div>
                            ))}
                        </div>
                    </DashboardCard>
                </div>
            </div>
        </div>
    );
};
