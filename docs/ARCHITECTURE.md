# Architecture

## Why this shape

The app never talks to Anthropic directly. The Anthropic API key would be
extractable from a shipped mobile binary, so all model calls go through our own
backend. This also gives us one place to add auth, rate limiting, billing,
logging, and persistence as the product grows.

```
┌─────────────────┐        HTTPS / SSE        ┌──────────────────┐      ┌─────────────┐
│  Expo app       │ ───────────────────────►  │  FitCoach server │ ───► │  Anthropic  │
│  (iOS/Android)  │ ◄─── streamed tokens ───   │  (Node + TS)     │ ◄─── │  Claude     │
└─────────────────┘                            └──────────────────┘      └─────────────┘
        │                                               │
   intensity dial                              persona engine (intensity → system prompt)
   chat UI                                     safety guardrails (constant across dial)
```

## Components

### `server/` — Node + TypeScript backend
- **`coach/persona.ts`** — the heart of the product. A pure function maps the
  1–10 intensity dial to a system prompt: five persona bands from "Zen Guide" to
  "Drill Sergeant", plus athlete profile context and a set of safety guardrails
  that hold at *every* intensity (no medical advice, respect injuries, attack
  excuses not the person, encourage rest).
- **`coach/chat.ts`** — calls Claude (`claude-opus-4-8`) with streaming. Replies
  are short and thinking is off, because a coach talking mid-workout needs low
  latency, not deep reasoning.
- **`routes/coach.ts`** — `POST /coach/chat` streams the reply as Server-Sent
  Events; `GET /coach/persona` returns the label for a given intensity.
- **`types.ts`** — Zod schemas validate every request at the boundary.

### `app/` — Expo (React Native) client
- **`screens/CoachScreen.tsx`** — chat UI + the intensity dial.
- **`components/IntensityDial.tsx`** — the signature 1–10 slider.
- **`api/coach.ts`** — talks to the backend; parses the SSE token stream.

## Key decisions

| Decision | Why |
|---|---|
| Backend proxy, not direct API calls | Protect the API key; central place for auth/billing/limits |
| Expo / React Native | One codebase for iOS + Android; fast iteration; native modules available for the camera phase |
| Intensity as a single integer 1–10 | Simple, deterministic, easy to test; drives the whole persona |
| Persona logic server-side | Tune the coach without shipping a new app build |
| SSE streaming | Token-by-token feel now; same stream feeds text-to-speech later |
| Model: `claude-opus-4-8` | Strongest instruction-following for nuanced tone control across the dial |
| Safety rails independent of the dial | The dial changes tone, never safety |
