import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from './ws-server.js';

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Room info endpoint (validate before WebSocket connect)
app.get('/api/rooms/:code', (_req, res) => {
  // TODO: fetch from Supabase
  res.json({ exists: false, message: 'Not yet implemented' });
});

// Start WebSocket server
const wss = new WebSocketServer(server);
wss.initialize();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎴 Kenyan Poker server running on port ${PORT}`);
});
