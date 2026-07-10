import React, { useState } from "react";
import { ConnectionState } from "../types";
import {
  Link,
  Copy,
  Check,
  RefreshCw,
  Users,
  Activity,
  AlertTriangle,
  LogOut,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface ConnectionPanelProps {
  connectionState: ConnectionState;
  activePeerId: string | null;
  roomId: string | null;
  peerId: string | null;
  onStartSession: () => void;
  onDisconnect: () => void;
}

export function ConnectionPanel({
  connectionState,
  activePeerId,
  roomId,
  peerId,
  onStartSession,
  onDisconnect,
}: ConnectionPanelProps) {
  const [copied, setCopied] = useState(false);

  // Generate the absolute shareable secure room URL
  const shareUrl =
    typeof window !== "undefined" && roomId
      ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
      : "";

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      {/* 1. DISCONNECTED state (Initial Home Screen) */}
      {connectionState === "disconnected" && (
        <div className="text-center py-6 flex flex-col items-center gap-5">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 text-indigo-600 shadow-sm shadow-indigo-50">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-display font-bold text-slate-800">Create a Secure Transfer Room</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Generate a unique ephemeral cryptographic tunnel. A 256-bit AES symmetric key is minted in your browser and embedded directly inside the URL hash so no server ever sees it.
            </p>
          </div>
          <button
            onClick={onStartSession}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all duration-200 cursor-pointer shadow-xl shadow-indigo-100 hover:scale-[1.01]"
          >
            Create Encrypted Room
          </button>
        </div>
      )}

      {/* 2. GENERATING / CONNECTING STATES */}
      {(connectionState === "generating" || connectionState === "connecting-signaling") && (
        <div className="text-center py-10 flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <div>
            <h3 className="text-sm font-display font-bold text-slate-800">
              {connectionState === "generating"
                ? "Minting 256-bit Symmetric Key..."
                : "Establishing Cryptographic Tunnel..."}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Please wait while the secure pipeline initializes.</p>
          </div>
        </div>
      )}

      {/* 3. WAITING FOR PEER STATE */}
      {connectionState === "waiting-for-peer" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <h3 className="text-sm font-display font-bold text-slate-800">Waiting for Peer</h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Your secure room is active. Share this end-to-end encrypted link with one peer.
              </p>
            </div>
            <button
              onClick={onDisconnect}
              className="text-xs text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 bg-white px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
            >
              <LogOut className="w-3.5 h-3.5" /> Leave Room
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">
                Secure Room Link (Includes AES-256 E2E Key)
              </label>
              <div className="flex items-center gap-2 bg-white border border-slate-200 p-2.5 rounded-lg shadow-inner">
                <span className="text-xs font-mono text-slate-700 truncate flex-1 leading-none select-all font-medium">
                  {shareUrl}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 p-2 rounded-md transition-colors cursor-pointer shrink-0"
                  title="Copy link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-indigo-600" /> : <Copy className="w-3.5 h-3.5 text-indigo-600" />}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono mt-1 font-semibold">
              <span>ROOM ID: <strong className="text-slate-700">{roomId}</strong></span>
              <span className="text-slate-300">•</span>
              <span>YOUR ID: <strong className="text-slate-700">{peerId}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONNECTING WEBRTC HANDSHAKE STATE */}
      {connectionState === "connecting-webrtc" && (
        <div className="text-center py-8 flex flex-col items-center gap-4">
          <div className="relative">
            <Activity className="w-8 h-8 text-indigo-600 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-slate-800">
              Peer Discovered, Negotiating P2P Connection...
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Exchanging encrypted session descriptions and setting up WebRTC channels.
            </p>
          </div>
        </div>
      )}

      {/* 5. CONNECTED STATE */}
      {connectionState === "connected" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <h3 className="text-sm font-display font-bold text-slate-800 flex items-center gap-1.5">
                  Secure Peer Connected
                </h3>
              </div>
              <p className="text-[11px] text-indigo-600 font-mono font-bold mt-0.5">
                Active Peer: {activePeerId}
              </p>
            </div>
            <button
              onClick={onDisconnect}
              className="text-xs text-rose-600 hover:text-rose-700 border border-rose-200 bg-rose-50/50 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
            >
              <LogOut className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Session Room: <strong className="text-slate-800">{roomId}</strong></span>
            </div>
            <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-md font-mono text-[10px]">
              WebRTC Tunnel Established
            </span>
          </div>
        </div>
      )}

      {/* 6. FAILED STATE */}
      {connectionState === "failed" && (
        <div className="text-center py-6 flex flex-col items-center gap-4">
          <div className="bg-rose-50 p-3 rounded-full border border-rose-100 text-rose-600">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-rose-600">Connection Pipeline Failed</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
              We were unable to open the WebRTC signaling or P2P data channel. This can happen behind strict corporate firewalls (symmetric NATs).
            </p>
          </div>
          <button
            onClick={onStartSession}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Session
          </button>
        </div>
      )}
    </div>
  );
}
