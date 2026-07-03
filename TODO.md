# Kenyan Poker — Project TODO

> **Last updated:** July 3, 2026  
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

- [x] Turborepo monorepo scaffold
- [x] pnpm workspaces configured
- [x] Supabase project created (`tmvjhzpniofkbqblvsfm`)
- [x] Database schema: 5 tables + RLS + triggers
- [x] Generated TypeScript types from live database
- [x] Client `.env` configured (`sb_publishable_...` key)
- [x] Server `.env` configured (`sb_secret_...` key)

### Auth

- [x] SignUpForm (email + password + username)
- [x] LoginForm (email + password, Google OAuth)
- [x] AuthGuard (redirect to /login if unauthenticated)
- [x] `useAuth` hook (session, profile, signUp, signIn, signOut)

### Lobby & Rooms

- [x] Lobby with Create Room + Join by code
- [x] Server generates 6-char room codes
- [x] REST endpoints: `POST /api/rooms`, `GET /api/rooms/:code`, `POST /api/rooms/:code/join`
- [x] Room waiting screen (player list, copy code, leave)
- [x] `useRooms` hook (createRoom, joinRoom)
- [x] WebSocket: JWT validation on connect, player join/leave broadcast
- [x] Bug: WS connect checked room membership by join code instead of room UUID — every connection was silently rejected as "not a member". Found & fixed.

### Game Session (packages/server)

- [x] Game session: init engine, run turn loop, broadcast game state (`game-session.ts`)
- [x] Process player actions via WebSocket → `engine.processAction()`
- [x] Turn timer (30s auto-pick — context-aware: bomb/question/plain pick)
- [x] Host-only "Start Game" button (client wired, server-enforced)
- [x] Per-client hand redaction (opponents see card counts only, not hands)
- [x] Save results to `game_history` + room status → `finished` on game over
- [x] 9 unit tests for `game-session.ts` (turn ownership, redaction, auto-timer action, full game to completion) — no DB dependency
- [x] End-to-end smoke test against live server + real Supabase project (manual, one-off)

---

## 🔴 Pending — v1.0 (Playable Multiplayer)

### Game Session (packages/server)

- [ ] Reconnection handling (60s grace period)
- [ ] Text chat relay (already wired, needs UI)

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

### Friends (packages/client)

- [ ] FriendsList component (online/offline/in-game status)
- [ ] Search users by username
- [ ] Send friend request
- [ ] Accept/reject friend request
- [ ] `useFriends` hook
- [ ] Invite friend to room

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

---

## 🧪 Pending — Testing

- [x] Server game-session tests (turn ownership, redaction, full game to completion) — see Done above
- [ ] Server WebSocket tests (room lifecycle via mocked `ws` connections)
- [ ] Server API tests (REST endpoints, auth middleware)
- [ ] Client component tests (React Testing Library)
- [ ] Client hook tests (useGame, useAuth, useWebRTC)
- [ ] E2E tests (Playwright: login → create room → invite → play → win)
- [ ] WebRTC connectivity tests

---

## 📋 Quick Start (next session)

```bash
cd ~/Projects/kenyanpoker
pnpm install

# Run tests
pnpm --filter @kenyan-poker/engine test   # 52 tests
pnpm --filter @kenyan-poker/server test   # 9 tests (game-session)

# Start dev servers
pnpm --filter @kenyan-poker/server dev    # Express + WS on :3001
pnpm --filter @kenyan-poker/client dev    # Vite on :5173
```

**All env vars are already configured.** No manual setup needed.
