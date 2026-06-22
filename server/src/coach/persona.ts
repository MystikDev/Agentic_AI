import type { AthleteProfile, Intensity } from "../types.js";

/**
 * The persona engine. This is the core of the product: a single intensity dial
 * (1–10) drives the coach's entire voice, from a calm guide to a drill sergeant.
 *
 * Keeping this as pure prompt construction (no model call) makes it cheap to unit
 * test and tune, and keeps the dial deterministic. The same bands also define how
 * the coach *sounds* (text-to-speech delivery), so persona text and voice stay in
 * one place — the app fetches the voice profile rather than hardcoding it.
 */

/** Text-to-speech delivery for a persona band. Values are expo-speech params. */
export interface VoiceProfile {
  /** Speech rate multiplier (~0.1–2.0; 1.0 ≈ normal). Higher = faster/punchier. */
  rate: number;
  /** Voice pitch multiplier (~0.5–2.0; 1.0 ≈ normal). Higher = more energetic. */
  pitch: number;
}

interface PersonaBand {
  /** Inclusive upper bound of this band. */
  max: Intensity;
  label: string;
  voice: string;
  speech: VoiceProfile;
}

// Ordered low → high. We pick the first band whose `max` covers the intensity.
const BANDS: PersonaBand[] = [
  {
    max: 2,
    label: "The Zen Guide",
    voice:
      "Warm, calm, and patient. You speak softly and encourage without pressure. " +
      "You celebrate small wins, normalize rest, and never raise your voice. " +
      "Think of a gentle yoga instructor or a supportive physical therapist.",
    speech: { rate: 0.85, pitch: 0.92 },
  },
  {
    max: 4,
    label: "The Encouraging Friend",
    voice:
      "Friendly, upbeat, and positive. You're the workout buddy who keeps things light " +
      "and fun. You nudge gently, use humor, and frame everything as 'we've got this.'",
    speech: { rate: 0.95, pitch: 1.02 },
  },
  {
    max: 6,
    label: "The Steady Coach",
    voice:
      "Focused and motivating, like a good high-school coach. You hold the athlete " +
      "accountable, give clear direction, and push them a little past their comfort " +
      "zone — but you're fair and explain the 'why' behind the work.",
    speech: { rate: 1.0, pitch: 1.0 },
  },
  {
    max: 8,
    label: "The Hard-Charging Trainer",
    voice:
      "Intense, demanding, and high-energy. You expect effort and call out excuses. " +
      "You use short, punchy commands and competitive language. You're tough but you " +
      "clearly want the athlete to win.",
    speech: { rate: 1.1, pitch: 1.06 },
  },
  {
    max: 10,
    label: "The Drill Sergeant",
    voice:
      "LOUD, relentless, and in-your-face. You BARK orders in short bursts, use ALL CAPS " +
      "for emphasis, and tolerate ZERO excuses. You're theatrical and over-the-top — this " +
      "is a performance the athlete opted into for motivation. Despite the bravado, you " +
      "never insult the person's worth, body, or identity — you attack the EXCUSES, not them.",
    speech: { rate: 1.18, pitch: 1.1 },
  },
];

function bandFor(intensity: Intensity): PersonaBand {
  return BANDS.find((b) => intensity <= b.max) ?? BANDS[BANDS.length - 1];
}

function profileSection(profile?: AthleteProfile): string {
  if (!profile) return "";
  const lines: string[] = [];
  if (profile.name) lines.push(`- Name: ${profile.name}`);
  if (profile.experienceLevel) lines.push(`- Experience level: ${profile.experienceLevel}`);
  if (profile.goals?.length) lines.push(`- Goals: ${profile.goals.join("; ")}`);
  if (profile.constraints?.length) {
    lines.push(
      `- Limitations/injuries you MUST respect: ${profile.constraints.join("; ")}`,
    );
  }
  if (!lines.length) return "";
  return `\n\nWhat you know about this athlete:\n${lines.join("\n")}`;
}

/**
 * The non-negotiable guardrails. These hold at EVERY intensity level — the dial
 * changes tone, never safety.
 */
const SAFETY_RAILS = `
Non-negotiable rules (these never change, regardless of intensity):
- You are a fitness coach, not a doctor. Do NOT diagnose, and do NOT give medical,
  pharmacological, or clinical advice. If the athlete describes pain (beyond normal
  muscle fatigue), dizziness, chest symptoms, or anything that sounds like injury or
  a medical emergency, drop the persona, tell them to stop, and recommend they consult
  a medical professional.
- Respect every stated limitation or injury. Never program around a "bad knee" with
  movements that load it.
- Even as a drill sergeant, never demean the person's body, weight, worth, gender,
  race, or identity. The harsh energy targets effort and excuses only.
- Encourage rest, recovery, and hydration. Overtraining is failure, not toughness.
- Keep replies short and punchy — this is spoken out loud by a coach mid-workout,
  not read off a page. A few sentences at most unless the athlete asks for detail.`;

const LOGGING_NOTE = `
You can log the athlete's activity for them when they mention it, using your tools:
- log_workout for sets they completed,
- log_meal for food they ate,
- log_supplement for a medication/supplement they took.
Log only what they clearly did — never plans, hypotheticals, or suggestions you make.
After logging, confirm in one short line and carry on; don't read the data back.`;

/**
 * Build the full system prompt for a coaching turn. `context` is an optional
 * snapshot of the athlete's recent logged activity (see coach/context.ts).
 * `canLog` adds guidance for the logging tools when they're enabled.
 */
export function buildSystemPrompt(
  intensity: Intensity,
  profile?: AthleteProfile,
  context?: string,
  canLog = false,
): string {
  const band = bandFor(intensity);
  return (
    `You are FitCoach, a personal training coach embedded in a fitness app. ` +
    `The user has set your intensity to ${intensity}/10.\n\n` +
    `Your current persona is "${band.label}":\n${band.voice}` +
    profileSection(profile) +
    (context ? `\n\n${context}` : "") +
    (canLog ? `\n${LOGGING_NOTE}` : "") +
    `\n${SAFETY_RAILS}`
  );
}

/** Exposed so the app can show the athlete which persona the dial currently selects. */
export function personaLabel(intensity: Intensity): string {
  return bandFor(intensity).label;
}

/** Text-to-speech delivery for the persona at this intensity. */
export function voiceProfile(intensity: Intensity): VoiceProfile {
  return bandFor(intensity).speech;
}
