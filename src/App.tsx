import React, { useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { SecurityPanel } from "./components/SecurityPanel";
import { FileSharePanel } from "./components/FileSharePanel";
import { ChatPanel } from "./components/ChatPanel";
import { WebRTCConnection, WebRTCState } from "./lib/webrtc";
import { generateEncryptionKey, exportKeyToHex, importKeyFromHex } from "./lib/crypto";
import { Shield, Sparkles, Send, Info, Key, Lock } from "lucide-react";

export default function App() {
  const connectionRef = useRef<WebRTCConnection | null>(null);

  const [sessionState, setSessionState] = useState<WebRTCState>({
    roomId: "",
    peerId: "",
    activePeerId: null,
    connectionState: "disconnected",
    messages: [],
    transfer: null,
    cryptoKey: null,
    keyHex: null,
  });

  // Check URL hash on component mount to support automatic room joining
  useEffect(() => {
    const handleUrlHashOnLoad = async () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith("#")) {
        const params = new URLSearchParams(hash.substring(1));
        const roomParam = params.get("room");
        const keyParam = params.get("key");

        if (roomParam && keyParam) {
          try {
            console.log("[App] Join URL detected. Importing key...");
            // Generate a secure random peer ID
            const peerId = "peer-" + Math.random().toString(36).substring(2, 8);
            const importedKey = await importKeyFromHex(keyParam);
            await startSession(roomParam, peerId, importedKey, keyParam);
          } catch (err) {
            console.error("[App] Failed to auto-join room from URL hash:", err);
            // Evict corrupt URL state
            window.location.hash = "";
          }
        }
      }
    };

    handleUrlHashOnLoad();

    return () => {
      // Cleanup WebRTC and signaling resources on unmount
      connectionRef.current?.disconnect();
    };
  }, []);

  // Helper to start the peer connection & signaling engine
  const startSession = async (room: string, peer: string, keyObj: CryptoKey, keyStr: string) => {
    const conn = new WebRTCConnection(room, peer, keyObj, keyStr, (updates) => {
      // Propagate reactive updates from the WebRTC connection engine straight to React state
      setSessionState((prev) => ({ ...prev, ...updates }));
    });
    
    connectionRef.current = conn;

    setSessionState({
      roomId: room,
      peerId: peer,
      activePeerId: null,
      connectionState: "connecting-signaling",
      messages: [],
      transfer: null,
      cryptoKey: keyObj,
      keyHex: keyStr,
    });

    await conn.connectSignaling();
  };

  // Triggered when creating a new room from scratch
  const handleCreateRoom = async () => {
    setSessionState((prev) => ({ ...prev, connectionState: "generating" }));
    try {
      // Generate secure IDs
      const generatedRoomId = "room-" + Math.random().toString(36).substring(2, 12);
      const generatedPeerId = "peer-" + Math.random().toString(36).substring(2, 8);

      // Generate AES 256-bit symmetric key
      const mintedKey = await generateEncryptionKey();
      const mintedKeyHex = await exportKeyToHex(mintedKey);

      // Set hash params in URL - this ensures it doesn't leave the client!
      window.location.hash = `room=${generatedRoomId}&key=${mintedKeyHex}`;

      await startSession(generatedRoomId, generatedPeerId, mintedKey, mintedKeyHex);
    } catch (err) {
      console.error("[App] Room creation failed:", err);
      setSessionState((prev) => ({ ...prev, connectionState: "failed" }));
    }
  };

  const handleDisconnect = () => {
    console.log("[App] Disconnection triggered by user.");
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    
    // Clear hash parameters in URL to allow clean refreshes
    window.location.hash = "";

    setSessionState({
      roomId: "",
      peerId: "",
      activePeerId: null,
      connectionState: "disconnected",
      messages: [],
      transfer: null,
      cryptoKey: null,
      keyHex: null,
    });
  };

  const handleSendChatMessage = async (text: string) => {
    if (connectionRef.current) {
      await connectionRef.current.sendChatMessage(text);
    }
  };

  const handleSendFile = async (file: File) => {
    if (connectionRef.current) {
      await connectionRef.current.sendFile(file);
    }
  };

  const isConnected = sessionState.connectionState === "connected";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column - Connection Metrics and Cryptographic Information */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <ConnectionPanel
              connectionState={sessionState.connectionState}
              activePeerId={sessionState.activePeerId}
              roomId={sessionState.roomId}
              peerId={sessionState.peerId}
              onStartSession={handleCreateRoom}
              onDisconnect={handleDisconnect}
            />

            {sessionState.keyHex && (
              <SecurityPanel keyHex={sessionState.keyHex} />
            )}
          </div>

          {/* Right Column - File Transfer and Secure Interactive Chat */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {isConnected ? (
              <>
                <FileSharePanel
                  transfer={sessionState.transfer}
                  onSendFile={handleSendFile}
                  disabled={!isConnected}
                />
                
                <ChatPanel
                  messages={sessionState.messages}
                  onSendMessage={handleSendChatMessage}
                  disabled={!isConnected}
                />
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 text-center flex flex-col items-center gap-6 shadow-sm h-full justify-center">
                <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shadow-sm animate-pulse">
                  <Shield className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-base font-display font-bold text-slate-800">
                    Your Encrypted P2P Pipeline is Inactive
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Once a secure connection is negotiated with your peer, this panel will unlock. You will be able to share files up to 500 MB and chat with direct WebRTC speed and zero server footprint.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 text-xs text-slate-600 bg-slate-50 px-5 py-3.5 rounded-xl border border-slate-200 max-w-sm">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-left leading-normal font-mono text-[10px] font-bold">
                      Encrypted End-to-End on Client-Side (AES-256-GCM)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center">
        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
          Secure P2P Share • Ephemeral & Zero Knowledge Network
        </p>
      </footer>
    </div>
  );
}
