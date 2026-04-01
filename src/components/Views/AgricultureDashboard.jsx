import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Leaf, Thermometer, Droplets, CloudRain, ShieldAlert, Bug } from 'lucide-react';
import { DashboardCard } from '../Shared/DashboardCard';

const StatCard = ({ label, value, unit, icon: Icon, tone = 'green' }) => {
    const tones = {
        green: 'bg-green-50 border-green-100 text-green-600',
        blue: 'bg-blue-50 border-blue-100 text-blue-600',
        amber: 'bg-amber-50 border-amber-100 text-amber-600',
        red: 'bg-red-50 border-red-100 text-red-600'
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
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${tones[tone] || tones.green}`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
};

const diseaseRuleEngine = ({ humidity, temperature, leafWetness, soilMoisture }) => {
    const rules = [
        {
            name: 'Bacterial Leaf Blight',
            condition: humidity > 80 && leafWetness > 70 && temperature > 24,
            risk: 'High',
            bacteria: ['Xanthomonas oryzae', 'Pseudomonas syringae']
        },
        {
            name: 'Soft Rot Risk',
            condition: humidity > 75 && soilMoisture > 65,
            risk: 'Medium',
            bacteria: ['Pectobacterium carotovorum', 'Dickeya spp.']
        },
        {
            name: 'Stem Spot Risk',
            condition: leafWetness > 60 && temperature > 22,
            risk: 'Medium',
            bacteria: ['Clavibacter michiganensis']
        }
    ];

    const matched = rules.find((rule) => rule.condition);
    if (matched) return matched;

    return {
        name: 'No Major Disease Signal',
        risk: 'Low',
        bacteria: ['Low active bacterial growth detected']
    };
};

export const AgricultureDashboard = () => {
    const [factorData] = useState([
        { time: '09:00', humidity: 64, temperature: 25.1, soilMoisture: 53, leafWetness: 48, rainfall: 0.2 },
        { time: '09:10', humidity: 68, temperature: 25.7, soilMoisture: 55, leafWetness: 50, rainfall: 0.0 },
        { time: '09:20', humidity: 72, temperature: 26.2, soilMoisture: 58, leafWetness: 56, rainfall: 0.1 },
        { time: '09:30', humidity: 77, temperature: 26.8, soilMoisture: 62, leafWetness: 63, rainfall: 0.5 },
        { time: '09:40', humidity: 81, temperature: 27.2, soilMoisture: 65, leafWetness: 69, rainfall: 0.9 },
        { time: '09:50', humidity: 84, temperature: 27.5, soilMoisture: 68, leafWetness: 74, rainfall: 1.3 }
    ]);

    const latest = factorData[factorData.length - 1];

    const prediction = useMemo(
        () => diseaseRuleEngine(latest),
        [latest]
    );

    const riskTone = prediction.risk === 'High' ? 'red' : prediction.risk === 'Medium' ? 'amber' : 'green';

    const bacteriaRiskData = [
        { name: 'Xanthomonas', risk: latest.humidity > 80 ? 82 : 44 },
        { name: 'Pectobacterium', risk: latest.soilMoisture > 62 ? 74 : 40 },
        { name: 'Clavibacter', risk: latest.leafWetness > 60 ? 69 : 33 },
        { name: 'Pseudomonas', risk: latest.temperature > 25 ? 65 : 31 }
    ];

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Leaf size={24} className="text-green-600" />
                    Agriculture Dashboard
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Crop disease prediction based on humidity, temperature, moisture, and leaf wetness
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Humidity" value={latest.humidity} unit="%" icon={Droplets} tone="blue" />
                <StatCard label="Temperature" value={latest.temperature.toFixed(1)} unit="deg C" icon={Thermometer} tone="amber" />
                <StatCard label="Soil Moisture" value={latest.soilMoisture} unit="%" icon={CloudRain} tone="green" />
                <StatCard label="Disease Risk" value={prediction.risk} unit="" icon={ShieldAlert} tone={riskTone} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Farm Factors Trend" className="xl:col-span-2">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={factorData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} width={44} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                                <Line type="monotone" dataKey="humidity" stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="soilMoisture" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="leafWetness" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Bacteria Growth Risk">
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bacteriaRiskData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" width={40} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                                <Bar dataKey="risk" fill="#22c55e" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>
            </div>

            <DashboardCard title="Predicted Crop Disease">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1 p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Current Prediction</p>
                        <h3 className="text-lg font-bold text-slate-800 mt-1">{prediction.name}</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Risk level: <span className="font-semibold">{prediction.risk}</span>
                        </p>
                    </div>

                    <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200 bg-white">
                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-2">
                            <Bug size={14} />
                            Possible Bacteria Growth
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {prediction.bacteria.map((name) => (
                                <span
                                    key={name}
                                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100"
                                >
                                    {name}
                                </span>
                            ))}
                        </div>
                        <p className="mt-4 text-xs text-slate-500">
                            Prediction is demo data driven and intended for visualization.
                        </p>
                    </div>
                </div>
            </DashboardCard>
        </div>
    );
};
