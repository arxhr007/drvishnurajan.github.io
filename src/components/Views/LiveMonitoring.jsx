import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Activity, Wifi, Battery, Server, ArrowLeft, Clock, MapPin, User, Landmark, Gauge, Database, Radio, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useAssets } from '../../hooks/useAssets';
import { useVillageSensors } from '../../hooks/useVillageSensors';
import { useAuth } from '../../context/AuthContext';
import { formatTimeIST } from '../../utils/timeUtils';
import { DemoEncryptionNotice } from '../Shared/DemoEncryptionNotice';
import { VillageSelector, SensorConnectionBadge, metricIcon, statusStyle, formatReading } from '../Shared/SensorWidgets';
import { SENSOR_GROUPS, metricsForGroup, describeRange } from '../../data/sensorSchema';
import { UBA_PROGRAMME, DEFAULT_VILLAGE_ID } from '../../data/villages';

const parseAssetValue = (val) => {
    if (val === undefined || val === null) return { value: 0, unit: '' };
    if (typeof val === 'number') return { value: val, unit: '' };

    // Handle string cases
    if (val === 'Active' || val === 'On') return { value: 1, unit: '', isBinary: true };
    if (val === 'Off' || val === 'Inactive' || val === 'Offline') return { value: 0, unit: '', isBinary: true };

    const match = String(val).match(/([\d.]+)\s*([a-zA-Z%°]+)?/);
    if (match) {
        return { value: parseFloat(match[1]), unit: match[2] || '' };
    }
    return { value: 0, unit: '' };
};

const GROUP_TONES = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100'
};

const flowBadgeClass = (flow) => (
    flow === 'producer' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
        flow === 'consumer' ? 'bg-blue-50 text-blue-600 border-blue-100' :
            'bg-purple-50 text-purple-600 border-purple-100'
);

// ── Digital-twin asset detail (sahrdayacps `assets` node) ───────────────────
const AssetDetailView = ({ assetId, onBack }) => {
    const { assets, updateAsset } = useAssets();
    const { isAdmin, user } = useAuth();
    const asset = assets.find(a => a.id === assetId);

    if (!asset) return <div>Loading...</div>; // Handling if asset not found immediately

    // Initial parsing to get unit and binary status
    const { unit: rawUnit, isBinary } = useMemo(() => parseAssetValue(asset.val), [asset.val]);

    // Default unit to kW for energy assets if missing
    const unit = rawUnit || (asset.category === 'energy' && !isBinary ? 'kW' : '');

    const isOnline = asset.status !== 'offline';

    // History is now managed globally in AssetsContext
    const history = asset.history || [];

    const getStatusColor = (s) => {
        switch (s) {
            case 'normal': case 'Active': return 'bg-green-100 text-green-700';
            case 'warning': return 'bg-yellow-100 text-yellow-700';
            case 'critical': return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const handleToggle = async () => {
        if (!isAdmin) return; // double check
        const newStatus = isOnline ? 'offline' : 'normal';
        try {
            await updateAsset(asset.id, { status: newStatus }, user);
        } catch (error) {
            console.error("Failed to toggle asset:", error);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header / Back */}
            <div className="flex items-center gap-4 mb-6 pt-2">
                <button
                    onClick={onBack}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 min-w-0">
                        <span className="truncate">{asset.id}</span>
                        <span className="text-slate-400 font-medium text-lg whitespace-nowrap shrink-0">/ {asset.type}</span>
                        {asset.flowType && (
                            <span className={`text-xs ml-2 uppercase font-bold px-2 py-1 rounded-full border shrink-0 ${flowBadgeClass(asset.flowType)}`}>
                                {asset.flowType}
                            </span>
                        )}
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto pr-2 pb-6">
                {/* Info Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-fit">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-700">Device Status</h3>

                        <div className="flex items-center gap-3">
                            {/* Toggle Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isAdmin) handleToggle();
                                }}
                                disabled={!isAdmin}
                                className={`
                                    relative w-12 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shrink-0
                                    ${isOnline ? 'bg-green-500' : 'bg-slate-300'}
                                    ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                                title={!isAdmin ? "Admin access needed" : (isOnline ? "Turn Off" : "Turn On")}
                            >
                                <span
                                    className={`
                                        absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out
                                        ${isOnline ? 'translate-x-6' : 'translate-x-0'}
                                    `}
                                />
                            </button>

                            <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider ${getStatusColor(asset.status)}`}>
                                {asset.status}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Activity size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase">Current Reading</p>
                                <p className="text-xl font-bold text-slate-800">
                                    {isOnline ? (Math.abs(asset.val || 0)) : 'Offline'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase">Location</p>
                                <p className="text-sm font-medium text-slate-800">{asset.details || ''}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                <Battery size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase">Power Source</p>
                                <p className="text-sm font-medium text-slate-800">{asset.battery || 'Grid Line'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase">Last Update</p>
                                <p className="text-sm font-medium text-slate-800">
                                    {isOnline ? (asset.lastUpdated || 'Waiting for updates...') : '---'}
                                </p>
                            </div>
                        </div>

                        {/* Created By / Modified By Info */}
                        {asset.createdBy && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                    <User size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase">Created By</p>
                                    <p className="text-sm font-medium text-slate-800 truncate max-w-[150px]" title={asset.createdBy.name}>{asset.createdBy.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{asset.createdBy.time}</p>
                                </div>
                            </div>
                        )}

                        {asset.lastModifiedBy && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <div className="p-2 bg-pink-100 text-pink-600 rounded-lg">
                                    <User strokeWidth={2} size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase">Last Modified By</p>
                                    <p className="text-sm font-medium text-slate-800 truncate max-w-[150px]" title={asset.lastModifiedBy.name}>{asset.lastModifiedBy.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{asset.lastModifiedBy.time}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-2 flex flex-col h-[400px] min-h-[400px]">
                    <h3 className="font-bold text-slate-700 mb-6">Live Data Stream (Session)</h3>
                    <div className="flex-1 w-full min-h-0 relative">
                        {history.length > 0 ? (
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={history}>
                                        <defs>
                                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => [isBinary ? (value === 1 ? 'Active' : 'Inactive') : `${value} ${unit}`, 'Reading']}
                                        />
                                        <Area
                                            type={isBinary ? "step" : "monotone"}
                                            dataKey="value"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorVal)"
                                            isAnimationActive={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                Waiting for data updates...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const AssetCard = ({ data, onClick }) => {
    // Map status: anything not 'offline' shows value
    const isNormal = data.status !== 'offline';
    const isWarning = data.status === 'warning';

    // UI Format Helpers
    const statusLabel = data.status ? (data.status.charAt(0).toUpperCase() + data.status.slice(1)) : 'Unknown';
    const statusBg = isNormal ? 'bg-green-100' : isWarning ? 'bg-yellow-100' : 'bg-slate-200';
    const statusText = isNormal ? 'text-green-700' : isWarning ? 'text-yellow-700' : 'text-slate-600';
    const iconBg = isNormal ? 'bg-green-100 text-green-600' : isWarning ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-200 text-slate-500';

    return (
        <div
            onClick={() => onClick(data)}
            className={`p-4 rounded-xl border flex flex-col gap-3 transition-all hover:shadow-lg cursor-pointer transform hover:-translate-y-1 ${isNormal ? 'bg-white border-slate-200' :
                isWarning ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
                        <Server size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-700 truncate" title={data.id}>{data.id}</h4>
                            {data.flowType && (
                                <span className={`text-[9px] uppercase font-bold px-1 py-0.5 rounded border shrink-0 ${flowBadgeClass(data.flowType)}`}>
                                    {data.flowType}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 truncate" title={data.type}>{data.type}</p>
                    </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ml-2 ${statusBg} ${statusText}`}>
                    {statusLabel}
                </span>
            </div>

            <div className="flex items-end justify-between mt-1">
                <div>
                    <p className="text-xs text-slate-400 mb-0.5">Reading</p>
                    <div className="text-lg font-bold text-slate-800">
                        {isNormal ? (
                            Math.abs(data.val || 0)
                        ) : (
                            <span className="text-slate-400 text-sm font-normal italic">Offline</span>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-xs text-slate-400 mb-0.5">
                        <Battery size={10} /> {data.battery || 'Line'}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                        {data.lastUpdated || 'Waiting...'}
                    </p>
                </div>
            </div>

            <div className="pt-2 border-t border-slate-100 mt-1">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Wifi size={10} /> {data.details || 'Detailed Sensor View'}
                </p>
            </div>
        </div>
    );
};

// ── Village field sensors (rps-sahrdaya sensor database) ────────────────────
const MetricCard = ({ reading, onClick }) => {
    const Icon = metricIcon(reading.icon);
    const style = statusStyle(reading.status);
    const hasValue = reading.value !== null && reading.value !== undefined;

    return (
        <div
            onClick={() => onClick(reading)}
            className={`p-4 rounded-xl border flex flex-col gap-3 transition-all hover:shadow-lg cursor-pointer transform hover:-translate-y-1 ${style.card}`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.icon}`}>
                        <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-700 truncate" title={reading.label}>{reading.label}</h4>
                            {reading.flow && (
                                <span className={`text-[9px] uppercase font-bold px-1 py-0.5 rounded border shrink-0 ${flowBadgeClass(reading.flow)}`}>
                                    {reading.flow}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 truncate" title={reading.path || 'Not published yet'}>
                            {reading.zoneName ? <span className="font-medium text-slate-600">{reading.zoneName}</span> : <span className="font-mono">{reading.key}</span>}
                        </p>
                    </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ml-2 ${style.badge}`}>
                    {style.label}
                </span>
            </div>

            <div className="flex items-end justify-between mt-1 gap-2">
                <div className="min-w-0">
                    <p className="text-xs text-slate-400 mb-0.5">Reading</p>
                    <div className="text-lg font-bold text-slate-800">
                        {hasValue ? (
                            <>
                                {formatReading(reading)}
                                {reading.unit && <span className="text-xs font-medium text-slate-500 ml-1">{reading.unit}</span>}
                            </>
                        ) : (
                            <span className="text-slate-400 text-sm font-normal italic">Waiting for data</span>
                        )}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 text-xs text-slate-400 mb-0.5">
                        <Gauge size={10} /> {describeRange(reading)}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                        {reading.lastUpdated || 'Waiting...'}
                    </p>
                </div>
            </div>

            <div className="pt-2 border-t border-slate-100 mt-1">
                <p className="text-xs text-slate-500 flex items-center gap-1 truncate" title={reading.message}>
                    <Wifi size={10} className="shrink-0" /> {reading.message}
                </p>
            </div>
        </div>
    );
};

const MetricDetailView = ({ metricKey, onBack }) => {
    const { readings, selectedVillage, selectedVillageId, setMetricValue, sensorDbUrl } = useVillageSensors();
    const { isAdmin } = useAuth();
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState(null);

    const reading = readings[metricKey];
    if (!reading) return <div>Loading...</div>;

    const Icon = metricIcon(reading.icon);
    const style = statusStyle(reading.status);
    const hasValue = reading.value !== null && reading.value !== undefined;
    const history = reading.history || [];
    const isOn = reading.binary && reading.value === 1;
    const canControl = reading.controllable && isAdmin;
    const path = reading.path || `villages/${selectedVillageId}/${reading.group}/${reading.key}`;
    const dbHost = sensorDbUrl.replace(/^https?:\/\//, '');

    const handleToggle = async () => {
        if (!canControl || busy) return;
        setBusy(true);
        setActionError(null);
        try {
            await setMetricValue(selectedVillageId, metricKey, !isOn);
        } catch (error) {
            console.error('Failed to write control value:', error);
            setActionError(error?.message || 'Write failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-4 mb-6 pt-2">
                <button
                    onClick={onBack}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3 min-w-0">
                        <span className="truncate">{reading.label}</span>
                        <span className="text-slate-400 font-medium text-lg whitespace-nowrap shrink-0">/ {selectedVillage.name}</span>
                        {reading.flow && (
                            <span className={`text-xs ml-2 uppercase font-bold px-2 py-1 rounded-full border shrink-0 ${flowBadgeClass(reading.flow)}`}>
                                {reading.flow}
                            </span>
                        )}
                    </h2>
                    <p className="text-xs text-slate-500 font-mono truncate">{path}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto pr-2 pb-6">
                {/* Info Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-fit">
                    <div className="flex items-center justify-between mb-6 gap-3">
                        <h3 className="font-bold text-slate-700">Sensor Status</h3>

                        <div className="flex items-center gap-3">
                            {reading.controllable && (
                                <button
                                    onClick={handleToggle}
                                    disabled={!canControl || busy}
                                    className={`
                                        relative w-12 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shrink-0
                                        ${isOn ? 'bg-green-500' : 'bg-slate-300'}
                                        ${(!canControl || busy) ? 'opacity-50 cursor-not-allowed' : ''}
                                    `}
                                    title={!isAdmin ? 'Admin access needed' : (isOn ? 'Turn pump OFF' : 'Turn pump ON')}
                                >
                                    <span
                                        className={`
                                            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out
                                            ${isOn ? 'translate-x-6' : 'translate-x-0'}
                                        `}
                                    />
                                </button>
                            )}
                            <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider ${style.badge}`}>
                                {style.label}
                            </span>
                        </div>
                    </div>

                    {actionError && (
                        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            <span>Could not write to the field node: {actionError}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className={`p-2 rounded-lg ${style.icon}`}>
                                <Icon size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase">Current Reading</p>
                                <p className="text-xl font-bold text-slate-800">
                                    {hasValue ? formatReading(reading) : 'Waiting for data'}
                                    {hasValue && reading.unit && <span className="text-sm font-medium text-slate-500 ml-1">{reading.unit}</span>}
                                </p>
                                <p className="text-[11px] text-slate-500">{reading.message}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase">{selectedVillage.type === 'campus' ? 'Campus block' : 'Village area'}</p>
                                <p className="text-sm font-medium text-slate-800">{selectedVillage.name}{reading.zoneName ? ` · ${reading.zoneName}` : ''}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Gauge size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase">Expected Range</p>
                                <p className="text-sm font-medium text-slate-800">{describeRange(reading)}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-semibold uppercase">Last Update</p>
                                <p className="text-sm font-medium text-slate-800">{reading.lastUpdated || 'Waiting for updates...'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl min-w-0">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg shrink-0">
                                <Database size={20} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-slate-500 font-semibold uppercase">Data Source</p>
                                <p className="text-xs font-mono text-slate-800 break-all">{dbHost}</p>
                                <p className="text-xs font-mono text-slate-500 break-all">/{path}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-2 flex flex-col h-[400px] min-h-[400px]">
                    <h3 className="font-bold text-slate-700 mb-6">Live Data Stream (Session)</h3>
                    <div className="flex-1 w-full min-h-0 relative">
                        {history.length > 0 ? (
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={history}>
                                        <defs>
                                            <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={reading.binary ? [0, 1] : ['auto', 'auto']} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => [reading.binary ? (value === 1 ? 'ON' : 'OFF') : `${value} ${reading.unit}`.trim(), reading.label]}
                                        />
                                        {reading.range?.max !== undefined && (
                                            <ReferenceLine y={reading.range.max} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'High', fontSize: 10, fill: '#f59e0b' }} />
                                        )}
                                        {reading.range?.min !== undefined && (
                                            <ReferenceLine y={reading.range.min} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Low', fontSize: 10, fill: '#ef4444' }} />
                                        )}
                                        <Area
                                            type={reading.binary ? 'step' : 'monotone'}
                                            dataKey="value"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorMetric)"
                                            isAnimationActive={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-center px-6">
                                Waiting for the {selectedVillage.name} node to publish <span className="font-mono mx-1">{reading.key}</span>…
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const UbaBanner = ({ villages, campus, selectedVillageId, onSelect }) => (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-4 shadow-sm">
        <div className="pointer-events-none absolute -top-10 right-10 h-32 w-32 rounded-full bg-indigo-300/25 blur-2xl" />
        <div className="relative flex items-start gap-3">
            <div className="mt-0.5 h-9 w-9 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
                <Landmark size={18} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-800">{UBA_PROGRAMME.title}</p>
                <p className="mt-1 text-sm text-slate-700">{UBA_PROGRAMME.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {campus && (
                        <button
                            type="button"
                            onClick={() => onSelect(campus.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${campus.id === selectedVillageId
                                ? 'bg-slate-800 text-white border-slate-800 shadow'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'}`}
                            title={campus.fullName}
                        >
                            <Landmark size={11} /> {campus.name}
                            <span className={`text-[9px] uppercase tracking-wider ${campus.id === selectedVillageId ? 'text-slate-300' : 'text-emerald-600'}`}>Prototype lab</span>
                        </button>
                    )}
                    {villages.map((village) => {
                        const active = village.id === selectedVillageId;
                        const live = village.deployment === 'live';
                        return (
                            <button
                                key={village.id}
                                type="button"
                                onClick={() => onSelect(village.id)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${active
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'}`}
                            >
                                {live && <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${active ? 'bg-emerald-300' : 'bg-emerald-500'}`} />}
                                {village.name}
                                {live && <span className={`text-[9px] uppercase tracking-wider ${active ? 'text-indigo-100' : 'text-emerald-600'}`}>Live</span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    </div>
);

const VillageSummaryCard = ({ village, villagePath, villageUpdatedAt, hasData, sensorDbUrl, lastSyncAt }) => (
    <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-md p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
            <div className="flex items-center gap-2">
                <Radio size={16} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">{village.name} · {village.type === 'campus' ? 'CPS laboratory site' : 'CPS field site'}</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1">{village.description}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs shrink-0">
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 min-w-[150px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Data node</p>
                <p className="font-mono text-slate-800 truncate" title={sensorDbUrl}>
                    {hasData ? `/${villagePath || ''}` : 'awaiting first write'}
                </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 min-w-[150px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Last sync</p>
                <p className="text-slate-800 truncate">{lastSyncAt ? formatTimeIST(lastSyncAt) : 'waiting'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 min-w-[150px]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Device timestamp</p>
                <p className="text-slate-800 truncate">{villageUpdatedAt ? formatTimeIST(villageUpdatedAt) : 'not reported'}</p>
            </div>
        </div>
    </div>
);

const PlannedVillageNotice = ({ village, onSelectLive }) => (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
        <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
            <MapPin size={22} />
        </div>
        <h3 className="text-lg font-bold text-slate-700">{village.name}</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xl mx-auto">
            {village.description} Live telemetry will appear here once field nodes are commissioned under the UBA programme.
        </p>
        <button
            type="button"
            onClick={onSelectLive}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
        >
            <Radio size={14} /> View the Puthenchira prototype
        </button>
    </div>
);

export const LiveMonitoring = ({ initialAssetId, initialMetricKey }) => {
    const { assets, loading } = useAssets();
    const {
        sites, villages, selectedVillage, selectedVillageId, setSelectedVillageId,
        readings, hasData, villagePath, villageUpdatedAt, sensorDbUrl, lastSyncAt, loading: sensorsLoading
    } = useVillageSensors();
    const campusSite = sites.find((s) => s.type === 'campus');

    const [selectedAssetId, setSelectedAssetId] = useState(null);
    const [selectedMetricKey, setSelectedMetricKey] = useState(null);
    const [filter, setFilter] = useState('all');

    // Initial asset selection from navigation
    useEffect(() => {
        if (initialAssetId) {
            setSelectedAssetId(initialAssetId);
        }
    }, [initialAssetId]);

    // Initial sensor selection from navigation (e.g. map popup)
    useEffect(() => {
        if (initialMetricKey) {
            setSelectedAssetId(null);
            setSelectedMetricKey(initialMetricKey);
        }
    }, [initialMetricKey]);

    // Leave the metric detail when the village changes (not on first render)
    const villageRef = useRef(selectedVillageId);
    useEffect(() => {
        if (villageRef.current !== selectedVillageId) {
            villageRef.current = selectedVillageId;
            setSelectedMetricKey(null);
        }
    }, [selectedVillageId]);

    const isLiveVillage = selectedVillage?.deployment === 'live';
    const metricList = useMemo(() => Object.values(readings), [readings]);

    const matchesFilter = (isOnline) => filter === 'all' || (filter === 'online' ? isOnline : !isOnline);

    // Counts: village field sensors + registered digital-twin assets
    const metricOnline = isLiveVillage ? metricList.filter((r) => r.value !== null && r.value !== undefined).length : 0;
    const metricOffline = isLiveVillage ? metricList.length - metricOnline : 0;
    const assetOnline = assets.filter((a) => a.status !== 'offline').length;
    const onlineCount = metricOnline + assetOnline;
    const offlineCount = metricOffline + (assets.length - assetOnline);

    const filteredAssets = assets.filter((a) => matchesFilter(a.status !== 'offline'));

    const groupSections = SENSOR_GROUPS.map((group) => {
        const all = metricsForGroup(group.id).map((metric) => readings[metric.key]).filter(Boolean);
        return {
            ...group,
            hasLive: all.some((reading) => reading.value !== null && reading.value !== undefined),
            items: all.filter((reading) => matchesFilter(reading.value !== null && reading.value !== undefined))
        };
    }).filter((group) => group.id !== 'power' || group.hasLive || selectedVillage?.type === 'campus');

    if (loading && sensorsLoading) {
        return <div className="p-6 flex items-center justify-center h-full text-slate-500">Loading live sensor data...</div>;
    }

    if (selectedMetricKey && readings[selectedMetricKey]) {
        return (
            <div className="p-6 h-full flex flex-col">
                <div className="mb-4">
                    <DemoEncryptionNotice />
                </div>
                <MetricDetailView metricKey={selectedMetricKey} onBack={() => setSelectedMetricKey(null)} />
            </div>
        );
    }

    if (selectedAssetId) {
        return (
            <div className="p-6 h-full flex flex-col">
                <div className="mb-4">
                    <DemoEncryptionNotice />
                </div>
                <AssetDetailView assetId={selectedAssetId} onBack={() => setSelectedAssetId(null)} />
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-hidden">
            <DemoEncryptionNotice />

            <div className="flex flex-col xl:flex-row xl:items-center justify-between flex-shrink-0 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Live Sensor Network</h2>
                    <p className="text-slate-500">
                        Real-time telemetry from field devices · <span className="font-semibold text-slate-700">{selectedVillage.name}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Village pull-down */}
                    <VillageSelector />
                    <SensorConnectionBadge />

                    <div className="flex gap-4 text-sm font-medium text-slate-600 border-l border-slate-200 pl-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            {onlineCount} Online
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            {offlineCount} Offline
                        </div>
                    </div>

                    {/* Filter Toggles */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {['all', 'online', 'offline'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${filter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
                <div className="space-y-6 pb-6">
                    <UbaBanner villages={villages} campus={campusSite} selectedVillageId={selectedVillageId} onSelect={setSelectedVillageId} />

                    {isLiveVillage ? (
                        <>
                            <VillageSummaryCard
                                village={selectedVillage}
                                villagePath={villagePath}
                                villageUpdatedAt={villageUpdatedAt}
                                hasData={hasData}
                                sensorDbUrl={sensorDbUrl}
                                lastSyncAt={lastSyncAt}
                            />

                            {groupSections.map((section) => {
                                const GroupIcon = metricIcon(section.icon);
                                return (
                                    <section key={section.id}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${GROUP_TONES[section.tone] || GROUP_TONES.cyan}`}>
                                                <GroupIcon size={14} />
                                            </div>
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">{section.label}</h3>
                                            <span className="text-xs text-slate-400">· {section.items.length} sensors</span>
                                        </div>
                                        {section.items.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {section.items.map((reading) => (
                                                    <MetricCard
                                                        key={reading.key}
                                                        reading={reading}
                                                        onClick={(r) => setSelectedMetricKey(r.key)}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-400 py-4">No {section.label.toLowerCase()} sensors match the filter.</p>
                                        )}
                                    </section>
                                );
                            })}
                        </>
                    ) : (
                        <PlannedVillageNotice village={selectedVillage} onSelectLive={() => setSelectedVillageId(DEFAULT_VILLAGE_ID)} />
                    )}

                    {assets.length > 0 && (
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg border bg-slate-50 text-slate-600 border-slate-200 flex items-center justify-center">
                                    <Server size={14} />
                                </div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Registered Digital-Twin Assets</h3>
                                <span className="text-xs text-slate-400">· {filteredAssets.length} of {assets.length}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredAssets.length > 0 ? (
                                    filteredAssets.map(asset => (
                                        <AssetCard
                                            key={asset.id}
                                            data={asset}
                                            onClick={(a) => setSelectedAssetId(a.id)}
                                        />
                                    ))
                                ) : (
                                    <div className="col-span-full text-center py-6 text-slate-400">
                                        No assets match the filter.
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};
