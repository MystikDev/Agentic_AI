# FitCoach

A health & wellness app with a personality-adjustable AI training coach — set a
dial from a calm guide to a full drill sergeant, and the coach's voice changes to
match. This repo is **Phase 0**: the personality coach, the differentiated core
of the product. (Camera form-tracking, diet, meds/supplements, and Apple
Watch / Health Connect integration are planned — see `docs/ROADMAP.md`.)

## What's here

```
server/   Node + TypeScript backend. Holds the Anthropic + Supabase service keys,
          runs the persona engine, streams coaching replies, and persists profile
          and conversation history. (The app never calls Claude directly — see
          docs/ARCHITECTURE.md for why.)
app/      Expo (React Native) app for iOS + Android. Auth, chat UI, intensity dial.
supabase/ Database schema (migrations) for auth + persistence.
docs/     Architecture, roadmap, and Supabase setup.
```

Accounts, the athlete profile, and conversation history are backed by
**Supabase** (managed Postgres + auth). Set it up once with `docs/SUPABASE.md`
before running — or skip it to try the coach without persistence (the public
persona endpoint works; authenticated features return `503`).

## Quick start

First, set up Supabase once: follow [`docs/SUPABASE.md`](docs/SUPABASE.md)
(create the project, run the schema, copy the keys).

### 1. Backend
```bash
cd server
cp .env.example .env        # add ANTHROPIC_API_KEY + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev                 # http://localhost:8787
```

Smoke-test the public persona endpoint (no auth needed):
```bash
curl -s 'http://localhost:8787/coach/persona?intensity=9'
# {"intensity":9,"label":"The Drill Sergeant","voice":{"rate":1.18,"pitch":1.1}}
```

### 2. App
```bash
cd app
# set expo.extra.supabaseUrl / supabaseAnonKey in app.json (see docs/SUPABASE.md)
npm install
npm start                   # press i (iOS), a (Android), or w (web)
```
Create an account on first launch; your profile and conversations persist.

> On a physical device, set `expo.extra.apiBaseUrl` in `app/app.json` to your
> machine's LAN IP (e.g. `http://192.168.1.20:8787`) instead of `localhost`.

## The intensity dial

A single 1–10 value selects one of five persona bands, server-side:

| Intensity | Persona |
|---|---|
| 1–2 | The Zen Guide |
| 3–4 | The Encouraging Friend |
| 5–6 | The Steady Coach |
| 7–8 | The Hard-Charging Trainer |
| 9–10 | The Drill Sergeant |

Safety guardrails (no medical advice, respect injuries, attack excuses not the
person, encourage rest) are constant across the dial — tone changes, safety
doesn't. The mapping lives in `server/src/coach/persona.ts`.

The same engine also defines how the coach *sounds*: each band carries a
text-to-speech profile (rate/pitch), served to the app so the coach speaks its
replies out loud — slow and low for the Zen Guide, fast and punchy for the Drill
Sergeant. Toggle it with the 🔊/🔇 button in the app header.

## Status & honest caveats

- This is an early scaffold, not a shippable product. Auth, persistence, and a
  production-grade streaming transport are Phase 1 (`docs/ROADMAP.md`).
- The coach is **not** a medical or clinical tool. Medication tracking and any
  health claims will need real regulatory/privacy review before launch.
