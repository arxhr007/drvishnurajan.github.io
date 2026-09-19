import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Polygon, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Filter, Save, Settings, Activity, MapPin, Radio, Building2 } from 'lucide-react';

// Fix for default marker icon in Leaflet + React
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

import { VILLAGE_CENTER } from '../../../data/mockData';
import { SENSOR_GROUPS } from '../../../data/sensorSchema';
import { campusBoundary } from '../../../data/villages';
import { useAssets } from '../../../hooks/useAssets';
import { useVillageSensors } from '../../../hooks/useVillageSensors';
import { useAuth } from '../../../context/AuthContext';
import { VillageSelector, SensorConnectionBadge, formatReading, statusStyle } from '../../Shared/SensorWidgets';

// OpenStreetMap standard tiles – no API key required
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const GROUP_COLORS = { agriculture: '#10b981', water: '#06b6d4', energy: '#eab308', power: '#8b5cf6' };
const STATUS_STROKE = { critical: '#ef4444', warning: '#f59e0b', offline: '#94a3b8' };
const SITE_COLOR = '#6366f1';
const ZONE_COLORS = {
    academic: '#6366f1', hostel: '#ec4899', facility: '#f59e0b', open: '#22c55e',
    agriculture: '#10b981', water: '#06b6d4', energy: '#eab308'
};

const AssetPopup = ({ asset, onUpdate, onNavigate }) => {
    const { isAdmin } = useAuth();
    const [min, setMin] = useState(asset.thresholds?.min || 0);
    const [max, setMax] = useState(asset.thresholds?.max || 100);
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = () => {
        onUpdate(asset.firebaseId || asset.id, { thresholds: { ...asset.thresholds, min: parseFloat(min), max: parseFloat(max) } });
        setIsEditing(false);
    };
    const togglePower = () => {
        onUpdate(asset.firebaseId || asset.id, { status: asset.status === 'offline' ? 'normal' : 'offline' });
    };
    const isOn = asset.status !== 'offline';

    return (
        <div className="p-2 min-w-[200px]">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <div>
                    <h3 className="font-bold text-slate-800 text-sm">{asset.type}</h3>
                    <p className="text-[10px] text-slate-500 font-mono">{asset.id}</p>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${asset.status === 'critical' ? 'bg-red-100 text-red-600' : asset.status === 'warning' ? 'bg-amber-100 text-amber-600' : asset.status === 'offline' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-600'}`}>
                    {asset.status}
                </div>
            </div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Current</p>
                    <p className="text-lg font-bold text-slate-700">{isOn ? asset.val : 'Off'}</p>
                </div>
                {isAdmin && (
                    <button onClick={togglePower} className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95 ${isOn ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20 shadow-lg' : 'bg-slate-400 hover:bg-slate-500'}`}>
                        {isOn ? 'ACTIVE' : 'OFFLINE'}
                    </button>
                )}
            </div>
            {onNavigate && (
                <button onClick={() => onNavigate('live', { assetId: asset.id })} className="w-full mb-3 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 py-1.5 rounded-lg text-xs font-bold transition-colors">
                    <Activity size={12} /> View Live Data
                </button>
            )}
            {isAdmin && (
                <div className="bg-slate-50 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Settings size={12} /> Config</p>
                        <button onClick={() => setIsEditing(!isEditing)} className="text-[10px] text-blue-500 hover:underline">{isEditing ? 'Cancel' : 'Edit'}</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Min</label>
                            <input type="number" disabled={!isEditing} value={min} onChange={(e) => setMin(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:border-blue-500 transition-colors disabled:bg-slate-100" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Max</label>
                            <input type="number" disabled={!isEditing} value={max} onChange={(e) => setMax(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:border-blue-500 transition-colors disabled:bg-slate-100" />
                        </div>
                    </div>
                    {isEditing && (
                        <button onClick={handleSave} className="w-full mt-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium py-1 rounded transition-colors flex items-center justify-center gap-1">
                            <Save size={12} /> Save
                        </button>
                    )}
                </div>
            )}
            {asset.incidents && asset.incidents.length > 0 && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 p-1.5 rounded border border-red-100"><span className="font-bold">Alert:</span> {asset.incidents.join(', ')}</div>
            )}
        </div>
    );
};

// Popup for a field sensor from the sensor database
const SensorPopup = ({ marker, site, onNavigate }) => {
    const style = statusStyle(marker.status);
    const hasValue = marker.value !== null && marker.value !== undefined;
    return (
        <div className="p-2 min-w-[220px]">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2 gap-2">
                <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 text-sm truncate">{marker.label}</h3>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{marker.path || marker.key}</p>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${style.badge}`}>{style.label}</div>
            </div>
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Current</p>
                    <p className="text-lg font-bold text-slate-700">
                        {hasValue ? <>{formatReading(marker)}{marker.unit && <span className="text-xs text-slate-500 ml-1">{marker.unit}</span>}</> : <span className="text-sm font-normal italic text-slate-400">Waiting for data</span>}
                    </p>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full text-white" style={{ backgroundColor: GROUP_COLORS[marker.group] || '#64748b' }}>{marker.group}</span>
            </div>
            <div className="text-[11px] text-slate-600 space-y-1 mb-3">
                <p><span className="font-semibold">Site:</span> {site?.name}</p>
                <p><span className="font-semibold">{site?.type === 'campus' ? 'Block' : 'Area'}:</span> {marker.zoneName || 'not placed'}</p>
                <p className="font-mono text-slate-500">
                    {marker.coords[0].toFixed(5)}, {marker.coords[1].toFixed(5)}
                    <span className="ml-1 text-slate-400">({marker.coordsSource === 'zone' ? 'zone centre' : marker.coordsSource === 'default' ? 'default placement' : marker.coordsSource})</span>
                </p>
                <p className="text-slate-500">{marker.message}</p>
                {marker.lastUpdated && <p className="text-slate-400">Updated {marker.lastUpdated}</p>}
            </div>
            {onNavigate && (
                <button onClick={() => onNavigate('live', { metricKey: marker.key })} className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 py-1.5 rounded-lg text-xs font-bold transition-colors">
                    <Activity size={12} /> View Live Data
                </button>
            )}
        </div>
    );
};

// Re-centres the map whenever the selected site changes
const SiteFocus = ({ siteId, center, zoom, points }) => {
    const map = useMap();
    const lastRef = useRef(null);
    useEffect(() => {
        if (!center || lastRef.current === siteId) return;
        const isFirst = lastRef.current === null;
        lastRef.current = siteId;
        if (points.length >= 2) {
            const bounds = L.latLngBounds(points).pad(0.12);
            if (isFirst) map.fitBounds(bounds); else map.flyToBounds(bounds, { duration: 0.9 });
        } else if (isFirst) map.setView(center, zoom || 15);
        else map.flyTo(center, zoom || 15, { duration: 0.9 });
    }, [map, siteId, center, zoom, points]);
    return null;
};

export const MapVisualizer = ({
    initialCategory = 'all',
    showFilters = true,
    showVillagePicker = true,
    zoomControl = true,
    interactive = true,
    onNavigate
}) => {
    const context = useAssets();
    const { assets, updateAsset } = context || {};
    const safeAssets = Array.isArray(assets) ? assets : [];

    const { selectedVillage: site, selectedVillageId, villageCenter, markers, zones, hasData } = useVillageSensors();

    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCategory, setFilterCategory] = useState(initialCategory);
    useEffect(() => { setFilterCategory(initialCategory); }, [initialCategory]);

    const getAssetColor = (asset) => {
        if (!asset) return '#64748b';
        if (asset.status === 'offline') return '#94a3b8';
        if (asset.status === 'critical') return '#ef4444';
        if (asset.status === 'warning') return '#f59e0b';
        return { water: '#06b6d4', energy: '#eab308', controls: '#8b5cf6', agriculture: '#10b981', health: '#f43f5e', mobility: '#6366f1', assistive_tech: '#14b8a6' }[asset.category] || '#64748b';
    };

    const filteredAssets = safeAssets.filter((asset) => {
        if (!asset || !asset.coords) return false;
        if (filterStatus === 'active' && asset.status === 'offline') return false;
        if (filterStatus === 'offline' && asset.status !== 'offline') return false;
        if (filterCategory !== 'all' && asset.category !== filterCategory) return false;
        return true;
    });

    const filteredMarkers = markers.filter((marker) => {
        if (!marker?.coords) return false;
        const hasValue = marker.value !== null && marker.value !== undefined;
        if (filterStatus === 'active' && !hasValue) return false;
        if (filterStatus === 'offline' && hasValue) return false;
        if (filterCategory !== 'all' && marker.group !== filterCategory) return false;
        return true;
    });

    const isCampus = site?.type === 'campus';
    const isLiveSite = site?.deployment === 'live';
    const boundary = isCampus ? campusBoundary() : null;
    const mapCenter = villageCenter || VILLAGE_CENTER;
    const mapZoom = site?.zoom || 15;
    const focusPoints = [
        ...markers.map((m) => m.coords).filter(Boolean),
        ...(boundary || [])
    ];
    const zoneRadius = isCampus ? 32 : 110;

    return (
        <div className="w-full h-full bg-slate-50 relative group">
            <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                scrollWheelZoom={interactive}
                dragging={interactive}
                touchZoom={interactive}
                doubleClickZoom={interactive}
                boxZoom={interactive}
                keyboard={interactive}
                zoomControl={interactive && zoomControl}
                className={`w-full h-full outline-none ${!interactive ? 'pointer-events-none' : ''}`}
                style={{ background: '#f8fafc' }}
            >
                <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />
                <SiteFocus siteId={selectedVillageId} center={villageCenter} zoom={mapZoom} points={focusPoints} />

                {/* Site outline: campus boundary from OSM, or a ring for a village */}
                {boundary ? (
                    <Polygon positions={boundary} pathOptions={{ color: SITE_COLOR, weight: 2, dashArray: '8 6', fillColor: SITE_COLOR, fillOpacity: 0.03 }} interactive={false} />
                ) : villageCenter && (
                    <Circle center={villageCenter} radius={620} pathOptions={{ color: SITE_COLOR, weight: 1.5, dashArray: '6 6', fillColor: SITE_COLOR, fillOpacity: 0.05 }}>
                        <Tooltip direction="top" opacity={0.95} permanent offset={[0, -8]}>
                            <span className="text-[11px] font-bold text-indigo-700">{site?.name} · {isLiveSite ? 'UBA live site' : 'UBA adopted village'}</span>
                        </Tooltip>
                    </Circle>
                )}

                {/* Blocks (campus) / areas (village) */}
                {zones.map((zone) => {
                    const color = ZONE_COLORS[zone.category] || SITE_COLOR;
                    const active = zone.sensorCount > 0;
                    const pathOptions = { color, weight: active ? 2.5 : 1.2, fillColor: color, fillOpacity: active ? 0.35 : 0.12, dashArray: zone.polygon ? undefined : '4 4' };
                    const label = (
                        <Tooltip permanent direction="center" opacity={1} className="zone-label">
                            <span style={{ color }}>{zone.name}{active ? ` · ${zone.sensorCount}` : ''}</span>
                        </Tooltip>
                    );
                    return zone.polygon ? (
                        <Polygon key={zone.id} positions={zone.polygon} pathOptions={pathOptions}>{label}</Polygon>
                    ) : zone.center ? (
                        <Circle key={zone.id} center={zone.center} radius={zoneRadius} pathOptions={pathOptions}>{label}</Circle>
                    ) : null;
                })}

                {/* Planned village: centre pin only */}
                {villageCenter && !isLiveSite && (
                    <CircleMarker center={villageCenter} radius={8} pathOptions={{ color: SITE_COLOR, fillColor: '#ffffff', fillOpacity: 1, weight: 3, className: 'pointer-events-auto' }}>
                        {interactive && (
                            <Popup>
                                <div className="p-2 min-w-[200px]">
                                    <h3 className="font-bold text-slate-800 text-sm">{site?.name}</h3>
                                    <p className="text-xs text-slate-500 mt-1">{site?.description}</p>
                                    <p className="text-[11px] text-amber-600 mt-2">No field sensor nodes deployed yet.</p>
                                </div>
                            </Popup>
                        )}
                    </CircleMarker>
                )}

                {/* Field sensors */}
                {filteredMarkers.map((marker) => {
                    const hasValue = marker.value !== null && marker.value !== undefined;
                    const fill = GROUP_COLORS[marker.group] || '#64748b';
                    const stroke = STATUS_STROKE[marker.status] || fill;
                    return (
                        <CircleMarker
                            key={`sensor-${marker.key}`}
                            center={marker.coords}
                            radius={hasValue ? (isCampus ? 8 : 10) : 6}
                            pathOptions={{ color: stroke, fillColor: fill, fillOpacity: hasValue ? 0.85 : 0.25, weight: marker.status === 'critical' || marker.status === 'warning' ? 4 : 2.5, className: 'pointer-events-auto' }}
                            eventHandlers={{ click: () => !interactive && onNavigate && onNavigate('live', { metricKey: marker.key }) }}
                        >
                            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                                <div className="text-xs font-bold text-slate-700">{marker.label}</div>
                                <div className="text-[10px] text-slate-500">{hasValue ? `${formatReading(marker)} ${marker.unit || ''}`.trim() : 'Waiting for data'}{marker.zoneName ? ` · ${marker.zoneName}` : ''}</div>
                            </Tooltip>
                            {interactive && <Popup><SensorPopup marker={marker} site={site} onNavigate={onNavigate} /></Popup>}
                        </CircleMarker>
                    );
                })}

                {/* Registered digital-twin assets (sahrdayacps) */}
                {filteredAssets.map((asset) => (
                    <CircleMarker
                        key={asset.id}
                        center={asset.coords}
                        pathOptions={{ color: getAssetColor(asset), fillColor: getAssetColor(asset), fillOpacity: asset.status !== 'offline' ? 0.6 : 0.3, weight: 2, className: 'pointer-events-auto' }}
                        radius={asset.status !== 'offline' ? 10 : 6}
                        eventHandlers={{ click: () => !interactive && onNavigate && onNavigate('live', { assetId: asset.id }) }}
                    >
                        <Tooltip direction="top" offset={[0, -10]} opacity={1}><div className="text-xs font-bold text-slate-700">{asset.type}</div></Tooltip>
                        {interactive && <Popup><AssetPopup asset={asset} onUpdate={updateAsset} onNavigate={onNavigate} /></Popup>}
                    </CircleMarker>
                ))}

                <div className="leaflet-top leaflet-left w-full h-full pointer-events-none z-[400] overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.4)_100%)]"></div>
                </div>
            </MapContainer>

            {/* Site picker + legend */}
            {showVillagePicker && (
                <div className={`absolute top-4 ${interactive && zoomControl ? 'left-14' : 'left-4'} z-[500] flex flex-col gap-2 pointer-events-auto`}>
                    <div className="bg-white/90 backdrop-blur-md p-2 rounded-xl border border-slate-200 shadow-lg flex flex-col gap-2 w-64">
                        <div className="p-1 border-b border-slate-100 flex items-center gap-2">
                            {isCampus ? <Building2 size={16} className="text-slate-600" /> : <MapPin size={16} className="text-slate-600" />}
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{isCampus ? 'Campus' : 'UBA Village'}</span>
                        </div>
                        <VillageSelector className="w-full" />
                        <div className="flex items-center justify-between px-1">
                            <SensorConnectionBadge compact />
                            <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                                <Radio size={10} /> {isLiveSite ? `${filteredMarkers.length} sensor nodes` : 'No nodes yet'}
                            </span>
                        </div>
                        <p className="px-1 text-[10px] text-slate-500">
                            {zones.length} {isCampus ? 'blocks' : 'areas'} · {zones.filter((z) => z.sensorCount > 0).length} with live sensors
                        </p>
                        {isLiveSite && !hasData && <p className="px-1 text-[10px] text-amber-600">Nodes drawn at their default blocks until readings arrive.</p>}
                        {site?.approx && <p className="px-1 text-[10px] text-amber-600">Approximate centre. Correct it in Site &amp; Alerts.</p>}
                    </div>

                    <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-lg flex flex-wrap gap-x-3 gap-y-1 w-64">
                        {SENSOR_GROUPS.map((group) => (
                            <span key={group.id} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS[group.id] }} />{group.label}
                            </span>
                        ))}
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600"><span className="w-2.5 h-2.5 rounded-full border-2 border-red-500 bg-white" /> Alert</span>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-400/40 border border-indigo-500" /> {isCampus ? 'Block with sensors' : 'Area with sensors'}</span>
                    </div>
                </div>
            )}

            {showFilters && (
                <div className={`absolute ${showVillagePicker ? 'top-64' : 'top-4'} left-14 z-[500] bg-white/90 backdrop-blur shadow-lg rounded-xl p-2 flex flex-col gap-2 border border-slate-100 transition-opacity opacity-0 group-hover:opacity-100 duration-300`}>
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-1">
                        <Filter size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Filters</span>
                    </div>
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        {['all', 'active', 'offline'].map((s) => (
                            <button key={s} onClick={() => setFilterStatus(s)} className={`flex-1 px-3 py-1 text-[10px] font-bold uppercase rounded transition-all ${filterStatus === s ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{s}</button>
                        ))}
                    </div>
                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full text-xs border-none bg-slate-50 rounded-lg px-2 py-1.5 text-slate-600 font-medium focus:ring-0 cursor-pointer hover:bg-slate-100">
                        <option value="all">All Types</option>
                        {['energy', 'water', 'controls', 'agriculture', 'power', 'health', 'mobility', 'assistive_tech'].map((cat) => (
                            <option key={cat} value={cat}>{cat === 'assistive_tech' ? 'Assistive Technology' : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="absolute bottom-4 left-4 z-[400] bg-white/80 backdrop-blur px-3 py-2 rounded-lg text-[10px] text-slate-500 shadow-sm border border-slate-100 pointer-events-none">
                {isLiveSite ? 'Click a sensor node for live readings' : 'Select a site to view its sensor nodes'}
            </div>
        </div>
    );
};
