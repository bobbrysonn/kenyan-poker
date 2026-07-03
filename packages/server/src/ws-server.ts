import { WebSocket, WebSocketServer as WSServer } from "ws";
import type { Server } from "http";
import type { PlayerAction } from "@kenyan-poker/engine";
import { v4 as uuid } from "uuid";
import { validateToken } from "./db.js";
import {
	getRoomByCode,
	getRoomPlayers,
	updateRoomStatus,
	saveGameHistory,
} from "./rooms.js";
import * as gameSession from "./game-session.js";

interface ConnectedClient {
	ws: WebSocket;
	userId: string;
	username: string;
	roomCode: string;
	roomId: string;
	isHost: boolean;
	seatIndex: number;
}

export class WebSocketServer {
	private wss: WSServer | null = null;
	private clients: Map<string, ConnectedClient> = new Map();
	private rooms: Map<string, Set<string>> = new Map();

	constructor(private httpServer: Server) {}

	initialize() {
		this.wss = new WSServer({ server: this.httpServer });

		this.wss.on("connection", async (ws, req) => {
			const url = new URL(req.url || "/", "http://localhost");
			const token = url.searchParams.get("token");
			const roomCode = url.searchParams.get("room");

			if (!token || !roomCode) {
				ws.close(4001, "Missing token or room code");
				return;
			}

			// Validate JWT
			const user = await validateToken(token);
			if (!user) {
				ws.close(4002, "Invalid or expired token");
				return;
			}

			// Resolve the room by its join code, then check membership by UUID
			const room = await getRoomByCode(roomCode);
			if (!room) {
				ws.close(4003, "Room not found");
				return;
			}
			const roomPlayers = Array.isArray(room.room_players)
				? room.room_players
				: [];
			const playerInRoom = roomPlayers.find(
				(p: any) => p.player_id === user.userId,
			);
			if (!playerInRoom) {
				ws.close(4003, "Not a member of this room");
				return;
			}

			const clientId = uuid();
			const client: ConnectedClient = {
				ws,
				userId: user.userId,
				username: user.username,
				roomCode: room.code,
				roomId: room.id,
				isHost: room.host_id === user.userId,
				seatIndex: playerInRoom.seat_index,
			};

			this.clients.set(clientId, client);

			// Join room
			if (!this.rooms.has(client.roomCode)) {
				this.rooms.set(client.roomCode, new Set());
			}
			this.rooms.get(client.roomCode)!.add(clientId);

			// Broadcast join to all room members
			this.broadcast(client.roomCode, {
				type: "player_joined",
				player: {
					id: client.userId,
					username: client.username,
					seatIndex: client.seatIndex,
				},
			});

			// Send current player list to the new client
			const allPlayers = await getRoomPlayers(room.id);
			ws.send(
				JSON.stringify({
					type: "room_state",
					hostId: room.host_id,
					players: allPlayers,
				}),
			);

			// If a game is already underway, bring the reconnecting client up to speed
			if (gameSession.hasSession(client.roomCode)) {
				ws.send(
					JSON.stringify({
						type: "game_state",
						state: gameSession.getPublicState(client.roomCode, client.userId),
					}),
				);
			}

			console.log(`${client.username} connected to room ${client.roomCode}`);

			ws.on("message", (data) => {
				try {
					const msg = JSON.parse(data.toString());
					this.handleMessage(clientId, msg);
				} catch {
					ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
				}
			});

			ws.on("close", () => {
				this.handleDisconnect(clientId);
			});

			ws.on("error", () => {
				this.handleDisconnect(clientId);
			});
		});

		console.log("WebSocket server initialized with JWT validation");
	}

	private handleMessage(clientId: string, msg: any) {
		const client = this.clients.get(clientId);
		if (!client) return;

		switch (msg.type) {
			case "action":
				this.handleAction(client, msg.action);
				break;

			case "start_game":
				this.handleStartGame(client);
				break;

			case "chat":
				this.broadcast(client.roomCode, {
					type: "chat",
					from: client.userId,
					username: client.username,
					message: msg.message,
				});
				break;

			case "webrtc_signal": {
				const target = [...this.clients.entries()].find(
					([, c]) => c.userId === msg.to && c.roomCode === client.roomCode,
				);
				if (target) {
					target[1].ws.send(
						JSON.stringify({
							type: "webrtc_signal",
							from: client.userId,
							signal: msg.signal,
						}),
					);
				}
				break;
			}

			default:
				client.ws.send(
					JSON.stringify({
						type: "error",
						message: `Unknown message type: ${msg.type}`,
					}),
				);
		}
	}

	private async handleStartGame(client: ConnectedClient) {
		if (!client.isHost) {
			client.ws.send(
				JSON.stringify({ type: "error", message: "Only the host can start the game" }),
			);
			return;
		}
		if (gameSession.hasSession(client.roomCode)) {
			client.ws.send(
				JSON.stringify({ type: "error", message: "Game already in progress" }),
			);
			return;
		}

		const room = await getRoomByCode(client.roomCode);
		if (!room) return;

		const players = await getRoomPlayers(client.roomId);
		if (players.length < 2) {
			client.ws.send(
				JSON.stringify({
					type: "error",
					message: "Need at least 2 players to start",
				}),
			);
			return;
		}

		const gameState = gameSession.startSession(client.roomCode, client.roomId, players, {
			cardsPerPlayer: room.cards_per_player,
			deckCount: room.deck_count,
		});

		await updateRoomStatus(client.roomId, "playing");

		this.broadcast(client.roomCode, {
			type: "game_started",
			starterPlayerIndex: gameState.currentPlayerIndex,
		});
		this.broadcastGameState(client.roomCode);
		this.armTurnTimer(client.roomCode);

		console.log(`Game started in room ${client.roomCode}`);
	}

	private async handleAction(client: ConnectedClient, action: PlayerAction) {
		const result = gameSession.submitAction(client.roomCode, client.userId, action);

		client.ws.send(
			JSON.stringify({
				type: "action_result",
				success: result.ok,
				message: result.message,
			}),
		);

		if (!result.ok) return;

		this.broadcastGameState(client.roomCode);
		const finished = await this.checkGameOver(client.roomCode);
		if (!finished) {
			this.armTurnTimer(client.roomCode);
		}
	}

	/** Send each connected client its own redacted view of the game state. */
	private broadcastGameState(roomCode: string) {
		const room = this.rooms.get(roomCode);
		if (!room) return;

		for (const clientId of room) {
			const c = this.clients.get(clientId);
			if (!c || c.ws.readyState !== WebSocket.OPEN) continue;
			const state = gameSession.getPublicState(roomCode, c.userId);
			c.ws.send(JSON.stringify({ type: "game_state", state }));
		}
	}

	/** (Re)start the 30s turn timer; on expiry, auto-play for the current player. */
	private armTurnTimer(roomCode: string) {
		gameSession.scheduleTurnTimer(roomCode, async () => {
			const result = gameSession.forceAutoAction(roomCode);
			if (!result.ok) return;

			this.broadcastGameState(roomCode);
			const finished = await this.checkGameOver(roomCode);
			if (!finished) {
				this.armTurnTimer(roomCode);
			}
		});
	}

	/** If the game just ended, persist results and notify clients. Returns true if game over. */
	private async checkGameOver(roomCode: string): Promise<boolean> {
		const results = gameSession.getFinalResults(roomCode);
		if (!results) return false;

		gameSession.clearTurnTimer(roomCode);

		try {
			await saveGameHistory(results);
			await updateRoomStatus(results[0].roomId, "finished");
		} catch (err) {
			console.error("Failed to save game history:", err);
		}

		const winners = [...results]
			.sort((a, b) => a.placement - b.placement)
			.map((r) => {
				const c = [...this.clients.values()].find(
					(cl) => cl.userId === r.playerId && cl.roomCode === roomCode,
				);
				return {
					id: r.playerId,
					username: c?.username ?? "Unknown",
					placement: r.placement,
				};
			});

		this.broadcast(roomCode, { type: "game_over", winners });
		gameSession.endSession(roomCode);
		return true;
	}

	private handleDisconnect(clientId: string) {
		const client = this.clients.get(clientId);
		if (!client) return;

		this.clients.delete(clientId);

		const room = this.rooms.get(client.roomCode);
		if (room) {
			room.delete(clientId);
			if (room.size === 0) {
				this.rooms.delete(client.roomCode);
			}
		}

		this.broadcast(client.roomCode, {
			type: "player_left",
			playerId: client.userId,
		});

		console.log(`${client.username} disconnected from room ${client.roomCode}`);
	}

	private broadcast(roomCode: string, message: object) {
		const room = this.rooms.get(roomCode);
		if (!room) return;

		const data = JSON.stringify(message);
		for (const clientId of room) {
			const client = this.clients.get(clientId);
			if (client && client.ws.readyState === WebSocket.OPEN) {
				client.ws.send(data);
			}
		}
	}
}
