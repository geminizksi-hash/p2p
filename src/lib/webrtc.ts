import { ConnectionState, FileMetadata, ChatMessage, TransferProgress } from "../types";
import {
  encryptText,
  decryptText,
  encryptData,
  decryptData,
  bufToHex,
  hexToBuf,
  bufToBase64,
  base64ToBuf,
} from "./crypto";

// STUN servers for NAT traversal
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

export interface WebRTCState {
  roomId: string;
  peerId: string;
  activePeerId: string | null;
  connectionState: ConnectionState;
  messages: ChatMessage[];
  transfer: TransferProgress | null;
  cryptoKey: CryptoKey | null;
  keyHex: string | null;
}

export class WebRTCConnection {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private sse: EventSource | null = null;
  
  private roomId: string;
  private peerId: string;
  private cryptoKey: CryptoKey | null = null;
  
  // Buffers
  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  private receivedChunks: Map<number, Uint8Array> = new Map();
  private incomingMeta: FileMetadata | null = null;
  
  // Handlers for state propagation to UI
  private onStateChange: (state: Partial<WebRTCState>) => void;
  private state: WebRTCState;

  constructor(
    roomId: string,
    peerId: string,
    cryptoKey: CryptoKey | null,
    keyHex: string | null,
    onStateChange: (state: Partial<WebRTCState>) => void
  ) {
    this.roomId = roomId;
    this.peerId = peerId;
    this.cryptoKey = cryptoKey;
    this.onStateChange = onStateChange;

    this.state = {
      roomId,
      peerId,
      activePeerId: null,
      connectionState: "disconnected",
      messages: [],
      transfer: null,
      cryptoKey,
      keyHex,
    };
  }

  // Update internal state and propagate to listener
  private updateState(updates: Partial<WebRTCState>) {
    this.state = { ...this.state, ...updates };
    this.onStateChange(updates);
  }

  /**
   * Initialize signaling connection via Server-Sent Events (SSE).
   */
  public async connectSignaling() {
    this.updateState({ connectionState: "connecting-signaling" });

    const sseUrl = `/api/signal/connect?roomId=${encodeURIComponent(this.roomId)}&peerId=${encodeURIComponent(this.peerId)}`;
    this.sse = new EventSource(sseUrl);

    this.sse.addEventListener("connected", () => {
      console.log("[Signaling] SSE Connection established.");
      this.updateState({ connectionState: "waiting-for-peer" });
    });

    this.sse.addEventListener("welcome", async (event: any) => {
      const data = JSON.parse(event.data);
      console.log("[Signaling] Welcome received. Other peers in room:", data.peers);
      
      // If there's an active peer already in the room, we act as the initiator
      if (data.peers && data.peers.length > 0) {
        const targetPeerId = data.peers[0]; // Connect to the first peer in room
        this.updateState({ activePeerId: targetPeerId, connectionState: "connecting-webrtc" });
        await this.initiatePeerConnection(targetPeerId);
      }
    });

    this.sse.addEventListener("peer-joined", async (event: any) => {
      const data = JSON.parse(event.data);
      console.log(`[Signaling] New peer joined: ${data.peerId}`);
      
      // Keep track of the active peer. Offerer is usually the newly joined peer, 
      // but let's handle connection initiation gracefully.
      if (!this.state.activePeerId) {
        this.updateState({ activePeerId: data.peerId });
      }
    });

    this.sse.addEventListener("peer-left", (event: any) => {
      const data = JSON.parse(event.data);
      console.log(`[Signaling] Peer left: ${data.peerId}`);
      if (this.state.activePeerId === data.peerId) {
        this.handlePeerDisconnect();
      }
    });

    this.sse.addEventListener("signal", async (event: any) => {
      const data = JSON.parse(event.data);
      const { senderId, signalData } = data;
      console.log(`[Signaling] Received signal from ${senderId}:`, signalData.type || "candidate");

      if (senderId !== this.state.activePeerId) {
        this.updateState({ activePeerId: senderId });
      }

      await this.handleIncomingSignal(senderId, signalData);
    });

    this.sse.onerror = (err) => {
      console.error("[Signaling] SSE Error:", err);
      this.updateState({ connectionState: "failed" });
    };
  }

  /**
   * Instantiates an RTCPeerConnection.
   */
  private createPeerConnection(targetPeerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log("[WebRTC] Local ICE Candidate generated.");
        await this.sendSignal(targetPeerId, {
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state changed:", pc.connectionState);
      switch (pc.connectionState) {
        case "connected":
          this.updateState({ connectionState: "connected" });
          break;
        case "disconnected":
        case "closed":
          this.handlePeerDisconnect();
          break;
        case "failed":
          this.updateState({ connectionState: "failed" });
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE connection state changed:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    this.pc = pc;
    return pc;
  }

  /**
   * Action as the connection Initiator (Offerer).
   */
  private async initiatePeerConnection(targetPeerId: string) {
    console.log(`[WebRTC] Initiating connection with ${targetPeerId}`);
    const pc = this.createPeerConnection(targetPeerId);

    // Create the WebRTC Data Channel (Initiator only)
    const channel = pc.createDataChannel("p2p-secure-channel", {
      ordered: true,
    });
    this.setupDataChannel(channel);

    // Generate local SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Dispatch the offer to peer
    await this.sendSignal(targetPeerId, offer);
  }

  /**
   * Handlers for signaling communication.
   */
  private async sendSignal(receiverId: string, signalData: any) {
    try {
      const response = await fetch("/api/signal/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: this.roomId,
          senderId: this.peerId,
          receiverId,
          signalData,
        }),
      });
      if (!response.ok) {
        console.error("[Signaling] Failed to send signal:", await response.text());
      }
    } catch (err) {
      console.error("[Signaling] Network error during signal send:", err);
    }
  }

  private async handleIncomingSignal(senderId: string, signal: any) {
    // 1. Handle Session Description (Offer / Answer)
    if (signal.type === "offer") {
      console.log("[WebRTC] Received Offer. Creating peer connection...");
      const pc = this.createPeerConnection(senderId);

      // Listen for incoming data channel
      pc.ondatachannel = (event) => {
        console.log("[WebRTC] Received remote Data Channel.");
        this.setupDataChannel(event.channel);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(signal));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Dispatch SDP answer back to sender
      await this.sendSignal(senderId, answer);

      // Flush queued candidates
      await this.flushIceCandidates();

    } else if (signal.type === "answer") {
      console.log("[WebRTC] Received Answer.");
      if (this.pc) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal));
        await this.flushIceCandidates();
      }

    } else if (signal.candidate) {
      // 2. Handle ICE Candidate
      const candidateInit = signal.candidate;
      if (this.pc && this.pc.remoteDescription) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (err) {
          console.error("[WebRTC] Error adding ICE candidate:", err);
        }
      } else {
        // Queue candidates if remote description is not loaded yet
        this.iceCandidateQueue.push(candidateInit);
      }
    }
  }

  private async flushIceCandidates() {
    if (!this.pc) return;
    console.log(`[WebRTC] Flushing ${this.iceCandidateQueue.length} queued ICE candidates.`);
    for (const candidate of this.iceCandidateQueue) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("[WebRTC] Error adding queued ICE candidate:", err);
      }
    }
    this.iceCandidateQueue = [];
  }

  /**
   * DataChannel lifecycle & packet routing.
   */
  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log("[WebRTC] Data channel opened!");
      this.updateState({ connectionState: "connected" });
    };

    channel.onclose = () => {
      console.log("[WebRTC] Data channel closed!");
      this.handlePeerDisconnect();
    };

    channel.onerror = (err) => {
      console.error("[WebRTC] Data channel error:", err);
      this.updateState({ connectionState: "failed" });
    };

    channel.onmessage = async (event) => {
      await this.handleIncomingMessage(event.data);
    };
  }

  private async handleIncomingMessage(rawData: string) {
    try {
      const packet = JSON.parse(rawData);

      switch (packet.type) {
        case "chat": {
          if (!this.cryptoKey) return;
          console.log("[WebRTC] Received encrypted chat packet.");
          const decryptedText = await decryptText(packet.data, this.cryptoKey, packet.iv);
          
          const newMessage: ChatMessage = {
            id: Math.random().toString(36).substring(7),
            sender: "peer",
            text: decryptedText,
            timestamp: Date.now(),
          };

          this.updateState({
            messages: [...this.state.messages, newMessage],
          });
          break;
        }

        case "file-meta": {
          if (!this.cryptoKey) return;
          console.log("[WebRTC] Received encrypted file-meta packet.");
          const decryptedMetaStr = await decryptText(packet.data, this.cryptoKey, packet.iv);
          const meta: FileMetadata = JSON.parse(decryptedMetaStr);

          this.incomingMeta = meta;
          this.receivedChunks.clear();

          this.updateState({
            transfer: {
              fileName: meta.name,
              totalBytes: meta.size,
              bytesTransferred: 0,
              speed: 0,
              elapsedTime: 0,
              timeLeft: 0,
              status: "receiving",
            },
          });
          
          this.startTime = Date.now();
          break;
        }

        case "file-chunk": {
          if (!this.cryptoKey || !this.incomingMeta || !this.state.transfer) return;
          
          const index = packet.index;
          const ivBytes = hexToBuf(packet.iv);
          const encryptedBytes = base64ToBuf(packet.data);

          // Decrypt chunk immediately
          const decryptedArrayBuffer = await decryptData(encryptedBytes, this.cryptoKey, ivBytes);
          this.receivedChunks.set(index, new Uint8Array(decryptedArrayBuffer));

          const bytesLoaded = Array.from(this.receivedChunks.values()).reduce(
            (sum, arr) => sum + arr.byteLength,
            0
          );

          const elapsedSec = (Date.now() - (this.startTime || Date.now())) / 1000 || 0.1;
          const speed = bytesLoaded / elapsedSec; // bytes/sec
          const bytesRemaining = this.incomingMeta.size - bytesLoaded;
          const timeLeft = speed > 0 ? bytesRemaining / speed : 0;

          const isCompleted = this.receivedChunks.size === this.incomingMeta.totalChunks;

          this.updateState({
            transfer: {
              ...this.state.transfer,
              bytesTransferred: bytesLoaded,
              speed,
              elapsedTime: elapsedSec,
              timeLeft,
              status: isCompleted ? "completed" : "receiving",
            },
          });

          if (isCompleted) {
            console.log("[WebRTC] File download complete! Reassembling blob...");
            this.reassembleAndOfferDownload();
          }
          break;
        }
      }
    } catch (err) {
      console.error("[WebRTC] Failed to process incoming data channel message:", err);
    }
  }

  private startTime: number | null = null;

  /**
   * Reassembles received file chunks and initiates browser file download.
   */
  private reassembleAndOfferDownload() {
    if (!this.incomingMeta) return;

    const totalChunks = this.incomingMeta.totalChunks;
    const buffers: Uint8Array[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const chunk = this.receivedChunks.get(i);
      if (chunk) {
        buffers.push(chunk);
      } else {
        console.error(`[WebRTC] Reassembly error: Missing chunk at index ${i}`);
        this.updateState({
          transfer: {
            ...this.state.transfer!,
            status: "failed",
            error: "Reassembly failed. Missing packets.",
          },
        });
        return;
      }
    }

    const fileBlob = new Blob(buffers, { type: this.incomingMeta.mimeType });
    const downloadUrl = URL.createObjectURL(fileBlob);

    // Save download URL to transfer state for the UI button
    this.updateState({
      transfer: {
        ...this.state.transfer!,
        status: "completed",
        speed: 0,
        timeLeft: 0,
        // Hack: temporarily store the URL inside the progress object so components can download
        error: downloadUrl, 
      },
    });

    // Automatically trigger download
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = this.incomingMeta.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Action methods to invoke from the UI components.
   */

  // Send a chat message
  public async sendChatMessage(text: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open" || !this.cryptoKey) {
      throw new Error("P2P connection is not ready or key is missing.");
    }

    // Encrypt locally
    const { encryptedBase64, ivHex } = await encryptText(text, this.cryptoKey);

    // Send packet
    this.dataChannel.send(
      JSON.stringify({
        type: "chat",
        iv: ivHex,
        data: encryptedBase64,
      })
    );

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      sender: "me",
      text,
      timestamp: Date.now(),
    };

    this.updateState({
      messages: [...this.state.messages, newMessage],
    });
  }

  // Send a file in encrypted chunks
  public async sendFile(file: File) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open" || !this.cryptoKey) {
      throw new Error("P2P connection is not ready or key is missing.");
    }

    if (file.size > 500 * 1024 * 1024) {
      throw new Error("File size exceeds 500 MB limit.");
    }

    const CHUNK_SIZE = 16 * 1024; // 16KB chunk size (extremely safe for WebRTC)
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    console.log(`[WebRTC] Starting file transfer: ${file.name} (${file.size} bytes, ${totalChunks} chunks)`);

    this.updateState({
      transfer: {
        fileName: file.name,
        totalBytes: totalSize,
        bytesTransferred: 0,
        speed: 0,
        elapsedTime: 0,
        timeLeft: 0,
        status: "encrypting",
      },
    });

    // 1. Send encrypted metadata
    const metaStr = JSON.stringify({
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      totalChunks,
    });

    const { encryptedBase64: encMeta, ivHex: metaIv } = await encryptText(metaStr, this.cryptoKey);
    
    this.dataChannel.send(
      JSON.stringify({
        type: "file-meta",
        iv: metaIv,
        data: encMeta,
      })
    );

    this.updateState({
      transfer: {
        ...this.state.transfer!,
        status: "sending",
      },
    });

    const transferStartTime = Date.now();
    let offset = 0;
    let chunkIndex = 0;

    // 2. Stream chunks asynchronously with backpressure monitoring
    const readAndSend = async () => {
      while (offset < totalSize) {
        if (!this.dataChannel || this.dataChannel.readyState !== "open") {
          throw new Error("P2P connection lost during file transfer.");
        }

        // BACKPRESSURE FLUSH: Check if browser's RTCDataChannel buffer is full
        // If buffered amount exceeds threshold (e.g. 1MB), delay next chunks to avoid dropping packets.
        if (this.dataChannel.bufferedAmount > 512 * 1024) {
          await new Promise((resolve) => {
            const check = () => {
              if (this.dataChannel && this.dataChannel.bufferedAmount < 64 * 1024) {
                resolve(null);
              } else {
                setTimeout(check, 30);
              }
            };
            check();
          });
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const arrayBuffer = await slice.arrayBuffer();

        // Encrypt the slice independently
        const { encrypted, iv } = await encryptData(arrayBuffer, this.cryptoKey);

        this.dataChannel.send(
          JSON.stringify({
            type: "file-chunk",
            index: chunkIndex,
            iv: bufToHex(iv),
            data: bufToBase64(encrypted),
          })
        );

        offset += arrayBuffer.byteLength;
        chunkIndex++;

        // Calculate speeds & remaining time
        const elapsedSec = (Date.now() - transferStartTime) / 1000 || 0.1;
        const speed = offset / elapsedSec; // bytes/sec
        const timeLeft = (totalSize - offset) / speed;

        this.updateState({
          transfer: {
            fileName: file.name,
            totalBytes: totalSize,
            bytesTransferred: offset,
            speed,
            elapsedTime: elapsedSec,
            timeLeft,
            status: offset >= totalSize ? "completed" : "sending",
          },
        });
      }
      
      console.log("[WebRTC] Secure file transfer completed successfully!");
    };

    try {
      await readAndSend();
    } catch (err: any) {
      console.error("[WebRTC] Secure transfer failed:", err);
      this.updateState({
        transfer: {
          ...this.state.transfer!,
          status: "failed",
          error: err.message || "Transfer error",
        },
      });
    }
  }

  private handlePeerDisconnect() {
    console.log("[WebRTC] Peer connection closed or disconnected.");
    
    // Clear ephemeral connection states
    this.pc?.close();
    this.pc = null;
    this.dataChannel = null;
    this.receivedChunks.clear();
    this.incomingMeta = null;

    this.updateState({
      activePeerId: null,
      connectionState: "waiting-for-peer",
      transfer: null,
    });
  }

  /**
   * Resets connection and disposes SSE streams.
   */
  public disconnect() {
    console.log("[WebRTC] Cleaning up session resources...");
    
    // Dispose signaling stream
    this.sse?.close();
    this.sse = null;

    // Dispose local peer connections
    this.pc?.close();
    this.pc = null;
    this.dataChannel = null;

    // Flush temporary memory state
    this.receivedChunks.clear();
    this.incomingMeta = null;
    this.iceCandidateQueue = [];

    this.updateState({
      activePeerId: null,
      connectionState: "disconnected",
      messages: [],
      transfer: null,
    });
  }
}
