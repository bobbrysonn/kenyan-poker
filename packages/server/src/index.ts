import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "./ws-server.js";
import { createRoom, getRoomByCode, joinRoom } from "./rooms.js";
import { validateToken } from "./db.js";

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Room Endpoints ─────────────────────────────────────────────────────────

// Create a room
app.post("/api/rooms", async (req, res) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader?.startsWith("Bearer ")) {
			res.status(401).json({ error: "Missing authorization token" });
			return;
		}

		const user = await validateToken(authHeader.slice(7));
		if (!user) {
			res.status(401).json({ error: "Invalid token" });
			return;
		}

		const room = await createRoom({
			hostId: user.userId,
			maxPlayers: req.body.maxPlayers,
			cardsPerPlayer: req.body.cardsPerPlayer,
		});

		res.json({ room });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

// Get room info
app.get("/api/rooms/:code", async (req, res) => {
	try {
		const room = await getRoomByCode(req.params.code);
		if (!room) {
			res.status(404).json({ error: "Room not found" });
			return;
		}
		res.json({ room });
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
});

// Join a room
app.post("/api/rooms/:code/join", async (req, res) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader?.startsWith("Bearer ")) {
			res.status(401).json({ error: "Missing authorization token" });
			return;
		}

		const user = await validateToken(authHeader.slice(7));
		if (!user) {
			res.status(401).json({ error: "Invalid token" });
			return;
		}

		const result = await joinRoom({
			roomCode: req.params.code,
			playerId: user.userId,
		});

		res.json({ room: result.room, seatIndex: result.seatIndex });
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
});

// ── Start WebSocket Server ──────────────────────────────────────────────────

const wss = new WebSocketServer(server);
wss.initialize();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
	console.log(`🎴 Kenyan Poker server running on port ${PORT}`);
	console.log(`   REST: http://localhost:${PORT}/api`);
	console.log(`   WS:   ws://localhost:${PORT}/ws`);
});
