import { listWorkouts, listMeals, listMedications } from "../store/index.js";
import { startOfUtcDay, type Workout, type Meal, type Medication } from "../store/shared.js";

/**
 * Builds a short, current snapshot of the athlete's logged activity so the coach
 * can reference it naturally ("nice work hitting your squats yesterday", "you
 * haven't logged a meal yet today"). Kept concise to limit token cost, and
 * best-effort: any failure yields no context rather than blocking the reply.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function summarizeSets(w: Workout): string {
  const parts = w.sets
    .slice(0, 4)
    .map((s) => (s.weight == null ? `${s.exercise} BW×${s.reps}` : `${s.exercise} ${s.weight}×${s.reps}`));
  if (w.sets.length > 4) parts.push("…");
  return parts.join(", ");
}

/** Pure formatter — easy to unit test. Returns "" when there's nothing worth saying. */
export function formatAthleteContext(
  workouts: Workout[],
  meals: Meal[],
  meds: Medication[],
  now = new Date(),
): string {
  const dayStart = startOfUtcDay(now);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const lines: string[] = [];

  // Workouts
  if (workouts.length) {
    const last = workouts[0];
    const last7 = workouts.filter((w) => w.performedAt >= weekAgo).length;
    const todays = workouts.some((w) => w.performedAt >= dayStart);
    lines.push(
      `- Training: last workout ${shortDate(last.performedAt)} — ${summarizeSets(last)}. ` +
        `${last7} in the last 7 days${todays ? " (including today)" : ""}.`,
    );
  }

  // Today's meals
  const todaysMeals = meals.filter((m) => m.eatenAt >= dayStart);
  if (todaysMeals.length) {
    const kcal = todaysMeals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
    const protein = todaysMeals.reduce((sum, m) => sum + (m.proteinG ?? 0), 0);
    const extras: string[] = [];
    if (kcal > 0) extras.push(`~${kcal} kcal`);
    if (protein > 0) extras.push(`${protein}g protein`);
    lines.push(
      `- Nutrition today: ${todaysMeals.length} meal(s) logged` +
        (extras.length ? ` (${extras.join(", ")}).` : "."),
    );
  } else if (meals.length) {
    lines.push("- Nutrition today: nothing logged yet.");
  }

  // Meds / supplements today
  if (meds.length) {
    const taken = meds.filter((m) => m.takenToday > 0).map((m) => m.name);
    const missed = meds.filter((m) => m.takenToday === 0).map((m) => m.name);
    const bits: string[] = [];
    if (taken.length) bits.push(`taken: ${taken.join(", ")}`);
    if (missed.length) bits.push(`not yet: ${missed.join(", ")}`);
    lines.push(`- Meds/supplements today — ${bits.join("; ")}.`);
  }

  if (!lines.length) return "";

  return (
    "The athlete's recent activity (reference it naturally when it's relevant — " +
    "don't recite it or lecture):\n" +
    lines.join("\n")
  );
}

/** Fetch the athlete's data and format it. Never throws — returns "" on any error. */
export async function buildAthleteContext(userId: string): Promise<string> {
  try {
    const [workouts, meals, meds] = await Promise.all([
      listWorkouts(userId),
      listMeals(userId),
      listMedications(userId),
    ]);
    return formatAthleteContext(workouts, meals, meds);
  } catch {
    return "";
  }
}
