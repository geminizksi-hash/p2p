import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Enable JSON middleware for receiving signaling POSTs
app.use(express.json());

interface Peer {
  id: string;
  res: express.Response;
}

// In-memory rooms: roomId -> array of peers
const rooms: Map<string, Peer[]> = new Map();

// Helper to broadcast to all other peers in a room
function broadcastToRoom(roomId: string, senderId: string, event: string, data: any) {
  const peers = rooms.get(roomId) || [];
  peers.forEach((peer) => {
    if (peer.id !== senderId) {
      try {
        peer.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        console.error(`[SSE] Error writing to peer ${peer.id}:`, err);
      }
    }
  });
}

// Helper to send a message directly to a specific peer
function sendToPeer(roomId: string, receiverId: string, event: string, data: any): boolean {
  const peers = rooms.get(roomId) || [];
  const target = peers.find((p) => p.id === receiverId);
  if (target) {
    try {
      target.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (err) {
      console.error(`[SSE] Error writing to target peer ${receiverId}:`, err);
    }
  }
  return false;
}

// REST endpoints for signalling state

// 1. Get list of active peer IDs in a room
app.get("/api/signal/rooms/:roomId", (req, res) => {
  const { roomId } = req.params;
  const peers = rooms.get(roomId) || [];
  res.json({ peers: peers.map((p) => p.id) });
});

// 2. Server-Sent Events (SSE) connection endpoint
app.get("/api/signal/connect", (req, res) => {
  const roomId = req.query.roomId as string;
  const peerId = req.query.peerId as string;

  if (!roomId || !peerId) {
    res.status(400).json({ error: "Missing roomId or peerId parameter" });
    return;
  }

  // Set response headers for Server-Sent Events
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  // Write a message immediately to open the stream
  res.write("event: connected\ndata: connected\n\n");

  // Periodically send ping to keep connection alive and bypass proxy timeouts
  const pingInterval = setInterval(() => {
    try {
      res.write("event: ping\ndata: keep-alive\n\n");
    } catch (err) {
      // Stream is probably closed
      clearInterval(pingInterval);
    }
  }, 15000);

  const newPeer: Peer = { id: peerId, res };

  // Add the peer to the designated room
  let peers = rooms.get(roomId) || [];
  // Evict existing stale peer with same ID if any
  peers = peers.filter((p) => p.id !== peerId);
  peers.push(newPeer);
  rooms.set(roomId, peers);

  console.log(`[Signaling] Peer ${peerId} connected to room ${roomId}. Room population: ${peers.length}`);

  // Send an initial welcome containing list of other peers already in this room
  const otherPeers = peers.filter((p) => p.id !== peerId).map((p) => p.id);
  res.write(`event: welcome\ndata: ${JSON.stringify({ peers: otherPeers })}\n\n`);

  // Broadcast to other peers that this new peer has joined
  broadcastToRoom(roomId, peerId, "peer-joined", { peerId });

  // Handle peer disconnection (tab closed, reloaded, or network lost)
  req.on("close", () => {
    clearInterval(pingInterval);
    let currentPeers = rooms.get(roomId) || [];
    currentPeers = currentPeers.filter((p) => p.id !== peerId);
    
    if (currentPeers.length === 0) {
      rooms.delete(roomId);
      console.log(`[Signaling] Room ${roomId} is now empty. Cleaned up.`);
    } else {
      rooms.set(roomId, currentPeers);
      console.log(`[Signaling] Peer ${peerId} left room ${roomId}. Remaining population: ${currentPeers.length}`);
      // Notify other peers in the room that this peer left
      broadcastToRoom(roomId, peerId, "peer-left", { peerId });
    }
  });
});

// 3. Post endpoint to dispatch WebRTC signal payloads (offers, answers, ICE candidates)
app.post("/api/signal/send", (req, res) => {
  const { roomId, senderId, receiverId, signalData } = req.body;

  if (!roomId || !senderId || !receiverId || !signalData) {
    res.status(400).json({ error: "Missing required fields: roomId, senderId, receiverId, signalData" });
    return;
  }

  const delivered = sendToPeer(roomId, receiverId, "signal", {
    senderId,
    signalData,
  });

  if (delivered) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: `Receiver peer ${receiverId} not found in room ${roomId}` });
  }
});

// Express + Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode: Create Vite development server and mount its middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Server] Vite development middleware loaded.");
  } else {
    // Production mode: Serve the built static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[Server] Production static assets routing loaded.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] WebRTC Signaling & Web Server active on port ${PORT}`);
  });
}

startServer();
