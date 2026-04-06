
import React from 'react';
import {
    LayoutDashboard,
    Map as MapIcon,
    Zap,
    Droplets,
    AlertTriangle,
    Settings,
    Activity,
    Leaf,
    HeartPulse
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

const NavItem = ({ icon: Icon, label, active = false, onClick, disabled = false, title = '' }) => (
    <button
        onClick={disabled ? null : onClick}
        title={title}
        className={`
      w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
      ${active
                ? 'bg-blue-600/10 text-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.1)] border border-blue-200'
                : disabled
                    ? 'opacity-50 cursor-not-allowed text-slate-400 bg-slate-50'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 hover:translate-x-1'}
    `}
    >
        <Icon size={20} className={active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'} />
        <span className="font-medium tracking-wide text-sm">{label}</span>
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_8px_currentColor]" />}
        {disabled && (
            <div className="ml-auto">
                <span className="text-[10px] font-bold uppercase bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Locked</span>
            </div>
        )}
    </button>
);

export const Sidebar = ({ activeView = 'dashboard', onNavigate, isOpen, onClose }) => {
    const { isAdmin, user } = useAuth();

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Sidebar Container */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-40
                w-72 lg:w-64 h-full
                bg-white/80 backdrop-blur-xl border-r border-slate-200
                flex flex-col
                transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-6 flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center">
                        <img src={`${import.meta.env.BASE_URL}shr.png`} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 leading-tight">
                            Gram Vista
                        </h1>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Sahrdaya CPS Dashboard</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                    <div className="px-4 pb-2 text-xs font-semibold text-slate-600 uppercase tracking-widest">Main</div>
                    <NavItem icon={LayoutDashboard} label="Dashboard" active={activeView === 'dashboard'} onClick={() => { onNavigate('dashboard'); onClose?.(); }} />
                    <NavItem icon={MapIcon} label="City Map" active={activeView === 'map'} onClick={() => { onNavigate('map'); onClose?.(); }} />
                    <NavItem icon={Activity} label="Live Monitoring" active={activeView === 'live'} onClick={() => { onNavigate('live'); onClose?.(); }} />
                    <NavItem icon={Zap} label="Energy Dashboard" active={activeView === 'energy-dashboard'} onClick={() => { onNavigate('energy-dashboard'); onClose?.(); }} />
                    <NavItem icon={Droplets} label="Water Monitoring" active={activeView === 'water'} onClick={() => { onNavigate('water'); onClose?.(); }} />
                    <NavItem icon={Leaf} label="GRAM-DRISHTI" active={activeView === 'agriculture'} onClick={() => { onNavigate('agriculture'); onClose?.(); }} />
                    <NavItem icon={HeartPulse} label="Health Dashboard" active={activeView === 'health'} onClick={() => { onNavigate('health'); onClose?.(); }} />
                    <NavItem icon={Leaf} label="Soil Monitoring" active={activeView === 'soil'} onClick={() => { onNavigate('soil'); onClose?.(); }} />

                    <div className="mt-8 px-4 pb-2 text-xs font-semibold text-slate-600 uppercase tracking-widest">System</div>
                    <NavItem
                        icon={Settings}
                        label="Configuration"
                        active={activeView === 'settings'}
                        disabled={!isAdmin}
                        title={!isAdmin ? "Admin access needed (sahrdaya.ac.in)" : ""}
                        onClick={() => { if (isAdmin) { onNavigate('settings'); onClose?.(); } }}
                    />
                </nav>
            </aside>
        </>
    );
};
