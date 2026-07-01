# Kenyan Poker — Project TODO

> **Last updated:** July 1, 2026  
> **Supabase project:** `tmvjhzpniofkbqblvsfm`  
> **Repo:** <https://github.com/bobbrysonn/kenyan-poker>

---

## ✅ Done

### Game Engine

- [x] Core types (`Card`, `GameState`, `PlayerAction`, etc.)
- [x] Deck module (create, shuffle, deal, multi-deck, draw pile recycling)
- [x] Legal card matching (suit, number, joker color)
- [x] Bomb mechanics (2=2, 3=3, joker=5; cumulative, chainable)
- [x] Question mechanics (8 & Q; chainable, self-answer)
- [x] Jump (J; chainable, rejectable)
- [x] Kickback (K; odd reverses, even cancels)
- [x] Regular Ace (defensive: stops bombs; offensive: request suit OR number)
- [x] Ace of Spades (dual power: stop+request defensively, suit+number offensively)
- [x] Cardless state (special last card → auto-draw next turn)
- [x] Win detection (non-special last card)
- [x] "Card" declaration rule (on-verge must declare, penalty for failure)
- [x] Winner rotation (winners removed from turn order, no double-wins)
- [x] Verge flag cleanup on all draw paths (bomb pick, question pick, cardless, normal pick)

### Testing

- [x] 43 unit tests (`engine.test.ts`)
- [x] 9 property-based tests (`properties.test.ts`) — fast-check invariants
- [x] Bot player simulation script (`play-bots.ts`)
- [x] Bug: verge flags not cleaned on draw (4 paths) — found & fixed
- [x] Bug: winners kept playing after winning — found & fixed
- [x] Bug: double-win possible — found & fixed

### Documentation

- [x] LaTeX formal rulebook (`docs/rules.tex`) — Overleaf-compatible
- [x] Project specification (`SPEC.md`) — 19 sections
- [x] GitHub repo with full commit history

### Infrastructure

- [x] Turborepo monorepo scaffold (`packages/engine`, `packages/server`, `packages/client`)
- [x] pnpm workspaces configured
- [x] Supabase project created (`tmvjhzpniofkbqblvsfm`)
- [x] Database schema: 5 tables (`profiles`, `friendships`, `game_rooms`, `room_players`, `game_history`)
- [x] Row-Level Security policies on all tables
- [x] Auth trigger: auto-create profile on signup
- [x] Generated TypeScript types from live database
- [x] Client `.env` configured with Supabase URL + anon key
- [x] Server scaffold (Express + WebSocket)
- [x] Client scaffold (React 19 + Vite 5 + Tailwind v4)

---

## 🔴 Pending — v1.0 (Playable Multiplayer)

### 🔑 One-time manual step

- [ ] **Get Supabase `service_role` key** from [dashboard](https://supabase.com/dashboard/project/tmvjhzpniofkbqblvsfm/settings/api) → paste into `packages/server/.env`

### Auth (packages/client)

- [ ] SignUpForm component (email + password, username)
- [ ] LoginForm component (email + password, Google OAuth)
- [ ] AuthGuard component (redirect to /login if unauthenticated)
- [ ] `useAuth` hook (Supabase session, login, logout, signup)
- [ ] Password reset flow

### Lobby (packages/client)

- [ ] Dashboard / lobby page with room list
- [ ] CreateRoom component (generates join code via server)
- [ ] JoinRoom component (join by code, join by invite link)
- [ ] Room waiting screen (player list, invite button, start game button)
- [ ] `useRooms` hook (CRUD for rooms via Supabase)

### Friends (packages/client)

- [ ] FriendsList component (online/offline/in-game status)
- [ ] Search users by username
- [ ] Send friend request
- [ ] Accept/reject friend request
- [ ] `useFriends` hook
- [ ] Invite friend to room (sends notification with room code)

### Game UI (packages/client)

- [ ] **`Card` component** — CSS-drawn playing card with suit, rank, color
- [ ] **`PlayerHand` component** — scrollable hand, legal/illegal highlights, click to play
- [ ] **`GameBoard` component** — top card, draw pile count, discard count
- [ ] **`OpponentsView` component** — card counts, status badges, turn indicator
- [ ] **`ActionBar` component** — contextual prompts (bomb, question, ace request)
- [ ] **`DeclareCard` component** — prominent "CARD!" button when on verge
- [ ] **`DirectionIndicator`** — clockwise ↻ / counterclockwise ↺
- [ ] **`WinnerOverlay`** — shown at game end
- [ ] **`TurnTimer`** — 30-second countdown bar
- [ ] `useGame` hook — WebSocket connection, game state, action dispatch

### Server (packages/server)

- [ ] Supabase JWT validation on WebSocket connect
- [ ] Room CRUD endpoints (create with code, join, leave)
- [ ] Game session: load engine, run turn loop, broadcast state
- [ ] Turn timer (30s auto-pick)
- [ ] Reconnection handling (60s grace period)
- [ ] Text chat relay

### CSS / Styling

- [ ] Card CSS (rounded corners, suit symbols, red/black, legal/illegal, hover)
- [ ] Game table layout (green felt background)
- [ ] Responsive: desktop, tablet, mobile
- [ ] State indicators (on-verge glow, bomb pulse, cardless overlay)
- [ ] Animations: card play, direction change, bomb chain

### Deployment

- [ ] Deploy client to Vercel
- [ ] Deploy server to Fly.io or Railway
- [ ] CI/CD pipeline (GitHub Actions: lint, test, deploy)

---

## 🟡 Pending — v1.1 (Video & Audio)

- [ ] WebRTC peer connection lifecycle
- [ ] `useWebRTC` hook (getUserMedia, peer connection, signaling)
- [ ] WebRTC signaling relay in WebSocket server
- [ ] `VideoChat` component — peer video grid
- [ ] `VideoTile` component — single participant
- [ ] Mute/unmute audio + video controls
- [ ] STUN server config (TURN for production)

---

## 🟢 Pending — v1.2 (Polish)

- [ ] Card play animations (slide, flip)
- [ ] Sound effects (card play, bomb, win, declare)
- [ ] Game history page
- [ ] Player statistics (wins, games played, bomb count)
- [ ] Spectator mode
- [ ] Bot players for backfill (reuse bot logic)
- [ ] Auto-kick AFK players

---

## 🔵 Pending — v2.0 (Social & Scale)

- [ ] Leaderboards
- [ ] Tournaments
- [ ] Custom card backs / themes
- [ ] Mobile app (React Native)
- [ ] Achievements / badges
- [ ] In-game currency / betting (if legal)

---

## 🧪 Pending — Testing

- [ ] Server WebSocket tests (room lifecycle, action validation)
- [ ] Server API tests (REST endpoints, auth middleware)
- [ ] Client component tests (React Testing Library)
- [ ] Client hook tests (useGame, useAuth, useWebRTC)
- [ ] E2E tests (Playwright: login → create room → invite → play → win)
- [ ] WebRTC connectivity tests

---

## 📋 Quick Start (next session)

```bash
cd ~/Projects/kenyanpoker
pnpm install                    # Already done, but re-run if packages changed
pnpm --filter @kenyan-poker/engine test   # 52 tests — should all pass

# Set up server env (one-time)
# 1. Get service_role key from https://supabase.com/dashboard/project/tmvjhzpniofkbqblvsfm/settings/api
# 2. Edit packages/server/.env → paste it as SUPABASE_SERVICE_ROLE_KEY

# Start development
pnpm dev                        # Starts all packages via turbo
# or individually:
pnpm --filter @kenyan-poker/client dev    # Vite dev server on :5173
pnpm --filter @kenyan-poker/server dev    # Express + WS on :3001
```
