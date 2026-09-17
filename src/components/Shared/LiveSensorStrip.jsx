import React from 'react';
import { Radio } from 'lucide-react';
import { useVillageSensors } from '../../hooks/useVillageSensors';
import { SENSOR_GROUPS, metricsForGroup } from '../../data/sensorSchema';
import { MetricTile, SensorConnectionBadge, VillageSelector } from './SensorWidgets';

/**
 * Live field-sensor strip for one sensor group (agriculture / water / energy),
 * scoped to the currently selected UBA village.
 */
export const LiveSensorStrip = ({ group, title }) => {
    const { selectedVillage, readings } = useVillageSensors();
    const groupMeta = SENSOR_GROUPS.find((entry) => entry.id === group);
    const metrics = metricsForGroup(group);
    const isLive = selectedVillage?.deployment === 'live';

    return (
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-md p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Radio size={16} className="text-blue-600 shrink-0" />
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600 truncate">
                        {title || `${groupMeta?.label || group} · Live field sensors`}
                    </p>
                    <span className="text-xs text-slate-400 truncate">· {selectedVillage?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <VillageSelector compact />
                    <SensorConnectionBadge compact />
                </div>
            </div>

            {isLive ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {metrics.map((metric) => (
                        <MetricTile key={metric.key} reading={readings[metric.key]} />
                    ))}
                </div>
            ) : (
                <p className="text-sm text-slate-500">
                    No field nodes are deployed at {selectedVillage?.name} yet. Select Puthenchira to view the live prototype.
                </p>
            )}
        </div>
    );
};
