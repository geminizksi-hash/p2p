import React from "react";
import { ShieldCheck, Cpu, Lock } from "lucide-react";

export function Header() {
  const isCryptoSupported = typeof window !== "undefined" && !!window.crypto && !!window.crypto.subtle;

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 py-4 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 text-white">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Secure P2P Share
              <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
                v1.0 E2EE
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">
              Architect-Grade Ephemeral Tunnel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Cryptographic telemetry status */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-mono text-slate-600 shadow-sm">
            <Cpu className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            <span className="font-medium">AES-GCM-256:</span>
            {isCryptoSupported ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Active
              </span>
            ) : (
              <span className="text-rose-600 font-bold">Unsupported</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
