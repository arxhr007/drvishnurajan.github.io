import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, AlertTriangle, ArrowRight, Camera, CameraOff, CheckCircle2, Droplets, Eye, Flame, ImagePlus, MapPinned, Mic, Shield, Sprout, TimerReset, TriangleAlert, Wind, Wifi, Zap } from 'lucide-react';
import { DashboardCard } from '../Shared/DashboardCard';
import { DemoEncryptionNotice } from '../Shared/DemoEncryptionNotice';

const PREDICTION_API_BASE = 'https://aaronthomas123-ice.hf.space';

const CLASS_DESCRIPTIONS = {
    'Apple___Apple_scab': 'A fungal leaf disease with olive to dark lesions that can reduce photosynthesis and fruit quality when humidity stays high.',
    'Apple___Black_rot': 'A fungal infection that causes dark leaf and fruit lesions and can spread during warm, wet weather windows.',
    'Apple___Cedar_apple_rust': 'A rust disease that produces orange spotting and can intensify when alternate host conditions and moisture align.',
    'Apple___healthy': 'No major disease signature detected in the uploaded sample; canopy appears within normal visual range.',
    'Blueberry___healthy': 'No visible disease pattern detected for this sample; foliage appears healthy in current image conditions.',
    'Cherry___healthy': 'No clear disease markers are visible in this image; plant tissue appears normal.',
    'Cherry___Powdery_mildew': 'A powdery fungal growth often seen as pale coating on leaves, usually favored by humid microclimates.',
    'Corn___Cercospora_leaf_spot Gray_leaf_spot': 'A leaf spot complex that creates elongated lesions and can lower vigor under sustained moisture stress.',
    'Corn___Common_rust': 'A rust disease with raised pustules on leaf surfaces, often increasing in moderate temperatures with humidity.',
    'Corn___healthy': 'No visible disease stress identified; current leaf texture and color appear stable.',
    'Corn___Northern_Leaf_Blight': 'A fungal blight marked by long gray-green lesions that can expand rapidly under favorable wet conditions.',
    'Grape___Black_rot': 'A fungal grape disease with dark lesions and fruit rot symptoms, typically associated with warm wet spells.',
    'Grape___Esca_(Black_Measles)': 'A trunk and foliar disease complex causing patterned discoloration and gradual vine stress progression.',
    'Grape___healthy': 'No disease pattern stands out in this sample; grape foliage appears visually healthy.',
    'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)': 'A leaf blight pattern with necrotic spotting that can spread through dense, humid canopy conditions.',
    'Orange___Haunglongbing_(Citrus_greening)': 'A severe citrus decline disease linked to uneven chlorosis and progressive canopy weakening over time.',
    'Peach___Bacterial_spot': 'A bacterial spotting condition that can affect leaves and fruit surfaces, especially after splash and wetness events.',
    'Peach___healthy': 'No significant disease cue is detected from this image; tissue appears within healthy visual bounds.',
    'Pepper,_bell___Bacterial_spot': 'A bacterial spotting pattern with small dark lesions and yellow halos, commonly seen in humid field periods.',
    'Pepper,_bell___healthy': 'No disease-like lesion pattern is strongly indicated in the uploaded pepper leaf image.',
    'Potato___Early_blight': 'A foliar blight with concentric lesion rings that usually appears under alternating warm and humid conditions.',
    'Potato___healthy': 'No dominant disease symptom is detected in this sample; leaf structure appears stable.',
    'Potato___Late_blight': 'A fast-moving blight risk marked by water-soaked to dark lesions and high spread potential in wet weather.',
    'Raspberry___healthy': 'No visible disease expression is identified in this frame; foliage appears healthy.',
    'Soybean___healthy': 'No major disease pattern detected in the current soybean sample image.',
    'Squash___Powdery_mildew': 'A powdery fungal disease that forms white patches on leaves and can suppress plant productivity.',
    'Strawberry___healthy': 'No clear foliar disease markers are visible in this strawberry sample.',
    'Strawberry___Leaf_scorch': 'A leaf scorch pattern showing darkened tissue margins that may expand under persistent stress.',
    'Tomato___Bacterial_spot': 'A bacterial spotting condition seen as dark, water-soaked lesions and foliage specking in humid phases.',
    'Tomato___Early_blight': 'A common tomato blight with concentric rings on older leaves and progressive lower-canopy decline.',
    'Tomato___healthy': 'No strong disease indicators found; tomato leaf features are currently within healthy range.',
    'Tomato___Late_blight': 'A severe tomato blight with rapid lesion expansion in cool-wet windows and high outbreak potential.',
    'Tomato___Leaf_Mold': 'A humidity-driven leaf mold condition with yellowing and underside fungal growth in dense canopy air.',
    'Tomato___Septoria_leaf_spot': 'A spotting disease with many small lesions that can cause major defoliation if unmanaged.',
    'Tomato___Spider_mites Two-spotted_spider_mite': 'A mite-related stress pattern causing stippling and webbing-like injury with progressive leaf damage.',
    'Tomato___Target_Spot': 'A fungal target spot disease with circular lesions that can intensify under warm and moist conditions.',
    'Tomato___Tomato_mosaic_virus': 'A viral mosaic pattern producing mottling and growth irregularity that affects leaf vigor.',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus': 'A viral leaf curl syndrome with yellowing and curling that can significantly reduce plant productivity.',
    'No leaf detected': 'The model could not detect a clear leaf region. Capture a sharper leaf-focused image with better lighting and less background clutter.'
};

const prettifyClassName = (raw = '') => {
    const [cropPart = '', diseasePart = raw] = String(raw).split('___');
    const cropName = cropPart.replace(/,_/g, ' ').replace(/_/g, ' ').trim();
    const diseaseName = diseasePart.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return {
        cropName,
        diseaseName: diseaseName || raw
    };
};

const dashboardTrend = [
    { time: '06:00', health: 76, risk: 34, confidence: 81, alerts: 1 },
    { time: '09:00', health: 78, risk: 38, confidence: 84, alerts: 1 },
    { time: '12:00', health: 74, risk: 52, confidence: 87, alerts: 2 },
    { time: '15:00', health: 71, risk: 61, confidence: 89, alerts: 2 },
    { time: '18:00', health: 73, risk: 58, confidence: 91, alerts: 1 },
    { time: '21:00', health: 75, risk: 49, confidence: 92, alerts: 1 }
];

const vasaHeatmap = [
    { node: 'NW', intensity: 18 },
    { node: 'N', intensity: 41 },
    { node: 'NE', intensity: 22 },
    { node: 'W', intensity: 57 },
    { node: 'Center', intensity: 86 },
    { node: 'E', intensity: 49 },
    { node: 'SW', intensity: 24 },
    { node: 'S', intensity: 35 },
    { node: 'SE', intensity: 19 }
];

const fusionConfidence = [
    { name: 'Vision', value: 0.78, fill: '#2563eb' },
    { name: 'Environment', value: 0.82, fill: '#16a34a' },
    { name: 'Plant Response', value: 0.88, fill: '#f59e0b' },
    { name: 'Fusion', value: 0.96, fill: '#7c3aed' }
];

const triModalEngine = [
    {
        title: 'Environment',
        icon: Wind,
        score: '82%',
        tone: 'green',
        note: 'Humidity, leaf wetness, and temperature are in risk range.'
    },
    {
        title: 'Plant Response',
        icon: Activity,
        score: '88%',
        tone: 'amber',
        note: 'VOC and bio-response signals are increasing.'
    },
    {
        title: 'Fusion Decision',
        icon: Zap,
        score: '96%',
        tone: 'violet',
        note: 'Signals align, so the dashboard shows a strong alert.'
    }
];

const fieldNodes = [
    { label: 'ESP32 Node', value: 'Online', tone: 'green' },
    { label: 'MQTT Link', value: 'Stable', tone: 'blue' },
    { label: 'VASA Array', value: 'Active', tone: 'violet' },
    { label: 'Database Sync', value: 'Healthy', tone: 'cyan' }
];

const sensorStatus = [
    { label: 'Temperature & Humidity', value: 'Stable', detail: 'Fungal window monitored', icon: Wind },
    { label: 'Soil Moisture', value: 'Moderate', detail: 'No water stress spike', icon: Droplets },
    { label: 'Leaf Wetness', value: 'Rising', detail: 'Early morning moisture detected', icon: Activity },
    { label: 'VOC + Bio Response', value: 'Alerting', detail: 'Plant response increasing', icon: Eye }
];

const activeAlerts = [
    {
        title: 'High disease risk in central plots',
        time: '10 min ago',
        severity: 'Critical',
        note: 'Humidity and leaf wetness suggest a 72-hour outbreak window.'
    },
    {
        title: 'VASA acoustic cluster detected',
        time: '18 min ago',
        severity: 'Warning',
        note: 'Source localized near Center node with strong AE intensity.'
    },
    {
        title: 'Preventive action recommended',
        time: '32 min ago',
        severity: 'Advisory',
        note: 'Reduce irrigation tonight and inspect affected zones tomorrow morning.'
    }
];

const recommendedActions = [
    'Reduce irrigation for the next night cycle.',
    'Inspect the central field block for early visual lesions.',
    'Check leaf underside for wetness and discolouration.',
    'Watch the VASA center heat zone for new acoustic spikes.'
];

const quickFacts = [
    { label: 'Forecast Window', value: '72 hrs' },
    { label: 'VASA Coverage', value: 'Village wide' },
    { label: 'Update Cycle', value: '15 min' },
    { label: 'Fusion Confidence', value: '96%' }
];

const StatCard = ({ label, value, unit, icon: Icon, tone = 'blue', subtext }) => {
    const tones = {
        blue: 'bg-blue-50 border-blue-100 text-blue-600',
        green: 'bg-green-50 border-green-100 text-green-600',
        amber: 'bg-amber-50 border-amber-100 text-amber-600',
        violet: 'bg-violet-50 border-violet-100 text-violet-600',
        cyan: 'bg-cyan-50 border-cyan-100 text-cyan-600',
        rose: 'bg-rose-50 border-rose-100 text-rose-600'
    };

    return (
        <div className="bg-white/85 backdrop-blur-md border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                    <div className="mt-1 flex items-baseline gap-1 flex-wrap">
                        <span className="text-2xl font-bold text-slate-800">{value}</span>
                        {unit ? <span className="text-sm text-slate-500">{unit}</span> : null}
                    </div>
                    {subtext ? <p className="mt-1 text-xs text-slate-500">{subtext}</p> : null}
                </div>
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${tones[tone] || tones.blue}`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
};

const badgeStyles = {
    Critical: 'bg-red-100 text-red-700 border-red-200',
    Warning: 'bg-amber-100 text-amber-700 border-amber-200',
    Advisory: 'bg-blue-100 text-blue-700 border-blue-200'
};

const toneStyles = {
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    green: 'bg-green-50 border-green-100 text-green-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    violet: 'bg-violet-50 border-violet-100 text-violet-600'
};

export const AgricultureDashboard = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const previewUrlRef = useRef('');

    const [uploadedLeafFile, setUploadedLeafFile] = useState(null);
    const [uploadedLeafName, setUploadedLeafName] = useState('No leaf image uploaded yet');
    const [isPredictingLeaf, setIsPredictingLeaf] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isCameraStarting, setIsCameraStarting] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [capturedPreview, setCapturedPreview] = useState('');
    const [predictionError, setPredictionError] = useState('');
    const [predictionResult, setPredictionResult] = useState(null);

    const latest = dashboardTrend[dashboardTrend.length - 1];
    const avgRisk = useMemo(() => dashboardTrend.reduce((sum, point) => sum + point.risk, 0) / dashboardTrend.length, []);
    const peakNode = useMemo(() => vasaHeatmap.reduce((max, item) => (item.intensity > max.intensity ? item : max), vasaHeatmap[0]), []);

    const handleLeafUpload = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadedLeafFile(file);
            setUploadedLeafName(file.name);
            setCapturedPreview('');
            setPredictionError('');
            setPredictionResult(null);
        }
    };

    const clearCameraStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    useEffect(() => {
        if (!isCameraOpen) {
            clearCameraStream();
            return undefined;
        }

        let isMounted = true;
        setCameraError('');
        setIsCameraStarting(true);

        const startCamera = async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('Camera access is not supported in this browser.');
                }

                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
                if (!isMounted) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
            } catch (error) {
                if (isMounted) {
                    setCameraError(error?.message || 'Unable to open camera.');
                    setIsCameraOpen(false);
                }
            } finally {
                if (isMounted) {
                    setIsCameraStarting(false);
                }
            }
        };

        startCamera();

        return () => {
            isMounted = false;
            clearCameraStream();
        };
    }, [isCameraOpen]);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
            clearCameraStream();
        };
    }, []);

    const openCamera = () => {
        setPredictionError('');
        setCameraError('');
        setIsCameraOpen(true);
    };

    const closeCamera = () => {
        setIsCameraOpen(false);
        setIsCameraStarting(false);
        setCameraError('');
        clearCameraStream();
    };

    const capturePhoto = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas) {
            setCameraError('Camera is not ready yet.');
            return;
        }

        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, width, height);

        canvas.toBlob((blob) => {
            if (!blob) {
                setCameraError('Could not capture image from camera.');
                return;
            }

            const file = new File([blob], `leaf-capture-${Date.now()}.png`, { type: 'image/png' });
            const nextPreviewUrl = URL.createObjectURL(blob);

            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
            previewUrlRef.current = nextPreviewUrl;

            setUploadedLeafFile(file);
            setUploadedLeafName(file.name);
            setCapturedPreview(nextPreviewUrl);
            setPredictionError('');
            setPredictionResult(null);
            setIsCameraOpen(false);
        }, 'image/png', 0.95);
    };

    const runLeafPrediction = async () => {
        if (!uploadedLeafFile) {
            setPredictionError('Please upload a leaf image first.');
            return;
        }

        if (!uploadedLeafFile.type?.startsWith('image/')) {
            setPredictionError('Please upload a valid image file.');
            return;
        }

        setIsPredictingLeaf(true);
        setPredictionError('');
        setPredictionResult(null);

        try {
            const formData = new FormData();
            formData.append('file', uploadedLeafFile);

            const response = await fetch(`${PREDICTION_API_BASE}/predict`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.detail || 'Prediction failed');
            }

            setPredictionResult(data);
        } catch (error) {
            setPredictionError(error?.message || 'Prediction request failed');
        } finally {
            setIsPredictingLeaf(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Sprout size={24} className="text-green-600" />
                        GRAM-DRISHTI Monitoring Dashboard
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 max-w-4xl">
                        This page shows what the user actually sees while using the system: live risk, VASA localization, crop alert status, sensor state, and recommended actions.
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sky-700 text-xs font-semibold">
                    <Shield size={14} />
                    Field monitoring view
                </div>
            </div>

            <DemoEncryptionNotice />

            <DashboardCard title="Tri-Modal Decision Engine">
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 md:p-5 mb-4">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="max-w-3xl">
                            <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm uppercase tracking-wider">
                                <Eye size={16} />
                                Vision Leaf Checker
                            </div>
                            <p className="mt-2 text-sm text-slate-700">
                                Upload a leaf picture here. The AI/ML checker analyzes the image and returns a disease prediction before the other tri-modal signals are combined.
                            </p>
                        </div>
                        <div className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-sm font-bold text-blue-700">
                            Vision is the first input
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 rounded-xl border border-dashed border-blue-200 bg-white/90 p-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <label className="flex flex-col items-center justify-center gap-3 cursor-pointer text-center min-h-[9rem]">
                                        <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                            <ImagePlus size={22} />
                                        </div>
                                        <div>
                                            <p className="text-base font-semibold text-slate-800">Upload a leaf picture</p>
                                            <p className="text-sm text-slate-500 mt-1">Use a file from your device.</p>
                                        </div>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleLeafUpload} />
                                    </label>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm uppercase tracking-wider">
                                        <Camera size={16} />
                                        Camera capture
                                    </div>
                                    <p className="mt-2 text-sm text-slate-600">Open the camera, take a leaf photo, and upload it instantly.</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={openCamera}
                                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                        >
                                            <Camera size={16} />
                                            Open Camera
                                        </button>
                                        <button
                                            type="button"
                                            onClick={closeCamera}
                                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            <CameraOff size={16} />
                                            Close Camera
                                        </button>
                                    </div>
                                    {cameraError ? (
                                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                            {cameraError}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {isCameraOpen ? (
                                <div className="mt-4 rounded-xl border border-slate-200 bg-black p-3">
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <p className="text-xs uppercase tracking-wider text-slate-200 font-semibold">Live camera preview</p>
                                        <p className="text-xs text-slate-300">{isCameraStarting ? 'Starting camera...' : 'Ready to capture'}</p>
                                    </div>
                                    <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video object-cover" playsInline muted autoPlay />
                                    <div className="mt-3 flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={capturePhoto}
                                            disabled={isCameraStarting}
                                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                                        >
                                            Capture Photo
                                        </button>
                                    </div>
                                    <canvas ref={canvasRef} className="hidden" />
                                </div>
                            ) : null}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Selected file</p>
                                <p className="mt-2 text-sm font-bold text-slate-800 break-words">{uploadedLeafName}</p>
                            </div>

                            {capturedPreview ? (
                                <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 bg-white">
                                    <img src={capturedPreview} alt="Captured leaf preview" className="w-full h-40 object-cover" />
                                </div>
                            ) : null}

                            <div className="mt-4 space-y-3">
                                <button
                                    type="button"
                                    onClick={runLeafPrediction}
                                    disabled={isPredictingLeaf || !uploadedLeafFile}
                                    className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                                        isPredictingLeaf || !uploadedLeafFile
                                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                >
                                    {isPredictingLeaf ? 'Analyzing leaf...' : 'Analyze Leaf'}
                                </button>

                                {predictionError ? (
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                        {predictionError}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {predictionResult?.prediction ? (
                        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            <div className={`rounded-xl p-4 lg:col-span-1 border ${predictionResult.rejected ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                                                {(() => {
                                                    const topClass = predictionResult.prediction.class_name;
                                                    const { cropName, diseaseName } = prettifyClassName(topClass);
                                                    const description = CLASS_DESCRIPTIONS[topClass] || 'Prediction generated by the vision model for this uploaded sample.';

                                                    return (
                                                        <>
                                                            <p className={`text-xs uppercase tracking-wider font-semibold ${predictionResult.rejected ? 'text-amber-700' : 'text-green-700'}`}>
                                                                {predictionResult.rejected ? 'Rejection notice' : 'Top prediction'}
                                                            </p>
                                                            <p className={`mt-2 text-lg font-bold ${predictionResult.rejected ? 'text-amber-900' : 'text-green-900'}`}>
                                                                {diseaseName}
                                                            </p>
                                                            {!predictionResult.rejected && cropName ? (
                                                                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
                                                                    Mainly observed in: {cropName}
                                                                </p>
                                                            ) : null}
                                                            <p className={`mt-1 text-sm ${predictionResult.rejected ? 'text-amber-800' : 'text-green-800'}`}>
                                                                Confidence: {(Number(predictionResult.prediction.confidence || 0) * 100).toFixed(2)}%
                                                            </p>
                                                            <p className={`mt-2 text-sm ${predictionResult.rejected ? 'text-amber-800' : 'text-slate-700'}`}>
                                                                {description}
                                                            </p>
                                                            {predictionResult.rejected ? (
                                                                <p className="mt-2 text-sm text-amber-800">
                                                                    We could not detect a clear leaf in this image. Please upload a clearer leaf photo.
                                                                </p>
                                                            ) : null}
                                                            {predictionResult.reject_reason ? (
                                                                <p className="mt-2 text-xs text-amber-700 font-semibold uppercase tracking-wider">
                                                                    Reject reason: {predictionResult.reject_reason}
                                                                </p>
                                                            ) : null}
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            {!predictionResult.rejected ? (
                                                <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
                                                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Top 3 predictions</p>
                                                    {Array.isArray(predictionResult.top3) && predictionResult.top3.length > 0 ? (
                                                        <div className="mt-3 space-y-2">
                                                            {predictionResult.top3.map((entry, idx) => (
                                                                <div key={`${entry.class_index}-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                                    <span className="text-sm font-medium text-slate-800">{entry.class_name}</span>
                                                                    <span className="text-sm font-bold text-slate-700">{(Number(entry.confidence || 0) * 100).toFixed(2)}%</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                                            No alternative classes returned.
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {triModalEngine.map((item) => (
                        <div key={item.title} className={`rounded-xl border p-4 ${toneStyles[item.tone] || toneStyles.blue}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-wider font-semibold">{item.title}</p>
                                    <p className="mt-1 text-2xl font-bold text-slate-800">{item.score}</p>
                                </div>
                                <div className="w-11 h-11 rounded-xl border border-white/60 bg-white/70 flex items-center justify-center shrink-0 text-slate-700">
                                    <item.icon size={20} />
                                </div>
                            </div>
                            <p className="mt-3 text-sm text-slate-600">{item.note}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">How the user interprets it</p>
                                <p className="mt-1 text-lg font-bold text-slate-800">Signals agree, so the system raises the risk level.</p>
                            </div>
                            <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-700">
                                96% confidence
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-lg bg-white border border-slate-200 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Agreement</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">Vision + Environment + Plant Response</p>
                            </div>
                            <div className="rounded-lg bg-white border border-slate-200 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Meaning</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">The alert is supported by all three inputs.</p>
                            </div>
                            <div className="rounded-lg bg-white border border-slate-200 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Action</p>
                                <p className="mt-1 text-sm font-bold text-slate-800">Inspect central plots and reduce irrigation.</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Current fused result</p>
                        <div className="mt-2 flex items-center gap-2 text-slate-800 font-bold text-lg">
                            <TriangleAlert size={18} className="text-rose-500" />
                            High disease risk
                        </div>
                        <p className="mt-2 text-sm text-slate-600">The combined tri-modal score is elevated and the dashboard shows a visible alert state.</p>
                        <div className="mt-4 h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full w-[96%] rounded-full bg-violet-500" />
                        </div>
                    </div>
                </div>
            </DashboardCard>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Village Health Score" value={latest.health} unit="/100" icon={CheckCircle2} tone="green" subtext="Composite field state" />
                <StatCard label="Disease Risk" value={latest.risk} unit="/100" icon={TriangleAlert} tone="rose" subtext="72-hour risk forecast" />
                <StatCard label="Fusion Confidence" value={latest.confidence} unit="%" icon={Zap} tone="violet" subtext="Vision + environment + plant response" />
                <StatCard label="Alerts Active" value={latest.alerts} unit="now" icon={AlertTriangle} tone="amber" subtext="Current visible alerts" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Live Trend and Risk">
                    <div className="h-72 min-h-[18rem]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dashboardTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} axisLine={false} width={40} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                                <Line type="monotone" dataKey="health" name="Health Score" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="risk" name="Risk" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="confidence" name="Confidence" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Tri-Modal Confidence">
                    <div className="h-72 min-h-[18rem]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={fusionConfidence} dataKey="value" nameKey="name" innerRadius={45} outerRadius={82} paddingAngle={2}>
                                    {fusionConfidence.map((entry) => (
                                        <Cell key={entry.name} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>

                <DashboardCard title="Quick Facts">
                    <div className="grid grid-cols-2 gap-3">
                        {quickFacts.map((item) => (
                            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{item.label}</p>
                                <p className="mt-1 text-lg font-bold text-slate-800">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="VASA Heatmap and Acoustic Alerts" className="xl:col-span-2">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 h-72 min-h-[18rem]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vasaHeatmap}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="node" tick={{ fontSize: 11 }} stroke="#64748b" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="#64748b" width={40} />
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: 12 }} />
                                    <Bar dataKey="intensity" name="AE Intensity" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Peak node</p>
                            <div className="mt-2 flex items-center gap-2 text-slate-800 font-bold text-lg">
                                <MapPinned size={18} className="text-cyan-600" />
                                {peakNode.node}
                            </div>
                            <p className="mt-2 text-sm text-slate-600">Highest localized acoustic intensity: {peakNode.intensity}%</p>
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold">Farmers see</p>
                                <p className="mt-1 text-sm text-amber-800">A centered risk zone with active VASA localization and field-wide alerting.</p>
                            </div>
                        </div>
                    </div>
                </DashboardCard>

                <DashboardCard title="Sensor State">
                    <div className="space-y-3">
                        {sensorStatus.map((item) => (
                            <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                        <item.icon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                                        <p className="text-xs text-slate-500">{item.detail}</p>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                    <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Status</span>
                                    <span className="text-sm font-bold text-slate-800">{item.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Active Alerts" className="xl:col-span-2">
                    <div className="space-y-3">
                        {activeAlerts.map((alert) => (
                            <div key={alert.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-800">{alert.title}</p>
                                    <p className="mt-1 text-sm text-slate-600">{alert.note}</p>
                                    <p className="mt-1 text-xs text-slate-500">{alert.time}</p>
                                </div>
                                <span className={`inline-flex shrink-0 items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${badgeStyles[alert.severity]}`}>
                                    {alert.severity}
                                </span>
                            </div>
                        ))}
                    </div>
                </DashboardCard>

                <DashboardCard title="Recommended Actions">
                    <div className="space-y-3">
                        {recommendedActions.map((item) => (
                            <div key={item} className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-start gap-2 text-green-800">
                                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                                <p className="text-sm">{item}</p>
                            </div>
                        ))}
                    </div>
                </DashboardCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DashboardCard title="Field Node Status">
                    <div className="grid grid-cols-2 gap-3">
                        {fieldNodes.map((node) => (
                            <div key={node.label} className="rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{node.label}</p>
                                <p className="mt-1 text-lg font-bold text-slate-800">{node.value}</p>
                            </div>
                        ))}
                    </div>
                </DashboardCard>

                <DashboardCard title="System Flow Seen by User" className="xl:col-span-2">
                    <div className="space-y-3 text-sm text-slate-700">
                        <p>1. The field node collects sensor readings and sends them through MQTT every 15 minutes.</p>
                        <p>2. The backend validates the reading, updates the database, and runs the model pipeline.</p>
                        <p>3. The dashboard shows crop risk, VASA acoustic localization, and sensor confidence.</p>
                        <p>4. The user receives clear alert cards and practical recommendations for action.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Current average risk</p>
                                <p className="mt-1 text-xl font-bold text-slate-800">{avgRisk.toFixed(0)}/100</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Latest confidence</p>
                                <p className="mt-1 text-xl font-bold text-slate-800">{latest.confidence}%</p>
                            </div>
                        </div>
                    </div>
                </DashboardCard>
            </div>
        </div>
    );
};
