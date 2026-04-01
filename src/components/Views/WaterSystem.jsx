
import React, { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Droplets, AlertCircle, CheckCircle2, Waves, FlaskConical, Thermometer } from 'lucide-react';
import { DashboardCard } from '../Shared/DashboardCard';

const tankData = [
    { name: 'Tank A (Main)', level: 15 },
    { name: 'Tank B (Hostel)', level: 45 },
    { name: 'Tank C (Labs)', level: 92 },
    { name: 'Tank D (Mess)', level: 30 },
    { name: 'Tank E (Admin)', level: 78 },
];

const flowData = [
    { time: '14 Jan 2026 6:00 AM', flow: 120 },
    { time: '14 Jan 2026 9:00 AM', flow: 450 },
    { time: '14 Jan 2026 12:00 PM', flow: 380 },
    { time: '14 Jan 2026 3:00 PM', flow: 200 },
    { time: '14 Jan 2026 6:00 PM', flow: 500 },
    { time: '14 Jan 2026 9:00 PM', flow: 300 },
];

const qualityTrendData = [
    { time: '09:00', ph: 7.1, tds: 230, turbidity: 1.3, dissolvedOxygen: 6.3, temp: 25.4 },
    { time: '09:05', ph: 7.2, tds: 236, turbidity: 1.5, dissolvedOxygen: 6.1, temp: 25.8 },
    { time: '09:10', ph: 7.2, tds: 242, turbidity: 1.4, dissolvedOxygen: 6.0, temp: 26.1 },
    { time: '09:15', ph: 7.3, tds: 248, turbidity: 1.6, dissolvedOxygen: 5.9, temp: 26.3 },
    { time: '09:20', ph: 7.2, tds: 252, turbidity: 1.8, dissolvedOxygen: 5.8, temp: 26.7 },
    { time: '09:25', ph: 7.2, tds: 245, turbidity: 1.7, dissolvedOxygen: 6.0, temp: 26.2 },
    { time: '09:30', ph: 7.1, tds: 238, turbidity: 1.4, dissolvedOxygen: 6.2, temp: 25.9 }
];

const zoneQualityData = [
    { zone: 'River Intake', wqi: 88 },
    { zone: 'Treatment Plant', wqi: 92 },
    { zone: 'Residential', wqi: 81 },
    { zone: 'Campus North', wqi: 76 },
    { zone: 'Campus South', wqi: 84 }
];

const QualityCard = ({ label, value, unit, status }) => (
    <div className="bg-white/60 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 shadow-sm">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${status === 'good' ? 'bg-green-100 text-green-600' :
            status === 'warning' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'
            }`}>
            {status === 'good' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
        </div>
        <span className="text-3xl font-bold text-slate-800">{value}<span className="text-sm text-slate-500 font-medium ml-1">{unit}</span></span>
        <span className="text-slate-500 text-xs font-semibold uppercase">{label}</span>
    </div>
);

export const WaterSystem = () => {
    const latestQuality = qualityTrendData[qualityTrendData.length - 1];

    const qualityStatus = useMemo(() => {
        const phOk = latestQuality.ph >= 6.8 && latestQuality.ph <= 8.2;
        const turbidityOk = latestQuality.turbidity <= 2;
        const doOk = latestQuality.dissolvedOxygen >= 5.5;
        const tdsOk = latestQuality.tds <= 300;
        const score = [phOk, turbidityOk, doOk, tdsOk].filter(Boolean).length;

        if (score >= 4) return { label: 'Safe', color: 'bg-green-100 text-green-700 border-green-200' };
        if (score >= 2) return { label: 'Observe', color: 'bg-amber-100 text-amber-700 border-amber-200' };
        return { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' };
    }, [latestQuality]);

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-cyan-500 text-white rounded-2xl p-6 md:col-span-1 flex flex-col justify-between shadow-lg shadow-cyan-500/20">
                    <Droplets size={32} className="mb-4 opacity-80" />
                    <div>
                        <p className="text-cyan-100 text-sm font-medium">Total Daily Consump.</p>
                        <h3 className="text-3xl font-bold mt-1">45.2 kL</h3>
                    </div>
                </div>
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <QualityCard label="pH Level" value={latestQuality.ph.toFixed(1)} unit="" status="good" />
                    <QualityCard label="Turbidity" value={latestQuality.turbidity.toFixed(1)} unit="NTU" status={latestQuality.turbidity > 2 ? 'warning' : 'good'} />
                    <QualityCard label="Dissolved Oxygen" value={latestQuality.dissolvedOxygen.toFixed(1)} unit="mg/L" status={latestQuality.dissolvedOxygen < 5.5 ? 'warning' : 'good'} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="bg-white/80 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">TDS</p>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{latestQuality.tds}</span>
                        <span className="text-sm text-slate-500">ppm</span>
                    </div>
                </div>
                <div className="bg-white/80 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Conductivity</p>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">1.26</span>
                        <span className="text-sm text-slate-500">mS/cm</span>
                    </div>
                </div>
                <div className="bg-white/80 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Water Temp</p>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{latestQuality.temp.toFixed(1)}</span>
                        <span className="text-sm text-slate-500">deg C</span>
                    </div>
                </div>
                <div className="bg-white/80 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Residual Chlorine</p>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">0.6</span>
                        <span className="text-sm text-slate-500">mg/L</span>
                    </div>
                </div>
                <div className={`rounded-xl p-4 border shadow-sm ${qualityStatus.color}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider">Quality Status</p>
                    <div className="mt-2 flex items-center gap-2">
                        <Waves size={18} />
                        <span className="text-xl font-bold">{qualityStatus.label}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[400px]">
                <DashboardCard title="Tank Levels (%)">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tankData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b' }} />
                            <Bar dataKey="level" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </DashboardCard>

                <DashboardCard title="Flow Rate (L/min)">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={flowData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b' }} />
                            <Line type="monotone" dataKey="flow" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', strokeWidth: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 min-h-[340px]">
                <DashboardCard title="Water Quality Trend" className="xl:col-span-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={qualityTrendData}>
                            <defs>
                                <linearGradient id="phFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} width={44} />
                            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b' }} />
                            <Area type="monotone" dataKey="ph" name="pH" stroke="#06b6d4" strokeWidth={2} fill="url(#phFill)" />
                            <Line type="monotone" dataKey="turbidity" name="Turbidity" stroke="#f59e0b" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="dissolvedOxygen" name="Dissolved Oxygen" stroke="#22c55e" strokeWidth={2} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </DashboardCard>

                <DashboardCard title="Zone Water Quality Index">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={zoneQualityData} layout="vertical" margin={{ left: 22 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} stroke="#64748b" tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="zone" stroke="#64748b" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b' }} />
                            <Bar dataKey="wqi" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </DashboardCard>
            </div>

            <DashboardCard title="Public Water Alerts">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                            <AlertCircle size={16} />
                            Zone Alert
                        </div>
                        <p className="text-sm text-red-700 mt-2">Campus North turbidity crossed 2.0 NTU at 09:20. Flush valve recommended.</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                            <FlaskConical size={16} />
                            Lab Recommendation
                        </div>
                        <p className="text-sm text-amber-700 mt-2">Run quick microbial strip test for River Intake due to temperature rise.</p>
                    </div>
                    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                        <div className="flex items-center gap-2 text-cyan-700 font-semibold text-sm">
                            <Thermometer size={16} />
                            Predictive Note
                        </div>
                        <p className="text-sm text-cyan-700 mt-2">If water temperature stays above 26.5 deg C, increase aeration cycle by 10%.</p>
                    </div>
                </div>
            </DashboardCard>
        </div>
    );
};
