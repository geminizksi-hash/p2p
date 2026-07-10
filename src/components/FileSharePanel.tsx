import React, { useState, useRef } from "react";
import { TransferProgress } from "../types";
import {
  UploadCloud,
  File as FileIcon,
  CheckCircle,
  AlertTriangle,
  Download,
  ArrowRightLeft,
  Flame,
  Clock,
  Gauge,
} from "lucide-react";

interface FileSharePanelProps {
  transfer: TransferProgress | null;
  onSendFile: (file: File) => void;
  disabled: boolean;
}

export function FileSharePanel({ transfer, onSendFile, disabled }: FileSharePanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format bytes cleanly
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Helper to format remaining seconds cleanly
  const formatTime = (seconds: number) => {
    if (seconds === Infinity || isNaN(seconds)) return "--";
    if (seconds < 1) return "Less than a sec";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const processFile = (file: File) => {
    setErrorMsg(null);
    const limit = 500 * 1024 * 1024; // 500 MB

    if (file.size > limit) {
      setErrorMsg("File size exceeds the 500 MB limit.");
      return;
    }

    onSendFile(file);
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const progressPercent = transfer
    ? Math.min(100, Math.round((transfer.bytesTransferred / transfer.totalBytes) * 100))
    : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-sm font-display font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-indigo-600" /> Secure File Streamer
        </h2>
        <span className="text-[10px] text-slate-500 font-mono font-bold">Max 500 MB</span>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. INITIAL UPLOAD FIELD */}
      {!transfer && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-2xl py-10 px-6 text-center flex flex-col items-center gap-4 cursor-pointer transition-all duration-200 ${
            disabled
              ? "border-slate-100 bg-slate-50/50 cursor-not-allowed opacity-60"
              : dragActive
              ? "border-indigo-500 bg-indigo-50/30"
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
          />
          <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
            <UploadCloud className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-slate-700 font-semibold">
              {disabled ? "Connect with a peer to stream files" : "Drag & drop file or click to select"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Directly piped through local browser sandbox</p>
          </div>
        </div>
      )}

      {/* 2. TRANSFER IN PROGRESS */}
      {transfer && (
        <div className="bg-slate-50/50 border border-slate-200 p-5 rounded-xl flex flex-col gap-4">
          <div className="flex items-start gap-3.5">
            <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl text-indigo-600 shrink-0">
              <FileIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="overflow-hidden flex-1">
              <h3 className="text-xs font-mono font-bold text-slate-800 truncate" title={transfer.fileName}>
                {transfer.fileName}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                Size: {formatBytes(transfer.totalBytes)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-mono font-bold text-indigo-600">{progressPercent}%</span>
              <p className="text-[9px] uppercase font-mono text-slate-500 mt-0.5 tracking-wider font-bold">
                {transfer.status}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-200/50">
            <div
              className="bg-indigo-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          {/* Metrics Grid */}
          {transfer.status !== "completed" && transfer.status !== "failed" && (
            <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-200/80 pt-3">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] uppercase font-mono text-slate-500 flex items-center gap-1 font-bold">
                  <Gauge className="w-3 h-3 text-indigo-500" /> Speed
                </span>
                <span className="text-xs font-mono font-bold text-slate-800">
                  {formatBytes(transfer.speed)}/s
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] uppercase font-mono text-slate-500 flex items-center gap-1 font-bold">
                  <Clock className="w-3 h-3 text-amber-500" /> Rem.
                </span>
                <span className="text-xs font-mono font-bold text-slate-800">
                  {formatTime(transfer.timeLeft)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] uppercase font-mono text-slate-500 flex items-center gap-1 font-bold">
                  <Flame className="w-3 h-3 text-indigo-500 animate-pulse" /> Vol
                </span>
                <span className="text-xs font-mono font-bold text-slate-800">
                  {formatBytes(transfer.bytesTransferred)}
                </span>
              </div>
            </div>
          )}

          {/* Transfer Finished State */}
          {transfer.status === "completed" && (
            <div className="border-t border-slate-200/80 pt-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-emerald-800 font-mono bg-emerald-50 px-3 py-2.5 rounded-lg border border-emerald-100 font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>E2E Decrypted & Verified Successfully!</span>
              </div>

              {/* If we are the receiver, show download action */}
              {transfer.error && transfer.error.startsWith("blob:") ? (
                <a
                  href={transfer.error}
                  download={transfer.fileName}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md"
                >
                  <Download className="w-3.5 h-3.5" /> Download File Now
                </a>
              ) : (
                <p className="text-[11px] text-slate-500 font-mono text-center font-medium">
                  Outgoing peer-to-peer file stream completed.
                </p>
              )}
            </div>
          )}

          {transfer.status === "failed" && (
            <div className="border-t border-slate-200/80 pt-4">
              <div className="flex items-start gap-2 text-xs text-rose-800 font-mono bg-rose-50 p-3 rounded-lg border border-rose-100">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <div>
                  <strong className="block text-rose-800 font-bold">Transfer Interrupted</strong>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">{transfer.error || "Channel reset."}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
