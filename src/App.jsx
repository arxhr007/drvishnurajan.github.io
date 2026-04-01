import React, { useState, useEffect } from 'react';
import { MainLayout } from './components/Layout/MainLayout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { FullMapView } from './components/Views/FullMapView';
import { LiveMonitoring } from './components/Views/LiveMonitoring';
import { SystemConfig } from './components/Views/SystemConfig';
import { SoilMonitoring } from './components/Views/SoilMonitoring';
import { EnergyDashboard } from './components/Views/EnergyDashboard';
import { AgricultureDashboard } from './components/Views/AgricultureDashboard';
import { HealthDashboard } from './components/Views/HealthDashboard';
import { WaterSystem } from './components/Views/WaterSystem';
import { SplashScreen } from './components/Layout/SplashScreen';
import { AssetsProvider } from './context/AssetsContext';
import { AuthProvider, useAuth } from './context/AuthContext';


function AppContent() {
    const [activeView, setActiveView] = useState('dashboard');
    const [navParams, setNavParams] = useState(null);
    const [showSplash, setShowSplash] = useState(true);
    const { user } = useAuth();

    // Show splash screen (Login Gate) whenever user is not authenticated
    useEffect(() => {
        if (!user) {
            setShowSplash(true);
            setActiveView('dashboard'); // Reset view on logout
        }
    }, [user]);

    const handleNavigate = (view, params = null) => {
        setActiveView(view);
        setNavParams(params);
    };

    const renderView = () => {
        switch (activeView) {
            case 'dashboard': return <Dashboard onNavigate={handleNavigate} />;
            case 'map': return <FullMapView initialLayer="all" onNavigate={handleNavigate} />;
            case 'live': return <LiveMonitoring initialAssetId={navParams?.assetId} />;
            case 'energy': return <FullMapView initialLayer="energy" onNavigate={handleNavigate} />;
            case 'energy-dashboard': return <EnergyDashboard />;
            case 'agriculture': return <AgricultureDashboard />;
            case 'health': return <HealthDashboard />;
            case 'water': return <WaterSystem />;
            case 'controls': return <FullMapView initialLayer="controls" showControls={true} onNavigate={handleNavigate} />;
            case 'incidents': return <FullMapView initialLayer="incidents" onNavigate={handleNavigate} />;
            case 'soil': return <SoilMonitoring />;
            case 'settings': return <SystemConfig />;
            default: return <Dashboard onNavigate={handleNavigate} />;
        }
    };

    return (
        <>
            {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
            <AssetsProvider>
                <MainLayout activeView={activeView} setActiveView={setActiveView} onNavigate={handleNavigate}>
                    {renderView()}
                </MainLayout>
            </AssetsProvider>
        </>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
