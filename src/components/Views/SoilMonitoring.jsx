import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Droplets, Thermometer, Wind, Leaf, FlaskConical,
    Play, Pause, RefreshCw, AlertTriangle, CheckCircle2, ArrowDown,
    Wifi, WifiOff, Database, Radio, Trash2
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine
} from 'recharts';
import { DashboardCard } from '../Shared/DashboardCard';
import { DemoEncryptionNotice } from '../Shared/DemoEncryptionNotice';
import { db } from '../../firebase.config';
import { ref, onValue, push, set, remove, query, limitToLast, serverTimestamp } from 'firebase/database';

// ── Trained Linear Regression Coefficients (from Python model) ──────────────
const MODEL_COEFFICIENTS = {
    Nitrogen: 0.1360,
    Phosphorus: 0.0983,
    Potassium: 0.0953,
    Soil_Moisture_NPK: 0.2573,
    Soil_Temperature: -0.2675,
    Soil_Moisture_Capacitive: -0.0290,
    Analog_Moisture_Value: 0.0046,
    Air_Temperature: -0.0995,
    Air_Humidity: 0.1825,
};
const MODEL_INTERCEPT = 2.5551;
const THRESHOLD = 5;

// ── Firebase paths ──────────────────────────────────────────────────────────
const FB_LATEST = 'soil_monitoring/latest';
const FB_HISTORY = 'soil_monitoring/history';

// ── Sensor value ranges ─────────────────────────────────────────────────────
const SENSOR_RANGES = {
    Nitrogen: [10, 80],
    Phosphorus: [10, 60],
    Potassium: [10, 70],
    Soil_Moisture_NPK: [20, 80],
    Soil_Temperature: [15, 40],
    Soil_Moisture_Capacitive: [15, 85],
    Analog_Moisture_Value: [300, 900],
    Air_Temperature: [18, 38],
    Air_Humidity: [30, 90],
};

const MAX_STEP_RATIO = {
    Nitrogen: 0.03,
    Phosphorus: 0.03,
    Potassium: 0.03,
    Soil_Moisture_NPK: 0.035,
    Soil_Temperature: 0.025,
    Soil_Moisture_Capacitive: 0.035,
    Analog_Moisture_Value: 0.03,
    Air_Temperature: 0.025,
    Air_Humidity: 0.03,
};

// ── Helper functions ────────────────────────────────────────────────────────
const rand = (min, max) => Math.round((Math.random() * (max - min) + min) * 10) / 10;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const generateReading = (previous = null) => {
    const r = {};

    for (const [key, [min, max]] of Object.entries(SENSOR_RANGES)) {
        const range = max - min;

        if (!previous || typeof previous[key] !== 'number') {
            r[key] = key === 'Analog_Moisture_Value' ? Math.round(rand(min, max)) : rand(min, max);
            continue;
        }

        const prev = previous[key];
        const target = rand(min, max);
        const maxStep = range * (MAX_STEP_RATIO[key] || 0.03);
        const drift = clamp(target - prev, -maxStep, maxStep);
        const jitter = (Math.random() - 0.5) * (range * 0.005);
        const next = clamp(prev + drift + jitter, min, max);

        r[key] = key === 'Analog_Moisture_Value' ? Math.round(next) : Math.round(next * 10) / 10;
    }

    r.Soil_Moisture_Capacitive = Math.min(85, Math.max(15,
        Math.round((r.Soil_Moisture_NPK + (Math.random() - 0.5) * 6) * 10) / 10
    ));

    return r;
};

const predict = (reading) => {
    let result = MODEL_INTERCEPT;
    for (const [key, coef] of Object.entries(MODEL_COEFFICIENTS)) {
        result += coef * (reading[key] ?? 0);
    }
    return Math.min(80, Math.max(20, Math.round(result * 10) / 10));
};

const classify = (current, ideal) => {
    if (current < ideal - THRESHOLD) return { status: 'TOO LOW', color: 'red', recommendation: 'Irrigation Required' };
    if (current > ideal + THRESHOLD) return { status: 'TOO HIGH', color: 'amber', recommendation: 'Reduce Watering / Improve Drainage' };
    return { status: 'OPTIMAL', color: 'green', recommendation: 'Soil Condition is Good' };
};

const timeLabel = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

// ── Sub-components ──────────────────────────────────────────────────────────

const SensorCard = ({ icon: Icon, label, value, unit, color = 'blue' }) => {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-green-500 to-green-600',
        amber: 'from-amber-500 to-amber-600',
        cyan: 'from-cyan-500 to-cyan-600',
        purple: 'from-purple-500 to-purple-600',
        rose: 'from-rose-500 to-rose-600',
        teal: 'from-teal-500 to-teal-600',
        orange: 'from-orange-500 to-orange-600',
        indigo: 'from-indigo-500 to-indigo-600',
    };
    return (
        <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center shadow-lg`}>
                    <Icon size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider truncate">{label}</p>
                    <p className="text-lg font-bold text-slate-800">{value}<span className="text-xs font-normal text-slate-400 ml-1">{unit}</span></p>
                </div>
            </div>
        </div>
    );
};

const StatusBadge = ({ status, color }) => {
    const styles = {
        red: 'bg-red-100 text-red-700 border-red-200',
        amber: 'bg-amber-100 text-amber-700 border-amber-200',
        green: 'bg-green-100 text-green-700 border-green-200',
    };
    const icons = {
        red: <ArrowDown size={14} />,
        amber: <AlertTriangle size={14} />,
        green: <CheckCircle2 size={14} />,
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${styles[color]}`}>
            {icons[color]} {status}
        </span>
    );
};

// ── Main Component ──────────────────────────────────────────────────────────

export const SoilMonitoring = () => {
    const [reading, setReading] = useState(generateReading);
    const [history, setHistory] = useState([]);
    const [isRunning, setIsRunning] = useState(true);
    const [dataSource, setDataSource] = useState('simulate'); // 'simulate' | 'firebase'
    const [fbConnected, setFbConnected] = useState(false);
    const intervalRef = useRef(null);
    const latestReadingRef = useRef(reading);
    const MAX_HISTORY = 30;

    useEffect(() => {
        latestReadingRef.current = reading;
    }, [reading]);

    // ── Push a reading + prediction to Firebase ─────────────────────────────
    const pushToFirebase = useCallback((sensorData, ideal, current, info) => {
        const entry = {
            ...sensorData,
            ideal_moisture: ideal,
            current_moisture: current,
            status: info.status,
            recommendation: info.recommendation,
            time: timeLabel(),
            timestamp: Date.now(),
        };
        // Write latest reading
        set(ref(db, FB_LATEST), entry).catch(console.error);
        // Push to history
        push(ref(db, FB_HISTORY), entry).catch(console.error);
    }, []);

    // ── Simulated tick ──────────────────────────────────────────────────────
    const tick = useCallback(() => {
        const newReading = generateReading(latestReadingRef.current);
        latestReadingRef.current = newReading;
        const ideal = predict(newReading);
        const current = newReading.Soil_Moisture_NPK;
        const info = classify(current, ideal);
        setReading(newReading);
        setHistory(prev => {
            const next = [...prev, { time: timeLabel(), current, ideal, status: info.status }];
            return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
        });
        // Also push to Firebase so data is persisted
        pushToFirebase(newReading, ideal, current, info);
    }, [pushToFirebase]);

    // ── Simulation interval ─────────────────────────────────────────────────
    useEffect(() => {
        if (dataSource !== 'simulate') return;
        tick();
        if (isRunning) {
            intervalRef.current = setInterval(tick, 5000);
        }
        return () => clearInterval(intervalRef.current);
    }, [isRunning, tick, dataSource]);

    // ── Firebase live listener ──────────────────────────────────────────────
    useEffect(() => {
        if (dataSource !== 'firebase') return;

        // Listen to latest reading
        const latestRef = ref(db, FB_LATEST);
        const unsubLatest = onValue(latestRef, (snap) => {
            const data = snap.val();
            if (data) {
                setReading(data);
                setFbConnected(true);
            }
        }, () => setFbConnected(false));

        // Listen to last N history entries
        const historyQuery = query(ref(db, FB_HISTORY), limitToLast(MAX_HISTORY));
        const unsubHistory = onValue(historyQuery, (snap) => {
            const data = snap.val();
            if (data) {
                const entries = Object.values(data)
                    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
                    .map(e => ({
                        time: e.time || '',
                        current: e.current_moisture ?? e.Soil_Moisture_NPK,
                        ideal: e.ideal_moisture,
                        status: e.status,
                    }));
                setHistory(entries.slice(-MAX_HISTORY));
            }
        });

        return () => { unsubLatest(); unsubHistory(); };
    }, [dataSource]);

    // ── Clear Firebase history ──────────────────────────────────────────────
    const clearHistory = () => {
        remove(ref(db, FB_HISTORY)).catch(console.error);
        remove(ref(db, FB_LATEST)).catch(console.error);
        setHistory([]);
    };

    const ideal = predict(reading);
    const current = reading.Soil_Moisture_NPK ?? reading.current_moisture ?? 0;
    const { status, color, recommendation } = classify(current, ideal);

    // Nutrient bar chart data
    const nutrientData = [
        { name: 'N', value: reading.Nitrogen, fill: '#22c55e' },
        { name: 'P', value: reading.Phosphorus, fill: '#3b82f6' },
        { name: 'K', value: reading.Potassium, fill: '#a855f7' },
    ];

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Leaf size={24} className="text-green-600" />
                        Smart Soil Monitoring
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Linear Regression prediction • {dataSource === 'firebase' ? 'Firebase Realtime' : 'Simulated'} data
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Data Source Toggle */}
                    <div className="flex rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <button
                            onClick={() => setDataSource('simulate')}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all ${dataSource === 'simulate'
                                ? 'bg-blue-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Radio size={14} /> Simulate
                        </button>
                        <button
                            onClick={() => setDataSource('firebase')}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all ${dataSource === 'firebase'
                                ? 'bg-orange-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Database size={14} /> Firebase
                        </button>
                    </div>

                    {/* Firebase status indicator */}
                    {dataSource === 'firebase' && (
                        <span className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium ${fbConnected
                            ? 'bg-green-50 text-green-600 border border-green-200'
                            : 'bg-red-50 text-red-500 border border-red-200'}`}>
                            {fbConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                            {fbConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    )}

                    {/* Simulate controls */}
                    {dataSource === 'simulate' && (
                        <>
                            <button
                                onClick={() => setIsRunning(r => !r)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${isRunning
                                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                    : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'}`}
                            >
                                {isRunning ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Resume</>}
                            </button>
                            <button
                                onClick={tick}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all shadow-sm"
                            >
                                <RefreshCw size={16} /> Sample
                            </button>
                        </>
                    )}

                    {/* Clear history */}
                    <button
                        onClick={clearHistory}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-slate-50 text-slate-400 border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                        title="Clear Firebase history"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <DemoEncryptionNotice />

            {/* Status Banner */}
            <div className={`rounded-2xl border p-5 shadow-lg ${color === 'green'
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                : color === 'red'
                    ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
                    : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
                }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <StatusBadge status={status} color={color} />
                        <div>
                            <p className="text-sm font-semibold text-slate-700">Current: <span className="text-lg">{current}%</span></p>
                            <p className="text-sm text-slate-500">Predicted Ideal: <span className="font-semibold text-slate-700">{ideal}%</span></p>
                        </div>
                    </div>
                    <p className="text-sm font-medium text-slate-600 bg-white/60 rounded-lg px-3 py-2">{recommendation}</p>
                </div>
            </div>

            {/* Sensor Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <SensorCard icon={FlaskConical} label="Nitrogen" value={reading.Nitrogen} unit="mg/kg" color="green" />
                <SensorCard icon={FlaskConical} label="Phosphorus" value={reading.Phosphorus} unit="mg/kg" color="blue" />
                <SensorCard icon={FlaskConical} label="Potassium" value={reading.Potassium} unit="mg/kg" color="purple" />
                <SensorCard icon={Droplets} label="Soil Moisture (NPK)" value={reading.Soil_Moisture_NPK} unit="%" color="cyan" />
                <SensorCard icon={Thermometer} label="Soil Temp" value={reading.Soil_Temperature} unit="°C" color="rose" />
                <SensorCard icon={Droplets} label="Soil Moisture (Cap)" value={reading.Soil_Moisture_Capacitive} unit="%" color="teal" />
                <SensorCard icon={Thermometer} label="Air Temp" value={reading.Air_Temperature} unit="°C" color="amber" />
                <SensorCard icon={Wind} label="Air Humidity" value={reading.Air_Humidity} unit="%" color="indigo" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Moisture History Chart */}
                <DashboardCard title="Moisture History (Current vs Ideal)" className="lg:col-span-2">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorIdeal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                <YAxis domain={[10, 90]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value, name) => [`${value}%`, name === 'current' ? 'Current Moisture' : 'Ideal Moisture']}
                                />
                                <ReferenceLine y={ideal + THRESHOLD} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'High', fontSize: 10, fill: '#f59e0b' }} />
                                <ReferenceLine y={ideal - THRESHOLD} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Low', fontSize: 10, fill: '#ef4444' }} />
                                <Area type="monotone" dataKey="ideal" stroke="#22c55e" strokeWidth={2} fill="url(#colorIdeal)" />
                                <Area type="monotone" dataKey="current" stroke="#3b82f6" strokeWidth={2} fill="url(#colorCurrent)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                {/* NPK Bar Chart */}
                <DashboardCard title="NPK Nutrient Levels">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={nutrientData} barSize={40}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                                    formatter={(value) => [`${value} mg/kg`]}
                                />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                    {nutrientData.map((entry, i) => (
                                        <rect key={i} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>
            </div>

            {/* Model Info + Firebase Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DashboardCard title="Model Information">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Algorithm</p>
                            <p className="text-slate-800 font-semibold mt-1">Linear Regression</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Training Samples</p>
                            <p className="text-slate-800 font-semibold mt-1">640 (80% of 800)</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">R² Score</p>
                            <p className="text-slate-800 font-semibold mt-1">0.9273</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Mean Squared Error</p>
                            <p className="text-slate-800 font-semibold mt-1">3.4828</p>
                        </div>
                    </div>
                    <div className="mt-4 bg-slate-50 rounded-xl p-4">
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">Feature Weights</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            {Object.entries(MODEL_COEFFICIENTS).map(([key, val]) => (
                                <div key={key} className="flex justify-between bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
                                    <span className="text-slate-500 truncate mr-1">{key.replace(/_/g, ' ')}</span>
                                    <span className={`font-mono font-bold ${val >= 0 ? 'text-green-600' : 'text-red-500'}`}>{val >= 0 ? '+' : ''}{val.toFixed(4)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </DashboardCard>

                <DashboardCard title="Firebase Realtime Database">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-orange-50 rounded-xl p-3 col-span-2">
                            <p className="text-orange-600 text-xs font-medium uppercase tracking-wider">Database URL</p>
                            <p className="text-slate-800 font-semibold mt-1 text-xs break-all">cps-sahrdaya-default-rtdb.firebaseio.com</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Data Path</p>
                            <p className="text-slate-800 font-semibold mt-1 text-xs font-mono">soil_monitoring/</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">History Points</p>
                            <p className="text-slate-800 font-semibold mt-1">{history.length} / {MAX_HISTORY}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Current Mode</p>
                            <p className="text-slate-800 font-semibold mt-1">{dataSource === 'firebase' ? '🔴 Firebase Live' : '🔵 Simulated'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Sync Status</p>
                            <p className={`font-semibold mt-1 ${dataSource === 'simulate' ? 'text-blue-600' : fbConnected ? 'text-green-600' : 'text-red-500'}`}>
                                {dataSource === 'simulate' ? 'Writing to DB' : fbConnected ? 'Listening' : 'Disconnected'}
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 bg-slate-50 rounded-xl p-4">
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">How it works</p>
                        <ul className="text-xs text-slate-600 space-y-1.5">
                            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">●</span><span><strong>Simulate mode</strong> generates random sensor data every 3s and writes each reading to Firebase.</span></li>
                            <li className="flex items-start gap-2"><span className="text-orange-500 mt-0.5">●</span><span><strong>Firebase mode</strong> listens for real-time data — connect your Arduino or any IoT device that writes to <code className="bg-white px-1 rounded">soil_monitoring/latest</code>.</span></li>
                            <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">●</span><span>All readings are stored in <code className="bg-white px-1 rounded">soil_monitoring/history</code> for analysis.</span></li>
                        </ul>
                    </div>
                </DashboardCard>
            </div>
        </div>
    );
};
