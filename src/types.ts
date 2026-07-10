export interface FileMetadata {
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
}

export interface ChatMessage {
  id: string;
  sender: "me" | "peer";
  text: string;
  timestamp: number;
}

export interface TransferProgress {
  fileName: string;
  totalBytes: number;
  bytesTransferred: number;
  speed: number; // bytes per second
  elapsedTime: number; // in seconds
  timeLeft: number; // in seconds
  status: "idle" | "encrypting" | "sending" | "receiving" | "decrypting" | "completed" | "failed";
  error?: string;
}

export type ConnectionState =
  | "disconnected"
  | "generating"
  | "connecting-signaling"
  | "waiting-for-peer"
  | "connecting-webrtc"
  | "connected"
  | "failed";
