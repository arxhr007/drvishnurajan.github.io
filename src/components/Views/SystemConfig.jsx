import React, { useState, useEffect } from 'react';
import { useAssets } from '../../hooks/useAssets';
import { useAuth } from '../../context/AuthContext';
import { formatTimeIST } from '../../utils/timeUtils';
import { Save, Plus, AlertTriangle, X, Trash2, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icons
// Fix Leaflet icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const LocationPicker = ({ position, onLocationSelect }) => {
    const map = useMap();

    // Fly to position if exists and map just loaded
    React.useEffect(() => {
        if (position && position[0] && position[1]) {
            map.flyTo(position, map.getZoom());
        }
    }, [position, map]);

    useMapEvents({
        click(e) {
            onLocationSelect([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position ? <Marker position={position} /> : null;
};

const MapSearch = () => {
    const map = useMap();
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const containerRef = React.useRef(null);

    React.useEffect(() => {
        if (containerRef.current) {
            L.DomEvent.disableClickPropagation(containerRef.current);
            L.DomEvent.disableScrollPropagation(containerRef.current);
        }
    }, []);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query) return;
        setSearching(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                map.flyTo([parseFloat(lat), parseFloat(lon)], 16);
            } else {
                alert('Location not found');
            }
        } catch (err) {
            console.error("Search failed", err);
            alert('Search failed');
        }
        setSearching(false);
    };

    return (
        <div
            ref={containerRef}
            className="leaflet-top leaflet-right"
            style={{ pointerEvents: 'auto', zIndex: 1000, margin: '10px' }}
        >
            <div className="leaflet-control flex bg-white rounded-lg shadow-md border border-slate-300 overflow-hidden">
                <form onSubmit={handleSearch} className="flex">
                    <input
                        type="text"
                        placeholder="Search place..."
                        className="px-3 py-1.5 text-xs outline-none w-40 text-slate-700"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button
                        type="submit"
                        className="bg-blue-600 text-white px-3 hover:bg-blue-700 transition-colors flex items-center justify-center p-0"
                        disabled={searching}
                    >
                        <Search size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export const SystemConfig = () => {
    const { assets, updateAsset, deleteAsset, loading, categories } = useAssets();
    const { user } = useAuth();
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [formData, setFormData] = useState({});


    // Reset form when selection changes
    useEffect(() => {
        if (selectedAsset) {
            setFormData(JSON.parse(JSON.stringify(selectedAsset))); // Deep copy
            setIsCreating(false);
        } else if (isCreating) {
            setFormData({
                id: `NEW-${Math.floor(Math.random() * 1000)}`,
                type: 'New Asset',
                category: 'energy',
                status: 'offline',
                val: 0,
                details: 'Description here',
                coords: [10.0, 76.0],
                range: { min: 0, max: 100, minMsg: '', maxMsg: '' }
            });
        }
    }, [selectedAsset, isCreating]);

    const handleSave = async () => {
        try {
            // Ensure numbers are numbers
            const finalData = {
                ...formData,
                val: Number(formData.val),
                range: {
                    ...formData.range,
                    min: Number(formData.range?.min || 0),
                    max: Number(formData.range?.max || 100)
                },
                coords: [
                    Number(formData.coords?.[0] || 0),
                    Number(formData.coords?.[1] || 0)
                ]
            };

            if (isCreating) {
                const timestamp = formatTimeIST(new Date());
                finalData.createdBy = {
                    name: user?.displayName || 'Unknown',
                    email: user?.email,
                    time: timestamp
                };
            }

            await updateAsset(finalData.id, finalData, user);
            alert('Saved successfully!');
            // If creating, select the new asset
            if (isCreating) {
                // We might need to handle ID collision or refresh
                setIsCreating(false);
                setSelectedAsset(null); // Clear to refresh list/selection logic
            }
        } catch (error) {
            console.error("Save failed", error);
            alert('Failed to save');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this asset? This section cannot be undone.")) return;

        try {
            await deleteAsset(formData.id);
            alert("Asset deleted successfully.");
            setSelectedAsset(null);
        } catch (error) {
            alert("Failed to delete asset.");
            console.error(error);
        }
    };

    const filteredAssets = assets.filter(a =>
        a.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col lg:flex-row h-full gap-4 lg:gap-6">
            {/* Sidebar List */}
            <div className="w-full lg:w-1/3 h-[40%] lg:h-auto bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-200 p-4 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-700">Assets</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setIsCreating(true); setSelectedAsset(null); }}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search assets..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {filteredAssets.map(asset => (
                        <div
                            key={asset.id}
                            onClick={() => setSelectedAsset(asset)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedAsset?.id === asset.id
                                ? 'bg-blue-50 border-blue-200 shadow-sm'
                                : 'bg-white border-slate-100 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex justify-between items-center gap-2">
                                <span className="font-medium text-slate-700 truncate" title={asset.type}>{asset.type}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${asset.status === 'normal' ? 'bg-emerald-100 text-emerald-700' :
                                    asset.status === 'offline' ? 'bg-slate-100 text-slate-600' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>{asset.status}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex justify-between">
                                <span>{asset.id}</span>
                                <span>{asset.category}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Panel */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-y-auto">
                {(selectedAsset || isCreating) ? (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">
                                    {isCreating ? 'Create New Asset' : `Edit ${formData.type}`}
                                </h2>
                                <p className="text-slate-500 text-sm mt-1">{formData.id}</p>
                            </div>
                            <div className="flex gap-2">
                                {!isCreating && (
                                    <button
                                        onClick={handleDelete}
                                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                        title="Delete Asset"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedAsset(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* General Info */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-600">Asset ID</label>
                                <input
                                    type="text"
                                    value={formData.id || ''}
                                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                    disabled={!isCreating}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 disabled:opacity-60 font-mono text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-600">Type Name</label>
                                <input
                                    type="text"
                                    value={formData.type || ''}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-600">Location / Details</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Main Avenue Zone"
                                    value={formData.details || ''}
                                    onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-600">Category</label>
                                <select
                                    value={formData.category || 'energy'}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="flex-1 w-full p-2.5 rounded-lg border border-slate-200 bg-white capitalize"
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>
                                            {cat === 'assistive_tech' ? 'Assistive Technology' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-600">Flow Type / Role</label>
                                <select
                                    value={formData.flowType || 'consumer'}
                                    onChange={(e) => setFormData({ ...formData, flowType: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                                >
                                    <option value="consumer">Consumer (Load)</option>
                                    <option value="producer">Producer (Generator)</option>
                                    <option value="storage">Storage</option>
                                    <option value="sensor">Sensor/IoT</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-600">Initial Status</label>
                                <select
                                    value={formData.status || 'offline'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                                >
                                    <option value="normal">Normal (On)</option>
                                    <option value="offline">Offline (Off)</option>
                                </select>
                            </div>
                        </div>

                        {/* Range Configuration */}
                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-4">
                            <h3 className="flex items-center gap-2 font-semibold text-slate-700">
                                <AlertTriangle size={18} className="text-amber-500" />
                                Range & Warnings
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Min Value</label>
                                    <input
                                        type="number"
                                        value={formData.range?.min ?? 0}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            range: { ...formData.range, min: e.target.value }
                                        })}
                                        className="w-full mt-1 p-2 rounded-lg border border-slate-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Max Value</label>
                                    <input
                                        type="number"
                                        value={formData.range?.max ?? 100}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            range: { ...formData.range, max: e.target.value }
                                        })}
                                        className="w-full mt-1 p-2 rounded-lg border border-slate-200"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="space-y-1">
                                    <label className="text-sm text-slate-600">Min Warning Message</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Pressure critically low!"
                                        value={formData.range?.minMsg || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            range: { ...formData.range, minMsg: e.target.value }
                                        })}
                                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-slate-600">Max Warning Message</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Tank overflow imminent!"
                                        value={formData.range?.maxMsg || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            range: { ...formData.range, maxMsg: e.target.value }
                                        })}
                                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Location Picker */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-600">Location (Click map to set)</label>
                            <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner relative z-0">
                                <MapContainer
                                    center={[10.3594, 76.2858]} // VILLAGE_CENTER default
                                    zoom={16}
                                    style={{ height: '100%', width: '100%' }}
                                // Default zoom control enabled
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    <MapSearch />
                                    <LocationPicker
                                        position={formData.coords}
                                        onLocationSelect={(coords) => setFormData({ ...formData, coords })}
                                    />
                                </MapContainer>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                            >
                                <Save size={20} />
                                Save Changes
                            </button>
                        </div>

                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <SettingsPageIcon />
                        <p className="mt-4 font-medium">Select an asset to edit or create a new one.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const SettingsPageIcon = () => (
    <svg className="w-24 h-24 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);
