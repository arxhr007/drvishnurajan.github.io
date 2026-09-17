import React from 'react';
import {
    Activity, ChevronDown, CloudRain, Cylinder, Droplets, Eye, FlaskConical, House, MapPin,
    Power, Sprout, Sun, Thermometer, Waves, Wifi, WifiOff, Wind, Zap
} from 'lucide-react';
import { useVillageSensors } from '../../hooks/useVillageSensors';

// Icon names referenced from src/data/sensorSchema.js
export const METRIC_ICONS = {
    Activity, CloudRain, Cylinder, Droplets, Eye, FlaskConical, House, Power, Sprout, Sun, Thermometer, Waves, Wind, Zap
};

export const metricIcon = (name) => METRIC_ICONS[name] || Activity;

export const STATUS_STYLES = {
    normal: { badge: 'bg-green-100 text-green-700', icon: 'bg-green-100 text-green-600', card: 'bg-white border-slate-200', dot: 'bg-green-500', label: 'Normal' },
    warning: { badge: 'bg-amber-100 text-amber-700', icon: 'bg-amber-100 text-amber-600', card: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', label: 'Warning' },
    critical: { badge: 'bg-red-100 text-red-700', icon: 'bg-red-100 text-red-600', card: 'bg-red-50 border-red-200', dot: 'bg-red-500', label: 'Critical' },
    offline: { badge: 'bg-slate-200 text-slate-600', icon: 'bg-slate-200 text-slate-500', card: 'bg-slate-50 border-slate-200 opacity-70', dot: 'bg-slate-400', label: 'No data' }
};

export const statusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.offline;

export const formatReading = (reading) => {
    if (!reading || reading.value === null || reading.value === undefined) return '—';
    if (reading.binary) return reading.value ? 'ON' : 'OFF';
    const value = Math.round(reading.value * 100) / 100;
    return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

/** Pull-down to pick the UBA village whose telemetry is shown. */
export const VillageSelector = ({ compact = false, className = '' }) => {
    const { villages, selectedVillageId, setSelectedVillageId } = useVillageSensors();

    return (
        <label
            className={`relative inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-blue-300 transition-colors ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} ${className}`}
            title="Select UBA adopted village"
        >
            <MapPin size={compact ? 14 : 16} className="text-blue-600 shrink-0" />
            {!compact && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">Village</span>}
            <select
                value={selectedVillageId}
                onChange={(event) => setSelectedVillageId(event.target.value)}
                className={`appearance-none bg-transparent pr-5 font-semibold text-slate-800 outline-none cursor-pointer ${compact ? 'text-xs' : 'text-sm'}`}
                aria-label="Select village"
            >
                {villages.map((village) => (
                    <option key={village.id} value={village.id}>
                        {village.name}{village.deployment === 'live' ? ' · Live prototype' : ' · Planned'}
                    </option>
                ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 pointer-events-none text-slate-400" />
        </label>
    );
};

/** Socket + data state of the RPS Sahrdaya sensor database. */
export const SensorConnectionBadge = ({ compact = false }) => {
    const { connected, hasData, selectedVillage, loading } = useVillageSensors();

    let tone = 'bg-red-50 text-red-600 border-red-200';
    let text = 'Disconnected';
    let Icon = WifiOff;

    if (loading) {
        tone = 'bg-slate-50 text-slate-500 border-slate-200';
        text = 'Connecting…';
        Icon = Wifi;
    } else if (connected && hasData) {
        tone = 'bg-green-50 text-green-600 border-green-200';
        text = 'Live';
        Icon = Wifi;
    } else if (connected && selectedVillage?.deployment === 'live') {
        tone = 'bg-amber-50 text-amber-600 border-amber-200';
        text = 'Connected · awaiting data';
        Icon = Wifi;
    } else if (connected) {
        tone = 'bg-slate-50 text-slate-500 border-slate-200';
        text = 'Connected';
        Icon = Wifi;
    }

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-lg border font-medium ${compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'} ${tone}`}>
            <Icon size={12} />
            {text}
        </span>
    );
};

/** Compact stat tile used on the category dashboards. */
export const MetricTile = ({ reading, onClick }) => {
    const Icon = metricIcon(reading.icon);
    const style = statusStyle(reading.status);
    const hasValue = reading.value !== null && reading.value !== undefined;

    return (
        <button
            type="button"
            onClick={onClick ? () => onClick(reading) : undefined}
            className={`text-left rounded-xl border p-3 transition-all ${style.card} ${onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}`}
            title={reading.message}
        >
            <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.icon}`}>
                    <Icon size={15} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{reading.label}</p>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-xl font-bold ${hasValue ? 'text-slate-800' : 'text-slate-400'}`}>{formatReading(reading)}</span>
                {hasValue && reading.unit && <span className="text-xs text-slate-500">{reading.unit}</span>}
            </div>
            <p className="mt-1 text-[10px] text-slate-400 truncate">{reading.lastUpdated || 'Waiting for node…'}</p>
        </button>
    );
};
