import React, { useState } from "react";
import { ShieldAlert, Key, HelpCircle, Eye, EyeOff, Info } from "lucide-react";

interface SecurityPanelProps {
  keyHex: string | null;
}

export function SecurityPanel({ keyHex }: SecurityPanelProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-sm font-display font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-indigo-600" /> Cryptographic Ledger
        </h2>
        <div className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono font-bold">
          E2E Secured
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs text-slate-600 leading-relaxed space-y-2.5">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-800">Zero-Knowledge Hash:</strong> The encryption key is appended to your URL using a fragment identifier (after the <code className="text-indigo-600 font-mono font-bold bg-indigo-50/50 px-1.5 py-0.5 rounded">#</code> symbol). Browsers <strong>never</strong> send hash parameters to servers.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-800">P2P Streaming:</strong> Files do not touch any server. They are sliced, encrypted in real-time on your machine using 256-bit AES-GCM, and streamed directly to your peer's browser memory over WebRTC.
            </span>
          </div>
        </div>

        {keyHex && (
          <div className="mt-2 bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 font-semibold flex items-center gap-1.5 font-mono text-[11px]">
                <Key className="w-3.5 h-3.5 text-indigo-500" /> Symmetric Shared Key (AES-256)
              </span>
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title={showKey ? "Hide cryptographic key" : "Show cryptographic key"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="font-mono text-[11px] break-all leading-tight">
              {showKey ? (
                <span className="text-indigo-600 bg-indigo-50/50 px-2.5 py-1.5 rounded block border border-indigo-100 font-bold select-all">
                  {keyHex}
                </span>
              ) : (
                <span className="text-slate-300 tracking-widest bg-slate-100/50 px-2.5 py-1.5 rounded block border border-slate-200 select-none">
                  ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              Any person joining this Room URL automatically imports this key client-side to decrypt your shares. Keep this link confidential.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
