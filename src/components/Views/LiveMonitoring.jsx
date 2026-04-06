
import React, { useState, useMemo, useEffect } from 'react';
import { Activity, Thermometer, Wind, Wifi, Battery, Server, ArrowLeft, Clock, MapPin, AlertCircle, User } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAssets } from '../../hooks/useAssets';
import { formatTimeIST } from '../../utils/timeUtils';
import { DemoEncryptionNotice } from '../Shared/DemoEncryptionNotice';

import { useAuth } from '../../context/AuthContext';

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
                            <span className={`text-xs ml-2 uppercase font-bold px-2 py-1 rounded-full border shrink-0 ${asset.flowType === 'producer' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                asset.flowType === 'consumer' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    'bg-purple-50 text-purple-600 border-purple-100'
                                }`}>
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

const SensorCard = ({ data, onClick }) => {
    // Map status 'normal' -> 'Active' for UI consistency
    // Map status: anything not 'offline' shows value
    const isNormal = data.status !== 'offline';
    const isWarning = data.status === 'warning';

    // UI Format Helpers
    const statusLabel = data.status ? (data.status.charAt(0).toUpperCase() + data.status.slice(1)) : 'Unknown';
    const statusColor = isNormal ? 'green' : isWarning ? 'yellow' : 'slate';
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
                                <span className={`text-[9px] uppercase font-bold px-1 py-0.5 rounded border shrink-0 ${data.flowType === 'producer' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    data.flowType === 'consumer' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                        'bg-purple-50 text-purple-600 border-purple-100'
                                    }`}>
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

export const LiveMonitoring = ({ initialAssetId }) => {
    const { assets, loading } = useAssets();
    const [selectedAssetId, setSelectedAssetId] = useState(null);
    const [filter, setFilter] = useState('all');

    // Initial asset selection from navigation
    useEffect(() => {
        if (initialAssetId) {
            setSelectedAssetId(initialAssetId);
        }
    }, [initialAssetId]);

    // Derive the selected asset from the latest assets array
    const selectedAsset = useMemo(() => {
        if (!selectedAssetId) return null;
        return assets.find(a => a.id === selectedAssetId);
    }, [assets, selectedAssetId]);

    // Calculate dynamic stats
    const onlineCount = assets.filter(a => a.status !== 'offline').length;
    const offlineCount = assets.length - onlineCount;

    const filteredAssets = assets.filter(a => {
        const isOnline = a.status !== 'offline';
        if (filter === 'online') return isOnline;
        if (filter === 'offline') return !isOnline;
        return true;
    });

    if (loading) {
        return <div className="p-6 flex items-center justify-center h-full text-slate-500">Loading live sensor data...</div>;
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

            <div className="flex flex-col md:flex-row md:items-center justify-between flex-shrink-0 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Live Sensor Network</h2>
                    <p className="text-slate-500">Real-time telemetry from field devices</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex gap-4 text-sm font-medium text-slate-600 border-r border-slate-200 pr-4">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
                    {filteredAssets.length > 0 ? (
                        filteredAssets.map(asset => (
                            <SensorCard
                                key={asset.id}
                                data={asset}
                                onClick={(a) => setSelectedAssetId(a.id)}
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-10 text-slate-400">
                            No sensors match the filter.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
