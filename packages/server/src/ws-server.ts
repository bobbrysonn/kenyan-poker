import { WebSocket, WebSocketServer as WSServer } from 'ws';
import type { Server } from 'http';
import { v4 as uuid } from 'uuid';
import { validateToken } from './db.js';
import { getRoomPlayers } from './rooms.js';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  username: string;
  roomCode: string;
  seatIndex: number;
}

export class WebSocketServer {
  private wss: WSServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private rooms: Map<string, Set<string>> = new Map();

  constructor(private httpServer: Server) {}

  initialize() {
    this.wss = new WSServer({ server: this.httpServer });

    this.wss.on('connection', async (ws, req) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const token = url.searchParams.get('token');
      const roomCode = url.searchParams.get('room');

      if (!token || !roomCode) {
        ws.close(4001, 'Missing token or room code');
        return;
      }

      // Validate JWT
      const user = await validateToken(token);
      if (!user) {
        ws.close(4002, 'Invalid or expired token');
        return;
      }

      // Check player is in the room
      const players = await getRoomPlayers(roomCode);
      const playerInRoom = players.find((p) => p.playerId === user.userId);
      if (!playerInRoom) {
        ws.close(4003, 'Not a member of this room');
        return;
      }

      const clientId = uuid();
      const client: ConnectedClient = {
        ws,
        userId: user.userId,
        username: user.username,
        roomCode,
        seatIndex: playerInRoom.seatIndex,
      };

      this.clients.set(clientId, client);

      // Join room
      if (!this.rooms.has(roomCode)) {
        this.rooms.set(roomCode, new Set());
      }
      this.rooms.get(roomCode)!.add(clientId);

      // Broadcast join to all room members
      this.broadcast(roomCode, {
        type: 'player_joined',
        player: {
          id: client.userId,
          username: client.username,
          seatIndex: client.seatIndex,
        },
      });

      // Send current player list to the new client
      const allPlayers = await getRoomPlayers(roomCode);
      ws.send(JSON.stringify({
        type: 'room_state',
        players: allPlayers,
      }));

      console.log(`${client.username} connected to room ${roomCode}`);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(clientId, msg);
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', () => {
        this.handleDisconnect(clientId);
      });
    });

    console.log('WebSocket server initialized with JWT validation');
  }

  private handleMessage(clientId: string, msg: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (msg.type) {
      case 'action':
        console.log(`Action from ${client.username}:`, msg.action?.kind);
        // TODO: Validate action, run engine, broadcast state
        break;

      case 'start_game':
        console.log(`${client.username} requested game start in room ${client.roomCode}`);
        // TODO: Initialize engine, broadcast game_state
        break;

      case 'chat':
        this.broadcast(client.roomCode, {
          type: 'chat',
          from: client.userId,
          username: client.username,
          message: msg.message,
        });
        break;

      case 'webrtc_signal': {
        const target = [...this.clients.entries()].find(
          ([, c]) => c.userId === msg.to && c.roomCode === client.roomCode
        );
        if (target) {
          target[1].ws.send(JSON.stringify({
            type: 'webrtc_signal',
            from: client.userId,
            signal: msg.signal,
          }));
        }
        break;
      }

      default:
        client.ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${msg.type}`,
        }));
    }
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
      type: 'player_left',
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
