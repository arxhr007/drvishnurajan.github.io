import React from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { Trash2, Radio, MapPin, Clock, ExternalLink, Battery } from 'lucide-react';

const STATE_STYLES = {
    critical: { ring: 'border-red-300', chip: 'bg-red-100 text-red-700', fill: '#ef4444', bg: 'bg-red-50' },
    warning: { ring: 'border-amber-300', chip: 'bg-amber-100 text-amber-700', fill: '#f59e0b', bg: 'bg-amber-50/60' },
    normal: { ring: 'border-emerald-200', chip: 'bg-emerald-100 text-emerald-700', fill: '#10b981', bg: 'bg-white' },
    unknown: { ring: 'border-slate-200', chip: 'bg-slate-200 text-slate-600', fill: '#94a3b8', bg: 'bg-slate-50' }
};

const agoLabel = (min) => {
    if (min === null || min === undefined) return 'never';
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    if (min < 48 * 60) return `${Math.round(min / 60)} h ago`;
    return `${Math.round(min / 1440)} d ago`;
};

/** Tank-style card for one LoRaWAN bin (shared by Waste Management and Live Monitoring). */
export const WasteBinCard = ({ bin, compact = false, onClick }) => {
    const style = STATE_STYLES[bin.state] || STATE_STYLES.unknown;
    const fill = bin.fillPct ?? 0;
    const hasLevel = bin.fillPct !== null && bin.fillPct !== undefined;

    return (
        <div
            onClick={onClick ? () => onClick(bin) : undefined}
            className={`rounded-xl border ${style.ring} ${style.bg} p-4 flex gap-4 ${onClick ? 'cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5' : ''} ${bin.online ? '' : 'opacity-80'}`}
            title={`${bin.label} · ${bin.source}`}
        >
            {/* Tank gauge */}
            <div className="relative w-14 shrink-0 rounded-lg border-2 border-slate-300 bg-slate-100 overflow-hidden" style={{ height: compact ? 88 : 120 }}>
                <div className="absolute inset-x-0 bottom-0 transition-all duration-700" style={{ height: `${hasLevel ? fill : 0}%`, backgroundColor: style.fill, opacity: 0.85 }} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-sm font-black ${fill > 55 && hasLevel ? 'text-white drop-shadow' : 'text-slate-700'}`}>{hasLevel ? `${Math.round(fill)}%` : '—'}</span>
                </div>
                {[25, 50, 75].map((m) => <div key={m} className="absolute left-0 w-2 border-t border-slate-400/60" style={{ bottom: `${m}%` }} />)}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5"><Trash2 size={14} className="text-amber-600 shrink-0" /> {bin.name}</p>
                        <p className="text-[11px] text-slate-500 truncate font-mono">{bin.label}{bin.zoneName ? <span className="font-sans"> · {bin.zoneName}</span> : ''}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${style.chip}`}>
                        {bin.state === 'unknown' ? 'No data' : bin.state}
                    </span>
                </div>

                <p className="text-xs text-slate-600 mt-1">{bin.stateLabel}{bin.status ? <span className="text-slate-400"> · node says "{bin.status}"</span> : null}</p>

                {!compact && bin.sparkline?.length > 1 && (
                    <div className="h-10 mt-2 -mx-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={bin.sparkline} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                                <YAxis hide domain={[0, 100]} />
                                <Area type="monotone" dataKey="v" stroke={style.fill} fill={style.fill} fillOpacity={0.2} strokeWidth={2} dot={false} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    <span className={`inline-flex items-center gap-1 ${bin.online ? 'text-emerald-600' : 'text-slate-400'}`}><Radio size={10} /> {bin.online ? 'LoRaWAN online' : 'offline'}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={10} /> {agoLabel(bin.lastSeenAgoMin)}</span>
                    {bin.hoursToFull !== null && bin.hoursToFull !== undefined && bin.state !== 'critical' && (
                        <span>full in ~{bin.hoursToFull < 1 ? `${Math.round(bin.hoursToFull * 60)} min` : `${bin.hoursToFull.toFixed(1)} h`}</span>
                    )}
                    {bin.batteryPct !== null && bin.batteryPct !== undefined && <span className="inline-flex items-center gap-1"><Battery size={10} /> {Math.round(bin.batteryPct)}%</span>}
                    {bin.coords && (
                        <span className="inline-flex items-center gap-1" title={bin.coordsSource === 'device' ? 'Node GPS' : bin.coordsSource === 'zone' ? 'Placed at its block (node GPS outside the site)' : 'Site centre'}>
                            <MapPin size={10} /> {bin.coordsSource === 'device' ? 'GPS' : bin.coordsSource === 'zone' ? 'block' : 'site'}
                        </span>
                    )}
                    {bin.deviceUrl && !compact && (
                        <a href={bin.deviceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-blue-600 hover:underline"><ExternalLink size={10} /> Ubidots</a>
                    )}
                </div>
            </div>
        </div>
    );
};
