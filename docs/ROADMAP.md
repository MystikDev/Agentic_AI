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
- ✅ **Production streaming transport:** token streaming now goes over
  `react-native-sse` (XHR-based EventSource with POST + auth headers), reliable on
  iOS, Android, and web — replacing the fetch ReadableStream body that RN doesn't
  expose on all platforms. The SSE error frame is named `coach_error` to avoid
  colliding with the client's reserved transport-error event.
- ✅ **Auth + persistence (Supabase):** email/password accounts; athlete profile
  and conversation history stored server-side in Postgres. The app authenticates
  with Supabase directly and sends its token to the backend, which verifies it and
  owns all DB writes via the service-role key (RLS as defense-in-depth). The chat
  endpoint loads history + profile server-side and persists each turn. See
  `docs/SUPABASE.md`. *Next:* OAuth/magic-link sign-in; a conversation list/picker
  UI (the backend already serves it); local JWKS token verification to drop the
  per-request auth round trip.
- ✅ **Profile onboarding:** captured goals, experience, and injuries feed the
  persona engine's `profile` block (now persisted server-side).

## Phase 2 — Tracking hub
- ✅ **Workout logging:** log a session of sets (exercise / weight / reps, with
  bodyweight support) and see your history, persisted per user. New "Workouts" tab
  alongside the Coach. *Next:* progress charts (volume/PRs over time), edit/delete,
  and letting the coach log workouts for you via a tool call.
- ✅ **Diet logging:** log meals with optional calories + macros; the Diet tab
  groups entries by day with daily calorie totals. Deliberately lightweight manual
  entry — integrate an existing nutrition API later rather than rebuild a food
  database. *Next:* daily macro targets, and coach access to logged meals.
- Goals and streaks.
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
