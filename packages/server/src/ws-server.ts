import { WebSocket, WebSocketServer as WSServer } from 'ws';
import type { Server } from 'http';
import { v4 as uuid } from 'uuid';

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
  // roomCode -> Set of client IDs
  private rooms: Map<string, Set<string>> = new Map();

  constructor(private httpServer: Server) {}

  initialize() {
    this.wss = new WSServer({ server: this.httpServer });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const token = url.searchParams.get('token');
      const roomCode = url.searchParams.get('room');

      if (!token || !roomCode) {
        ws.close(4001, 'Missing token or room code');
        return;
      }

      // TODO: Validate JWT with Supabase
      const clientId = uuid();
      const client: ConnectedClient = {
        ws,
        userId: 'pending-validation',
        username: 'pending',
        roomCode,
        seatIndex: 0,
      };

      this.clients.set(clientId, client);

      // Join room
      if (!this.rooms.has(roomCode)) {
        this.rooms.set(roomCode, new Set());
      }
      this.rooms.get(roomCode)!.add(clientId);

      // Broadcast join
      this.broadcast(roomCode, {
        type: 'player_joined',
        player: { id: clientId, username: client.username, seatIndex: 0 },
      });

      console.log(`Client ${clientId} connected to room ${roomCode}`);

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
    });

    console.log('WebSocket server initialized');
  }

  private handleMessage(clientId: string, msg: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (msg.type) {
      case 'action':
        // TODO: Validate action, run engine, broadcast state
        console.log(`Action from ${clientId}:`, msg.action);
        break;

      case 'start_game':
        console.log(`Game start requested in room ${client.roomCode}`);
        // TODO: Initialize engine, broadcast game_state
        break;

      case 'chat':
        this.broadcast(client.roomCode, {
          type: 'chat',
          from: clientId,
          username: client.username,
          message: msg.message,
        });
        break;

      case 'webrtc_signal': {
        // Relay signaling to target peer
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
        client.ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
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

    console.log(`Client ${clientId} disconnected from room ${client.roomCode}`);
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
