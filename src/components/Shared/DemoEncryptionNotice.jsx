import React from 'react';
import { ShieldCheck, Eye, LockKeyhole } from 'lucide-react';

export const DemoEncryptionNotice = () => {
    return (
        <div className="relative overflow-hidden rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-slate-50 to-sky-50 p-4 shadow-sm">
            <div className="pointer-events-none absolute -top-8 right-0 h-28 w-28 rounded-full bg-cyan-300/35 blur-2xl" />
            <div className="pointer-events-none absolute bottom-0 left-16 h-20 w-20 rounded-full bg-sky-300/30 blur-xl" />

            <div className="relative flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-lg bg-cyan-100 text-cyan-700 border border-cyan-200 flex items-center justify-center shrink-0">
                    <ShieldCheck size={16} />
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-cyan-800">Critical Security Layer</p>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <LockKeyhole size={11} />
                            Encryption Active
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                            <Eye size={11} />
                            Link Monitoring Active
                        </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-700">
                        Sensor-to-sensor links use DTLS 1.3 with rotating device certificates, while sensor-to-dashboard traffic
                        is tunneled over TLS 1.3 MQTT/HTTPS. Payloads are signed (Ed25519), encrypted (AES-256-GCM), and protected
                        by anti-replay counters with broker topic ACLs and per-device trust policies.
                    </p>

                </div>
            </div>
        </div>
    );
};