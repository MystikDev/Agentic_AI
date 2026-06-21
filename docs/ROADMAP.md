# Roadmap

The full vision (camera form-tracking, diet, meds/supplements, Apple Watch /
Health Connect integration, reporting) is several products. This roadmap ships
it as a sequence of thin, releasable slices rather than all at once.

## ✅ Phase 0 — Personality coach (this scaffold)
- Intensity dial (1–10), persona engine, safety guardrails.
- Streaming text chat with the coach.
- Backend proxy so the API key never ships in the app.

## Phase 1 — Make the coach feel alive
- ✅ **Voice (TTS):** the streamed reply is spoken via `expo-speech`, sentence by
  sentence as it arrives, with per-persona delivery (rate/pitch) served from the
  persona engine so the dial and the voice never drift. Mute toggle in the header.
  *Next:* premium neural voices (ElevenLabs/Azure) per persona for a real
  drill-sergeant timbre, streamed as audio rather than on-device TTS.
- **Production streaming transport:** React Native's `fetch` does not expose a
  streaming body on all platforms. Move to `react-native-sse` or a WebSocket so
  token streaming is reliable on device (the current client falls back to the
  final `done` event when no stream reader is available).
- **Auth + persistence:** user accounts; store conversations, profile, goals
  server-side. Pick a backend store (Postgres/Supabase) and add auth.
- **Profile onboarding:** capture goals, experience, and injuries to feed the
  persona engine's `profile` block.

## Phase 2 — Tracking hub
- Workouts, sets/reps logging, progress charts.
- Goals and streaks.
- Lightweight diet logging (or integrate MyFitnessPal/Cronometer rather than
  rebuilding a food database).
- Medication & supplement tracking with reminders.
- Reporting/export (PDF/CSV summaries).

## Phase 3 — Camera form + rep tracking
- Start with pose estimation via an existing engine (Apple Vision / MediaPipe /
  MoveNet/BlazePose), scoped to a handful of camera-forgiving exercises
  (squats, push-ups, lunges, curls).
- Rep counting first (well-understood), then form-quality cues.
- On-device processing where possible — exercise footage is highly sensitive.

## Phase 4 — Platform integrations & compliance
- Apple HealthKit and Android Health Connect (Samsung Health feeds Health
  Connect).
- Privacy-by-design review; "not medical advice" framing throughout.
- Regulatory review for medication tracking + any health claims (wellness vs.
  medical-device line, GDPR/CCPA, platform health-data policies).

## Cross-cutting (start early, never "later")
- **Privacy & security:** minimize data collected; encrypt sensitive data;
  clear consent. Especially before camera and medication features.
- **Cost controls:** cache, cap `max_tokens`, monitor per-user usage.
- **Eval harness:** test the persona across the dial so tone changes don't
  regress safety.
