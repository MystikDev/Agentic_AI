import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AthleteProfile } from "./api/coach";

/**
 * Athlete profile persistence. Stored on-device for now (no account required to
 * try the app); moves server-side when auth lands in Phase 1. The shape matches
 * the server's `AthleteProfile` so it can be sent straight into a coach request.
 */

const KEY = "fitcoach.profile.v1";

export const EMPTY_PROFILE: AthleteProfile = {
  name: "",
  experienceLevel: undefined,
  goals: [],
  constraints: [],
};

export async function loadProfile(): Promise<AthleteProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY_PROFILE;
    return { ...EMPTY_PROFILE, ...(JSON.parse(raw) as AthleteProfile) };
  } catch {
    return EMPTY_PROFILE;
  }
}

export async function saveProfile(profile: AthleteProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}

/**
 * Strip empty fields so we only send the coach what's actually filled in.
 * Returns undefined when nothing is set (keeps the request lean).
 */
export function forRequest(profile: AthleteProfile): AthleteProfile | undefined {
  const cleaned: AthleteProfile = {};
  if (profile.name?.trim()) cleaned.name = profile.name.trim();
  if (profile.experienceLevel) cleaned.experienceLevel = profile.experienceLevel;
  const goals = (profile.goals ?? []).map((g) => g.trim()).filter(Boolean);
  if (goals.length) cleaned.goals = goals;
  const constraints = (profile.constraints ?? []).map((c) => c.trim()).filter(Boolean);
  if (constraints.length) cleaned.constraints = constraints;
  return Object.keys(cleaned).length ? cleaned : undefined;
}

/** UI helpers: textarea (newline/comma separated) <-> string[]. */
export const linesToList = (text: string): string[] =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const listToLines = (list?: string[]): string => (list ?? []).join("\n");
