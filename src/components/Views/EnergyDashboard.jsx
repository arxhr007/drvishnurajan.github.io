import React, { useMemo, useState } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sun, Wind, Zap, Activity, Droplets, Cog, Lightbulb } from 'lucide-react';
import { DashboardCard } from '../Shared/DashboardCard';
import { useAssets } from '../../hooks/useAssets';
import { useAuth } from '../../context/AuthContext';

const StatCard = ({ label, value, unit, icon: Icon, tone }) => {
    const tones = {
        amber: 'bg-amber-50 border-amber-100 text-amber-600',
        cyan: 'bg-cyan-50 border-cyan-100 text-cyan-600',
        blue: 'bg-blue-50 border-blue-100 text-blue-600',
        green: 'bg-green-50 border-green-100 text-green-600'
    };

    return (
        <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-800">{value}</span>
                        <span className="text-sm text-slate-500">{unit}</span>
                    </div>
                </div>
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${tones[tone] || tones.blue}`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
};

const ControlToggle = ({ label, asset, icon: Icon, disabled, isBusy, onToggle }) => {
    const isOnline = asset?.status !== 'offline';

    return (
        <div className="p-4 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOnline ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                        <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{label}</p>
                        <p className="text-xs text-slate-500 truncate">
                            {asset ? `${asset.type} • ${isOnline ? 'On' : 'Off'}` : 'No asset found'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => asset && onToggle(asset)}
                    disabled={disabled || !asset || isBusy}
                    className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${isOnline ? 'bg-green-500' : 'bg-slate-300'}
                        ${(disabled || !asset || isBusy) ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    title={disabled ? 'Admin access needed' : 'Toggle power'}
                >
                    <span
                        className={`
                            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200
                            ${isOnline ? 'translate-x-6' : 'translate-x-0'}
                        `}
                    />
                </button>
            </div>
        </div>
    );
};

export const EnergyDashboard = () => {
    const { assets, totalLoadHistory, updateAsset } = useAssets();
    const { user } = useAuth();
    const [busyId, setBusyId] = useState(null);

    const demoTrendData = useMemo(() => ([
        { time: '09:00', load: 26.4, generation: 31.2 },
        { time: '09:05', load: 27.1, generation: 33.8 },
        { time: '09:10', load: 28.5, generation: 35.4 },
        { time: '09:15', load: 29.3, generation: 36.1 },
        { time: '09:20', load: 30.2, generation: 38.6 },
        { time: '09:25', load: 31.0, generation: 39.4 },
        { time: '09:30', load: 31.8, generation: 40.8 },
        { time: '09:35', load: 32.4, generation: 41.7 }
    ]), []);

    const energyAssets = useMemo(
        () => assets.filter((asset) => asset.category?.toLowerCase() === 'energy'),
        [assets]
    );

    const windAssets = useMemo(
        () => energyAssets.filter((asset) => /wind|turbine/i.test(`${asset.type} ${asset.details || ''}`)),
        [energyAssets]
    );

    const solarAssets = useMemo(
        () => energyAssets.filter((asset) => /solar/i.test(`${asset.type} ${asset.details || ''}`)),
        [energyAssets]
    );

    const windOutput = windAssets.reduce(
        (sum, asset) => sum + (asset.status !== 'offline' ? Math.abs(Number(asset.val) || 0) : 0),
        0
    );

    const solarOutput = solarAssets.reduce(
        (sum, asset) => sum + (asset.status !== 'offline' ? Math.abs(Number(asset.val) || 0) : 0),
        0
    );

    const hasLiveTrend = totalLoadHistory.some((point) => (Number(point.load) || 0) > 0 || (Number(point.generation) || 0) > 0);
    const chartTrendData = hasLiveTrend ? totalLoadHistory : demoTrendData;

    const hasLiveRenewables = windOutput > 0 || solarOutput > 0;
    const renewableSnapshotData = hasLiveRenewables
        ? [
            { source: 'Wind', output: Number(windOutput.toFixed(2)) },
            { source: 'Solar', output: Number(solarOutput.toFixed(2)) }
        ]
        : [
            { source: 'Wind', output: 24.6 },
            { source: 'Solar', output: 17.9 }
        ];

    const windForDisplay = hasLiveRenewables ? windOutput : renewableSnapshotData[0].output;
    const solarForDisplay = hasLiveRenewables ? solarOutput : renewableSnapshotData[1].output;

    const latestTotals = totalLoadHistory[totalLoadHistory.length - 1] || { load: 0, generation: 0 };
    const demoLatest = demoTrendData[demoTrendData.length - 1];
    const hasLiveGeneration = (latestTotals.generation || 0) > 0;
    const generationForDisplay = hasLiveGeneration ? (latestTotals.generation || 0) : demoLatest.generation;
    const loadForDisplay = hasLiveGeneration ? (latestTotals.load || 0) : demoLatest.load;
    const netPower = generationForDisplay - loadForDisplay;

    const controls = {
        pump: assets.find((asset) => /pump/i.test(`${asset.type} ${asset.id} ${asset.details || ''}`)),
        motor: assets.find((asset) => /motor/i.test(`${asset.type} ${asset.id} ${asset.details || ''}`)),
        streetLight: assets.find((asset) => /street\s*lights?|streetlights?/i.test(`${asset.type} ${asset.id} ${asset.details || ''}`))
    };

    const toggleDevice = async (asset) => {
        if (!asset) return;

        const nextStatus = asset.status === 'offline' ? 'normal' : 'offline';
        const assetId = asset.firebaseId || asset.id;

        setBusyId(assetId);
        try {
            await updateAsset(assetId, { status: nextStatus }, user);
        } catch (error) {
            console.error('Failed to toggle device state:', error);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Zap size={24} className="text-amber-500" />
                        Energy Dashboard
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Live monitoring for windmill and solar generation with field device controls
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Wind Output" value={windForDisplay.toFixed(1)} unit="kW" icon={Wind} tone="cyan" />
                <StatCard label="Solar Output" value={solarForDisplay.toFixed(1)} unit="kW" icon={Sun} tone="amber" />
                <StatCard label="Load" value={loadForDisplay.toFixed(1)} unit="kW" icon={Activity} tone="blue" />
                <StatCard label="Total Generation" value={generationForDisplay.toFixed(1)} unit="kW" icon={Activity} tone="green" />
                <StatCard label="Net Power" value={netPower.toFixed(1)} unit="kW" icon={Zap} tone="blue" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Load vs Generation Trend" className="xl:col-span-2">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartTrendData}>
                                <defs>
                                    <linearGradient id="energyLoad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="energyGen" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} width={44} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                                <Area type="monotone" dataKey="load" name="Load" stroke="#f59e0b" strokeWidth={2} fill="url(#energyLoad)" isAnimationActive={false} />
                                <Area type="monotone" dataKey="generation" name="Generation" stroke="#22c55e" strokeWidth={2} fill="url(#energyGen)" isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Renewable Snapshot">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={renewableSnapshotData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="source" tick={{ fontSize: 12 }} stroke="#64748b" />
                                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" width={44} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                                <Line type="monotone" dataKey="output" name="Output (kW)" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>
            </div>

            <DashboardCard title="Field Device Controls">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ControlToggle
                        label="Pump"
                        asset={controls.pump}
                        icon={Droplets}
                        disabled={false}
                        isBusy={busyId === (controls.pump?.firebaseId || controls.pump?.id)}
                        onToggle={toggleDevice}
                    />
                    <ControlToggle
                        label="Motor"
                        asset={controls.motor}
                        icon={Cog}
                        disabled={false}
                        isBusy={busyId === (controls.motor?.firebaseId || controls.motor?.id)}
                        onToggle={toggleDevice}
                    />
                    <ControlToggle
                        label="Street Light"
                        asset={controls.streetLight}
                        icon={Lightbulb}
                        disabled={false}
                        isBusy={busyId === (controls.streetLight?.firebaseId || controls.streetLight?.id)}
                        onToggle={toggleDevice}
                    />
                </div>
            </DashboardCard>
        </div>
    );
};
