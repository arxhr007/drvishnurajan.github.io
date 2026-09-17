import React from 'react';
import { Clock, Database, LayoutDashboard, Map as MapIcon } from 'lucide-react';
import { MapVisualizer } from './MapVisualizer/MapVisualizer';
import { VillageKPIs } from './KPIBoard/VillageKPIs';
import { AlertsPanel } from './Insights/AlertsPanel';
import { TrendCharts } from './Trends/TrendCharts';
import { SystemControls } from './ControlPanel/SystemControls';
import { ModelInsights } from '../Shared/ModelInsights';
import { DemoEncryptionNotice } from '../Shared/DemoEncryptionNotice';
import { VillageSelector, SensorConnectionBadge } from '../Shared/SensorWidgets';
import { useVillageInsights } from '../../hooks/useVillageInsights';
import { useVillageSensors } from '../../hooks/useVillageSensors';
import { formatTimeIST } from '../../utils/timeUtils';

const DataSourceBadge = ({ dataSource, liveCount }) => {
    const styles = {
        live: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        mixed: 'bg-amber-50 text-amber-700 border-amber-200',
        synthetic: 'bg-slate-50 text-slate-600 border-slate-200'
    };
    const text = dataSource === 'live'
        ? 'All sensors live'
        : dataSource === 'mixed'
            ? `${liveCount} live · rest baseline`
            : 'Synthetic baseline';
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${styles[dataSource]}`} title="Live readings come from the RPS Sahrdaya Firebase database; the baseline is a seeded 7-day synthetic history used until nodes report.">
            <Database size={12} /> {text}
        </span>
    );
};

export const Dashboard = ({ onNavigate }) => {
    const { village, dataSource, liveCount, insights } = useVillageInsights();
    const { villageUpdatedAt } = useVillageSensors();
    const isLiveVillage = village?.deployment === 'live';

    return (
        <div className="h-full overflow-y-auto pr-1 space-y-6 pb-6">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <LayoutDashboard size={22} className="text-blue-600" />
                        Village Overview · {village?.name}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {isLiveVillage
                            ? 'Real-time telemetry from the UBA prototype nodes with model-based predictions and alerts.'
                            : `${village?.name} has no field nodes yet – showing the synthetic baseline and model outputs for planning.`}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <VillageSelector />
                    <SensorConnectionBadge />
                    <DataSourceBadge dataSource={dataSource} liveCount={liveCount} />
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock size={12} />
                        {villageUpdatedAt ? `Device ${formatTimeIST(villageUpdatedAt)}` : `Model run ${formatTimeIST(new Date(insights.computedAt))}`}
                    </span>
                </div>
            </div>

            {/* KPIs */}
            <VillageKPIs onNavigate={onNavigate} />

            {/* Alerts + Trends */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <AlertsPanel onNavigate={onNavigate} className="xl:col-span-1 max-h-[640px]" />
                <div className="xl:col-span-3">
                    <TrendCharts />
                </div>
            </div>

            {/* ML predictions per domain */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <ModelInsights group="agriculture" />
                <ModelInsights group="water" />
                <ModelInsights group="energy" />
            </div>

            {/* Map + controls */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 relative h-96 rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-slate-100">
                    <MapVisualizer showFilters={false} showVillagePicker={false} zoomControl={false} onNavigate={onNavigate} />
                    <button
                        onClick={() => onNavigate && onNavigate('map')}
                        className="absolute top-3 right-3 z-[500] inline-flex items-center gap-1.5 rounded-lg bg-white/90 backdrop-blur border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow hover:bg-white"
                    >
                        <MapIcon size={14} /> Open City Map
                    </button>
                </div>
                <SystemControls onNavigate={onNavigate} className="h-96" />
            </div>

            <DemoEncryptionNotice />
        </div>
    );
};
