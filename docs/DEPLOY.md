# Deploy a hosted preview (Render)

This gets you a public URL to open on any device — no terminal. It deploys two
services from `render.yaml`:

- **fitcoach-api** — the backend (Node web service), in **demo mode** (in-memory
  store, no database). The only secret you provide is your Anthropic API key.
- **fitcoach-web** — the Expo web app (static site), automatically pointed at the
  API.

## Prerequisites
- A free [Render](https://render.com) account.
- An Anthropic API key (https://console.anthropic.com).
- This repo on GitHub (it is: `MystikDev/Agentic_AI`).

## One-click-ish deploy (Blueprint)
1. In Render: **New → Blueprint**.
2. Connect the `MystikDev/Agentic_AI` repo and pick the branch
   (`claude/health-wellness-app-concept-6s2wi3`, or `main` once the PR is merged).
3. Render reads `render.yaml` and shows two services: **fitcoach-api** and
   **fitcoach-web**.
4. It will prompt for the **`ANTHROPIC_API_KEY`** value (it's marked secret).
   Paste your key here — in Render's dashboard, never in code or chat.
5. Click **Apply** / **Create**. First build takes ~3–6 minutes.
6. When both are live, open the **fitcoach-web** URL
   (e.g. `https://fitcoach-web.onrender.com`). That's the app.

That's it — sign-in is skipped (demo mode), and the Coach / Workouts / Diet tabs
all work.

## Notes & gotchas
- **Free-tier cold start:** the free API service sleeps after ~15 min idle. The
  first request after it wakes can take ~30–60s, which may make the first coach
  reply time out. Fix: open `https://fitcoach-api.onrender.com/health` once to
  warm it, then use the app — or upgrade the API service off the free plan.
- **Demo data resets** whenever the API restarts (in-memory store).
- **Tighten CORS** after first deploy: set `ALLOWED_ORIGINS` on fitcoach-api to
  your web URL (e.g. `https://fitcoach-web.onrender.com`) instead of `*`.

## Enable accounts + durable storage (optional, later)
1. Set up Supabase per [`docs/SUPABASE.md`](SUPABASE.md) (create project, run the
   migrations).
2. On **fitcoach-api**, add env vars `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`.
3. On **fitcoach-web**, add `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. Redeploy both. The login screen now appears and data persists.

## Manual fallback (if the Blueprint hiccups)
Create the two services by hand in Render with these settings:

**Web Service — fitcoach-api**
- Root directory: `server`
- Build: `npm install && npm run build`
- Start: `npm start`
- Health check path: `/health`
- Env: `ANTHROPIC_API_KEY` (secret), `ALLOWED_ORIGINS=*`

**Static Site — fitcoach-web**
- Root directory: `app`
- Build: `npm install && npx expo export -p web`
- Publish directory: `dist`
- Env: `API_BASE_URL` = your fitcoach-api URL (e.g.
  `https://fitcoach-api.onrender.com`)
- Add a rewrite rule: `/*` → `/index.html`

## Other hosts
The same artifacts work elsewhere: any Node host (Railway, Fly.io, a VM) can run
the backend (`npm run build` → `npm start`, honoring `PORT`), and any static host
(Netlify, Vercel, GitHub Pages, Cloudflare Pages) can serve the Expo web export
(`npx expo export -p web` → publish `dist`), as long as the web build is given
`API_BASE_URL` pointing at the backend.
