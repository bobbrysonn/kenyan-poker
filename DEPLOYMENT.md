# Deployment

Deploy the API/WebSocket server to Render and the React client to Vercel. The
Supabase project remains the source of truth for authentication and data.

## Render server

1. Push this repository to GitHub.
2. In Render, create a Blueprint from the repository. It reads `render.yaml`
   and creates the `kenyan-poker-server` web service.
3. Set these Render environment variables from `packages/server/.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
4. Deploy, then copy the service URL, such as
   `https://kenyan-poker-server.onrender.com`.

Render supplies `PORT`. The server health endpoint is `/health`, and WebSocket
connections use `wss://kenyan-poker-server.onrender.com/ws`.

## Vercel client

1. Import the same repository as a Vercel project. Keep the repository root as
   the project root so Vercel can build the shared engine package.
2. Vercel reads `vercel.json`; no build settings need to be entered manually.
3. Add these Production and Preview environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_API_URL=https://kenyan-poker-server.onrender.com`
   - `VITE_WS_URL=wss://kenyan-poker-server.onrender.com/ws`
4. Deploy and copy the Vercel URL.

## Supabase Auth

Add the Vercel production URL and any Vercel preview URL pattern to Supabase
Auth's allowed redirect URLs. This is required for Google OAuth to return to
the deployed client. Do not place `SUPABASE_SECRET_KEY` in Vercel; it belongs
only in the Render server environment.

## Free-tier behavior

Render's Free web service may sleep after inactivity. The first request or
WebSocket connection after sleep can take about a minute to reconnect. This is
appropriate for a hobby beta, but not an always-on multiplayer service.
