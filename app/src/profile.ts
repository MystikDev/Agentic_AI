import type { AthleteProfile } from "./api/coach";

/**
 * Profile helpers. Persistence now lives on the server (see api/coach.ts:
 * getProfile/saveProfile); this module only holds the empty value and the
 * text<->list conversions the editor UI needs.
 */

export const EMPTY_PROFILE: AthleteProfile = {
  name: "",
  experienceLevel: undefined,
  goals: [],
  constraints: [],
};

/**
 * Strip empty fields so we only persist/send what's actually filled in.
 * Returns undefined when nothing is set.
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
