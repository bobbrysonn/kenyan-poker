# Kenyan Poker — Project Specification

> **Version:** 1.0  
> **Status:** In Development — Phase 2 (Infrastructure Complete)  
> **Last Updated:** July 1, 2026  
> **Supabase:** `tmvjhzpniofkbqblvsfm` | **Repo:** [github.com/bobbrysonn/kenyan-poker](https://github.com/bobbrysonn/kenyan-poker)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Game Rules](#2-game-rules)
3. [Architecture](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Monorepo Structure](#5-monorepo-structure)
6. [Data Model](#6-data-model)
7. [Authentication](#7-authentication)
8. [API Design](#8-api-design)
9. [WebSocket Protocol](#9-websocket-protocol)
10. [Room & Lobby System](#10-room--lobby-system)
11. [Friends System](#11-friends-system)
12. [Game State Flow](#12-game-state-flow)
13. [WebRTC Video/Audio](#13-webrtc-videoaudio)
14. [Frontend Component Tree](#14-frontend-component-tree)
15. [UI/UX Design](#15-uiux-design)
16. [Security Considerations](#16-security-considerations)
17. [Deployment](#17-deployment)
18. [Testing Strategy](#18-testing-strategy)
19. [Roadmap](#19-roadmap)

---

## 1. Overview

Kenyan Poker is a multiplayer online card game. It is a shedding-type game (like Crazy Eights or UNO) with a uniquely Kenyan ruleset featuring cumulative bombs, question chains, jump cards, kickback reversals, Ace powers, and a "declare card" mechanic akin to calling "UNO!".

The platform supports:

- User accounts (sign up / login)
- Friend lists and game invitations
- Real-time multiplayer via WebSocket
- Live video and audio chat during games via WebRTC
- Room-based matchmaking with join codes
- Authoritative server (anti-cheat by design)

### Target Audience

Casual card game players, friend groups, and anyone interested in African/Kenyan card games. Target: 2–8 players per game.

---

## 2. Game Rules

The complete formal rules are specified in **[docs/rules.tex](docs/rules.tex)** — a LaTeX document containing:

- 10 sections covering all mechanics
- 9 formal definitions
- 12 numbered rules
- 4 mathematical invariants
- State-machine semantics with formal transition functions
- A termination proof

The executable reference implementation is in **[packages/engine/src/engine.ts](packages/engine/src/engine.ts)** — verified by 52 tests (43 unit + 9 property-based).

### Quick Summary

| Card | Effect |
|------|--------|
| 2, 3 | Bomb — force next player to pick 2 or 3 cards. Cumulative & chainable. |
| Joker | Bomb — worth 5 cards. Legal when color matches top card. |
| 8, Q | Question — must answer with non-special card or pick. Self-answering. |
| J | Jump — skip next player. Chainable. Rejectable with another J. |
| K | Kickback — reverse direction. Odd reverses, even cancels (play again). |
| A (non-♠) | Defensive: stops bombs. Offensive: request suit OR number. |
| A♠ | Dual power. Defensive: stop bomb + request one. Offensive: request suit AND number. |
| Non-special (4–7, 9, 10) | Normal play. Can win with these as last card. |
| "Card!" | Must declare when ≤2 cards with a non-special remain. Penalty: can't win + pick 1. |

---

## 3. Architecture

```
┌──────────────┐     WebSocket      ┌──────────────────┐
│   Client     │◄──────────────────►│   Game Server     │
│  (React SPA) │                    │  (Node.js + WS)   │
│              │                    │                   │
│  ┌────────┐  │                    │  ┌─────────────┐  │
│  │ WebRTC │◄─┼──── peer ─────────┼──│ WebRTC       │  │
│  │ video  │  │    connection      │  │ signaling    │  │
│  └────────┘  │                    │  └─────────────┘  │
│              │                    │                   │
│  ┌────────┐  │      REST          │  ┌─────────────┐  │
│  │Supabase│◄─┼───────────────────►│  │  Supabase    │  │
│  │ Client  │  │   (auth, friends)  │  │  (Auth + DB) │  │
│  └────────┘  │                    │  └─────────────┘  │
└──────────────┘                    └──────────────────┘
```

### Principles

1. **Server-authoritative game state.** The game engine runs on the server. Clients send actions; the server validates, transitions state, and broadcasts.
2. **Thin client.** The client renders state and captures user input. No game logic duplication.
3. **Supabase for everything non-realtime-critical.** Auth, user profiles, friends, and room metadata live in Supabase. Game state streams over WebSocket (lower latency).
4. **WebRTC peer-to-peer.** Video/audio goes direct between clients. The WebSocket server acts only as the signaling channel.

---

## 4. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Monorepo** | Turborepo + pnpm workspaces | Shared packages, parallel builds, caching |
| **Language** | TypeScript (strict mode) | End-to-end type safety |
| **Game Engine** | Custom TS (existing) | Pure functions, already tested |
| **Frontend** | React 19 + Vite 6 | Fast HMR, small bundles, great ecosystem |
| **Styling** | Tailwind CSS v4 | Utility-first, rapid UI development |
| **Backend Server** | Node.js + Express + `ws` | Lightweight, well-understood |
| **Auth** | Supabase Auth | Email/password + Google OAuth |
| **Database** | Supabase PostgreSQL | Managed, real-time, RLS |
| **Real-time** | WebSocket (`ws` library) | Low-latency game state push |
| **Video/Audio** | WebRTC (browser API) | Peer-to-peer, no server media cost |
| **Testing** | Vitest + fast-check | Unit + property-based, already in place |
| **Deployment** | Fly.io / Railway (server), Vercel (client), Supabase (DB) | TBD |

---

## 5. Monorepo Structure

```
kenyan-poker/
├── packages/
│   ├── engine/                  # @kenyan-poker/engine
│   │   ├── src/
│   │   │   ├── types.ts             Card, GameState, PlayerAction types
│   │   │   ├── deck.ts              Create, shuffle, deal, draw
│   │   │   ├── engine.ts            Core game logic & state machine
│   │   │   └── index.ts             Public exports
│   │   ├── __tests__/
│   │   │   ├── engine.test.ts       43 unit tests
│   │   │   └── properties.test.ts   9 property-based tests
│   │   └── package.json
│   │
│   ├── server/                  # @kenyan-poker/server
│   │   ├── src/
│   │   │   ├── index.ts             Entry point: Express + WS bootstrap
│   │   │   ├── ws-server.ts         WebSocket connection management
│   │   │   ├── rooms.ts             Room CRUD, join/leave, lifecycle
│   │   │   ├── game-session.ts      Wraps engine, manages turn loop
│   │   │   ├── auth.ts              Supabase JWT validation middleware
│   │   │   ├── friends.ts           Friend request/accept/reject handlers
│   │   │   ├── webrtc.ts            SDP offer/answer/ICE relay
│   │   │   └── db.ts                Supabase client & query helpers
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   └── client/                  # @kenyan-poker/client
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── ui/               Reusable primitives
│       │   │   │   ├── Card.tsx          CSS playing card
│       │   │   │   ├── Button.tsx
│       │   │   │   ├── Modal.tsx
│       │   │   │   └── Avatar.tsx
│       │   │   ├── auth/
│       │   │   │   ├── LoginForm.tsx
│       │   │   │   ├── SignUpForm.tsx
│       │   │   │   └── AuthGuard.tsx
│       │   │   ├── lobby/
│       │   │   │   ├── Lobby.tsx         Dashboard with rooms + friends
│       │   │   │   ├── CreateRoom.tsx
│       │   │   │   ├── JoinRoom.tsx
│       │   │   │   └── FriendsList.tsx
│       │   │   ├── game/
│       │   │   │   ├── GameBoard.tsx     Main game view
│       │   │   │   ├── TopCard.tsx       Current play pile
│       │   │   │   ├── PlayerHand.tsx    Your cards (with actions)
│       │   │   │   ├── OpponentsView.tsx Other players (hidden cards)
│       │   │   │   ├── ActionBar.tsx     Bomb/question/ace prompts
│       │   │   │   ├── DeclareCard.tsx   "CARD!" button
│       │   │   │   ├── DirectionIndicator.tsx
│       │   │   │   └── WinnerOverlay.tsx
│       │   │   └── video/
│       │   │       ├── VideoChat.tsx     WebRTC video grid
│       │   │       └── VideoTile.tsx     Single participant tile
│       │   ├── hooks/
│       │   │   ├── useAuth.ts        Supabase session
│       │   │   ├── useGame.ts        WebSocket → game state
│       │   │   ├── useFriends.ts     Friend list CRUD
│       │   │   ├── useWebRTC.ts      Peer connection lifecycle
│       │   │   └── useRooms.ts       Room list + create/join
│       │   ├── lib/
│       │   │   ├── supabase.ts       Supabase client instance
│       │   │   ├── ws.ts             WebSocket client wrapper
│       │   │   └── api.ts            REST helpers
│       │   ├── types/
│       │   │   └── index.ts          Client-specific types
│       │   └── styles/
│       │       └── index.css         Tailwind + card styles
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
│
├── docs/
│   └── rules.tex                 LaTeX formal rulebook
├── turbo.json
├── package.json                  Root workspace
├── pnpm-workspace.yaml
├── tsconfig.json                 Base config
└── .gitignore
```

---

## 6. Data Model

### Supabase PostgreSQL Tables

#### `profiles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid PK` | References `auth.users.id` |
| `username` | `text UNIQUE NOT NULL` | Display name |
| `avatar_url` | `text` | Profile picture URL |
| `status` | `text DEFAULT 'offline'` | online / offline / in_game |
| `created_at` | `timestamptz` | |

#### `friendships`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid PK` | |
| `requester_id` | `uuid FK → profiles.id` | Who sent the request |
| `addressee_id` | `uuid FK → profiles.id` | Who receives it |
| `status` | `text DEFAULT 'pending'` | pending / accepted / declined |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Constraint:** `requester_id ≠ addressee_id`. Unique on `(requester_id, addressee_id)` (no duplicate requests).

#### `game_rooms`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid PK` | |
| `code` | `text UNIQUE NOT NULL` | 6-char join code (e.g., "XK4MP9") |
| `host_id` | `uuid FK → profiles.id` | Room creator |
| `status` | `text DEFAULT 'waiting'` | waiting / playing / finished |
| `max_players` | `int DEFAULT 4` | |
| `cards_per_player` | `int DEFAULT 5` | |
| `deck_count` | `int` | Auto-calculated if null |
| `created_at` | `timestamptz` | |
| `started_at` | `timestamptz` | |

#### `room_players`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid PK` | |
| `room_id` | `uuid FK → game_rooms.id` | |
| `player_id` | `uuid FK → profiles.id` | |
| `seat_index` | `int` | Position at table (0–N) |
| `joined_at` | `timestamptz` | |

**Constraint:** Unique on `(room_id, player_id)`.

#### `game_history`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid PK` | |
| `room_id` | `uuid FK → game_rooms.id` | |
| `player_id` | `uuid FK → profiles.id` | |
| `placement` | `int` | 1st, 2nd, 3rd, etc. |
| `turns_played` | `int` | |
| `cards_remaining` | `int` | At game end |
| `created_at` | `timestamptz` | |

### Row-Level Security (RLS)

- **profiles**: Read by anyone, update only by self.
- **friendships**: Insert by requester. Read by both parties. Update by addressee (accept/reject).
- **game_rooms**: Read by room players. Update by host or server.
- **room_players**: Read by room members. Insert by any authenticated user joining a room.
- **game_history**: Read by the player. Insert by server after game end.

---

## 7. Authentication

### Flow

```
1. User visits site → sees Login / Sign Up
2. Authenticates via Supabase Auth (email/password or Google OAuth)
3. Supabase returns JWT + refresh token
4. Client stores session in @supabase/ssr cookies
5. All REST calls to Supabase include the JWT (handled by SDK)
6. WebSocket connection includes JWT in initial handshake
7. Server validates JWT against Supabase on connection
```

### JWT Validation (Server-side)

```typescript
// packages/server/src/auth.ts
import { createClient } from '@supabase/supabase-js';

export async function validateToken(jwt: string): Promise<{ userId: string; username: string } | null> {
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();
    
  return { userId: user.id, username: profile?.username ?? 'Unknown' };
}
```

### Protected Routes (Client-side)

- `/login`, `/signup` — public
- `/lobby`, `/game/:roomCode` — require auth (redirect to `/login` if unauthenticated)
- `AuthGuard` component wraps protected routes

---

## 8. API Design

### REST Endpoints (via Supabase client — no custom REST server needed)

All non-game-state data is accessed directly via the Supabase JavaScript client from the browser, protected by RLS:

| Operation | Method | Table | RLS Policy |
|-----------|--------|-------|------------|
| Get my profile | `select` | `profiles` | Self-read |
| Update profile | `update` | `profiles` | Self-update |
| Search users | `select` | `profiles` | Authenticated read |
| Send friend request | `insert` | `friendships` | Requester must be self |
| Accept/reject friend | `update` | `friendships` | Addressee must be self |
| List my friends | `select` | `friendships` | Either party |
| Create room | `insert` | `game_rooms` | Authenticated |
| Join room | `insert` | `room_players` | Authenticated (server validates capacity) |
| Leave room | `delete` | `room_players` | Self |
| List active rooms | `select` | `game_rooms` | Room members |
| Game history | `select` | `game_history` | Self |

### Server REST Endpoints (Express)

Two lightweight endpoints for operations that need server-side logic:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/rooms` | Create room (generates join code, inserts into DB) |
| `GET` | `/api/rooms/:code` | Get room info (validation before WebSocket connect) |

---

## 9. WebSocket Protocol

### Connection

```
ws://localhost:3001/ws?token=<supabase_jwt>&room=<room_code>
```

Server validates JWT, checks player is in room, upgrades connection.

### Message Format

All messages are JSON with a `type` field:

```typescript
type ServerMessage =
  | { type: 'game_state'; state: GameState }
  | { type: 'action_result'; success: boolean; message: string }
  | { type: 'player_joined'; player: { id: string; username: string; seatIndex: number } }
  | { type: 'player_left'; playerId: string }
  | { type: 'game_started'; starterPlayerIndex: number }
  | { type: 'game_over'; winners: { id: string; username: string; placement: number }[] }
  | { type: 'error'; message: string }
  | { type: 'webrtc_signal'; from: string; signal: RTCSignal }
  | { type: 'chat'; from: string; username: string; message: string };

type ClientMessage =
  | { type: 'action'; action: PlayerAction }
  | { type: 'start_game' }
  | { type: 'webrtc_signal'; to: string; signal: RTCSignal }
  | { type: 'chat'; message: string };
```

### Game State Broadcast

The server runs the engine and broadcasts `game_state` to **all** connected clients after every state change. The client renders this state. Only the current player's hand is fully visible; other players see card counts only.

### Turn Timer

- Each turn has a 30-second timer (configurable).
- If the timer expires, the server auto-plays a "pick" action.
- The client shows a countdown.

---

## 10. Room & Lobby System

### Lifecycle

```
[Lobby] → Create Room → [Waiting Room] → Start Game → [In Game] → Game Over → [Results]
                                          ↑
                                     Join via code
```

### Room Creation

1. Player clicks "Create Room"
2. Server generates a 6-character alphanumeric code (e.g., `XK4MP9`)
3. Room inserted into `game_rooms` with host = creator
4. Creator automatically added to `room_players` at seat 0
5. Creator sees the waiting room with the join code displayed prominently

### Joining a Room

1. Player enters join code (or clicks an invite link)
2. Client fetches room info from `/api/rooms/:code`
3. If room is `waiting` and not full, player is added to `room_players`
4. WebSocket connection established
5. All connected players see `player_joined` message

### Starting the Game

- Only the host can click "Start Game"
- Minimum 2 players required
- Server initializes the engine: `initGame({ playerNames, cardsPerPlayer, deckCount })`
- Server broadcasts `game_started` with full `game_state`
- Players not in the room cannot spectate (v2 feature)

### Leaving / Reconnection

- If a player disconnects mid-game, they have 60 seconds to reconnect
- If they don't reconnect, they forfeit. The server auto-plays "pick" for them.
- A disconnected player's WebRTC streams are removed from the grid.

---

## 11. Friends System

### Flow

1. Player A searches for Player B by username
2. A sends friend request → `friendships` row with `status: 'pending'`
3. B sees a notification → can accept or decline
4. On accept → `status: 'accepted'`. Both appear in each other's friend lists.
5. Friends can see each other's online status
6. Friends can invite each other to game rooms

### Invite Flow

1. In the waiting room, the host clicks "Invite"
2. A modal shows the host's friend list (filtered by online/not-in-game)
3. Host selects friends → they receive a notification with the join code
4. Invited friends can click to join directly

### Real-time Updates

Supabase Realtime subscriptions for:

- Friend request received (watch `friendships` where `addressee_id = me`)
- Friend online/offline status changes (watch `profiles` status)
- Game invite received (could be a simple DB notification table)

---

## 12. Game State Flow

### Server-side Game Loop

```
1. Room fills → Host clicks "Start"
2. Server: initGame(config) → gameState
3. Broadcast game_state to all
4. Loop:
   a. Wait for current player's action (or timer expiry)
   b. Server: processAction(gameState, action) → newGameState
   c. Broadcast game_state to all
   d. If gameState.gameOver → break
5. Save results to game_history
6. Broadcast game_over
7. Room status → 'finished'
```

### Client-side Game Loop

```
1. Receive game_state via WebSocket
2. Render:
   - GameBoard: top card, draw pile count, direction
   - OpponentsView: card counts, names, status (on-verge, cardless, winner)
   - PlayerHand: my cards with legal/illegal markers
   - ActionBar: contextual prompts (bomb response, question answer, etc.)
   - DeclareCard button: visible when I'm on verge
   - VideoChat: WebRTC grid
3. If it's my turn:
   - Enable card clicks
   - Start turn timer (30s)
   - On card click → send { type: 'action', action: PlayerAction }
   - On timer expiry → auto-send { type: 'action', action: { kind: 'pick' } }
4. If not my turn:
   - Disable card clicks
   - Watch the action unfold
```

---

## 13. WebRTC Video/Audio

### Architecture

```
Client A ←── peer connection ──→ Client B
   │                                  │
   └──── signaling via WebSocket ─────┘
```

### Flow

1. When joining a game room, each client initializes a `RTCPeerConnection`
2. Gets local media: `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`
3. Adds local tracks to the peer connection
4. Creates an SDP offer → sends via WebSocket (`webrtc_signal` to each peer)
5. Receiving peer sets remote description, creates answer, sends back
6. ICE candidates exchanged via WebSocket signaling
7. Connection established → video streams appear in grid

### Video Grid Layout

- 2 players: side-by-side
- 3–4 players: 2×2 grid
- 5–8 players: 3×3 grid (scrollable)
- Self-view: small PIP in corner
- Mute/unmute buttons per tile
- Video off → show avatar

### STUN/TURN

- Free STUN server: `stun:stun.l.google.com:19302`
- TURN server: needed for symmetric NATs. Options:
  - Supabase doesn't provide TURN
  - Self-hosted coturn on the game server
  - Managed: Twilio TURN (free tier: 1GB/month)
  - For v1: STUN only (works for ~85% of users). Add TURN later.

---

## 14. Frontend Component Tree

```
App
├── AuthGuard
│   ├── [unauthenticated]
│   │   ├── LoginForm
│   │   └── SignUpForm
│   └── [authenticated]
│       ├── Lobby
│       │   ├── CreateRoom
│       │   ├── JoinRoom
│       │   ├── RoomList       (active rooms I'm in)
│       │   └── FriendsList
│       │       └── FriendItem (username, status, invite button)
│       └── GameRoom
│           ├── GameBoard
│           │   ├── TopCard          (the discard pile top)
│           │   ├── DrawPile         (card count)
│           │   ├── DirectionIndicator (clockwise ↻ / counterclockwise ↺)
│           │   ├── OpponentsView
│           │   │   └── OpponentTile
│           │   │       ├── Avatar + name
│           │   │       ├── Card count
│           │   │       ├── Status badges (on-verge, cardless, winner)
│           │   │       └── VideoTile (WebRTC stream)
│           │   └── ActionBar
│           │       ├── BombPrompt    ("Pick X cards or counter!")
│           │       ├── QuestionPrompt ("Answer with non-special or pick")
│           │       ├── AceRequestPrompt
│           │       └── TurnTimer     (countdown bar)
│           ├── PlayerHand
│           │   └── Card (× N)         (clickable if my turn, legal/illegal markers)
│           ├── DeclareCard            ("CARD!" button, appears on verge)
│           ├── VideoChat
│           │   └── VideoTile (× N)   (one per connected player)
│           └── WinnerOverlay          (shown at game end)
└── Toaster (notifications: friend requests, invites, errors)
```

---

## 15. UI/UX Design

### Visual Style

- **Color palette:** Deep green felt background (#1a3a1a), warm wood tones, gold accents
- **Cards:** CSS-drawn playing cards with white face, rounded corners, colored suit symbols
- **Typography:** Inter (sans-serif) for UI, serif for card ranks
- **Dark mode:** Automatic based on system preference

### Card Design (CSS)

```
┌─────────┐
│ A       │
│   ♠     │  ← large centered suit symbol
│         │     red for ♥♦, black for ♠♣
│       A │
└─────────┘
```

- Dimensions: 70px × 100px (responsive)
- Jokers: colored border (red/black), "JOKER" text
- Special cards: subtle glow or badge indicating effect
- Legal cards: green border highlight
- Illegal cards: reduced opacity
- Hover: slight lift + shadow (when it's your turn)

### Responsive Layout

- Desktop: Cards spread horizontally, opponents around the table
- Mobile: Cards stacked at bottom, opponents in a scrollable top row
- Tablet: Hybrid layout

### States

| State | Visual |
|-------|--------|
| My turn | Cards full opacity + legal highlights + timer bar |
| Not my turn | Cards dimmed, no hover effects |
| Being bombed | Red pulsing border + "PICK X OR COUNTER" prompt |
| Question | Purple glow + answer prompt |
| On verge ("CARD!") | Yellow pulsing badge + prominent declare button |
| Cardless | Gray overlay + "drawing next turn" note |
| Winner | Green glow + trophy icon |
| Loser | Red tint + sad emoji |

### Empty States

- No friends: "Add friends to play together! Search by username above."
- No active rooms: "Create a room or join one with a code."
- Empty lobby: Illustration of cards + "Ready to play?"

### Error States

- Connection lost: Toast "Reconnecting..." with spinner
- Invalid action: Card shakes + error toast
- Room full: Modal "This room is full. Try another code?"
- Auth expired: Redirect to login

---

## 16. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| **Cheating** | Server-authoritative game engine. Clients send actions, not state. |
| **Card peeking** | Server sends only visible info to each client (own hand, opponent counts). |
| **JWT theft** | Short-lived access tokens (1h). Refresh via Supabase SDK. HTTPS only. |
| **WebSocket hijack** | Token validated on connect. Connection bound to user + room. |
| **Room spam** | Rate limit room creation (5 per minute per user). |
| **SQL injection** | Supabase handles parameterized queries. |
| **XSS** | React's default escaping. CSP headers. |
| **CSRF** | Supabase handles CSRF tokens for auth endpoints. |
| **WebRTC IP leak** | STUN only reveals public IP (unavoidable for P2P). TURN masks IP if needed. |

---

## 17. Deployment

### Target Platforms

| Component | Platform | Why |
|-----------|----------|-----|
| Client (SPA) | **Vercel** | Free tier, auto-deploys from GitHub, global CDN |
| Game Server | **Fly.io** or **Railway** | WebSocket support, easy scaling, affordable |
| Database + Auth | **Supabase** | Managed, free tier sufficient for launch |

### CI/CD

- GitHub Actions for:
  - Lint + type-check + test on every PR
  - Deploy client to Vercel on merge to `main`
  - Deploy server to Fly.io on merge to `main`

### Environment Variables

```
# Client (.env)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_WS_URL=wss://api.kenyanpoker.com/ws

# Server (.env)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=3001
```

---

## 18. Testing Strategy

| Layer | Tool | What |
|-------|------|------|
| **Engine logic** | Vitest + fast-check | 52 tests (43 unit + 9 property) — already done |
| **Server WebSocket** | Vitest + `ws` mock | Room lifecycle, action validation, broadcast |
| **Server API** | Vitest + supertest | REST endpoints, auth middleware |
| **Client components** | Vitest + React Testing Library | Render states, user interactions |
| **Client hooks** | Vitest + MSW (mock WS) | useGame, useAuth, useWebRTC state transitions |
| **E2E** | Playwright | Full game flow: login → create room → invite → play → win |
| **WebRTC** | Manual + Playwright (basic) | Video/audio connectivity (hard to automate fully) |

### Property-Based Tests (Existing)

Located in `packages/engine/__tests__/properties.test.ts`:

1. **Card conservation**: Total cards = decks × 54 always
2. **Winner validity**: No failed-declare player can win
3. **Game-over**: `gameOver` iff n−1 winners
4. **Top card consistency**: topCard = last discard
5. **No duplicate cards**: Card appears in exactly one location
6. **Direction valid**: Always clockwise or counterclockwise
7. **Player index valid**: Always in bounds
8. **On-verge consistency**: Players on verge have ≤2 cards with non-special
9. **Bomb bounds**: Bomb count is positive and plausible

---

## 19. Roadmap

> **For detailed task tracking, see [TODO.md](TODO.md).** This document provides the high-level vision; TODO.md is the working checklist.

### v1.0 — Playable Multiplayer (Current)

**Completed:**

- [x] Game engine (52 tests: 43 unit + 9 property-based)
- [x] Formal rulebook (LaTeX, Overleaf-compatible)
- [x] Turborepo monorepo setup (engine, server, client)
- [x] Supabase project + DB schema + RLS + triggers
- [x] TypeScript types generated from live database
- [x] Auth UI (sign up, login, Google OAuth, AuthGuard, useAuth hook)
- [x] Room system (create with 6-char code, join, player list, WS with JWT)
- [x] WebSocket JWT validation on connect
- [x] Lobby UI (create room, join by code, room waiting screen)

**In Progress:**

- [ ] Game session: engine integration, turn loop, broadcast state
- [ ] Game UI components (Card, PlayerHand, GameBoard, etc.)
- [ ] Friends system (search, request, accept)
- [ ] Game invitations (invite friend to room)
- [ ] Turn timer (30s auto-pick)

### v1.1 — Video & Audio

- [ ] WebRTC peer connections
- [ ] Video grid in game room
- [ ] Mute/unmute controls
- [ ] STUN + TURN server

### v1.2 — Polish

- [ ] Card play animations
- [ ] Sound effects
- [ ] Game history page
- [ ] Player statistics
- [ ] Spectator mode
- [ ] Bot players for fill

### v2.0 — Social

- [ ] Leaderboards
- [ ] Tournaments
- [ ] Custom card backs / themes
- [ ] Mobile app (React Native)

---

## Appendix A: Game Rules Reference

See **[docs/rules.tex](docs/rules.tex)** for the complete formal rulebook including:

- 10 sections, 9 definitions, 12 rules, 4 invariants
- State-machine semantics with formal transition functions
- Termination proof

See **[packages/engine/src/engine.ts](packages/engine/src/engine.ts)** for the executable reference implementation.

## Appendix B: WebSocket Room Lifecycle

```
Client                              Server
  │                                   │
  │── ws://host/ws?token=&room= ────►│  Validate JWT + room membership
  │◄── { type: 'player_joined' } ────│  Broadcast to room
  │                                   │
  │── { type: 'start_game' } ───────►│  Host only. initGame(config)
  │◄── { type: 'game_started' } ─────│  Broadcast game_state
  │                                   │
  │     ⋮  (turn loop)  ⋮            │
  │                                   │
  │── { type: 'action', action } ───►│  processAction(state, action)
  │◄── { type: 'game_state' } ───────│  Broadcast new state
  │                                   │
  │     ⋮  (repeat until gameOver)  ⋮│
  │                                   │
  │◄── { type: 'game_over' } ────────│  Save history, close room
  │                                   │
```

## Appendix C: File Naming Conventions

- Components: `PascalCase.tsx` (e.g., `PlayerHand.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useGame.ts`)
- Utilities/libs: `kebab-case.ts` (e.g., `ws-client.ts`)
- Types: `types.ts` or `index.ts` in a `types/` directory
- Tests: colocated `__tests__/` or `*.test.ts`
