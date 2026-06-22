import { listWorkouts, listMeals, listMedications, listIntakesSince } from "../store/index.js";
import type { Workout, Meal, Medication, MedIntake } from "../store/shared.js";

/**
 * A weekly summary of training, nutrition, and med/supplement adherence — the
 * shareable "here's my week" artifact. Computed server-side from logged data.
 */

export interface WeeklyReport {
  rangeStart: string;
  rangeEnd: string;
  days: number;
  training: {
    workouts: number;
    daysTrained: number;
    sets: number;
    volume: number; // sum of weight*reps for weighted sets
    topExercises: { exercise: string; sets: number }[];
  };
  nutrition: {
    meals: number;
    daysLogged: number;
    avgCalories: number | null; // per logged day
    avgProtein: number | null; // per logged day
  };
  adherence: { name: string; daysTaken: number; doses: number; rate: number }[]; // rate 0–1 over window
  markdown: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (iso: string) => `${MONTHS[new Date(iso).getUTCMonth()]} ${new Date(iso).getUTCDate()}`;
const dateKey = (iso: string) => iso.slice(0, 10); // UTC calendar day

/** Pure aggregation — easy to unit test. */
export function computeWeeklyReport(
  workouts: Workout[],
  meals: Meal[],
  meds: Medication[],
  intakes: MedIntake[],
  days: number,
  now = new Date(),
): WeeklyReport {
  const startMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  const startISO = new Date(startMs).toISOString();
  const inWindow = (iso: string) => iso >= startISO;

  // Training
  const w = workouts.filter((x) => inWindow(x.performedAt));
  const exerciseSets = new Map<string, number>();
  let sets = 0;
  let volume = 0;
  for (const workout of w) {
    for (const s of workout.sets) {
      sets += 1;
      exerciseSets.set(s.exercise, (exerciseSets.get(s.exercise) ?? 0) + 1);
      if (s.weight != null) volume += s.weight * s.reps;
    }
  }
  const topExercises = [...exerciseSets.entries()]
    .map(([exercise, n]) => ({ exercise, sets: n }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 3);

  // Nutrition
  const m = meals.filter((x) => inWindow(x.eatenAt));
  const mealDays = new Set(m.map((x) => dateKey(x.eatenAt)));
  const totalKcal = m.reduce((sum, x) => sum + (x.calories ?? 0), 0);
  const totalProtein = m.reduce((sum, x) => sum + (x.proteinG ?? 0), 0);
  const daysLogged = mealDays.size;
  const avgCalories = totalKcal > 0 && daysLogged ? Math.round(totalKcal / daysLogged) : null;
  const avgProtein = totalProtein > 0 && daysLogged ? Math.round(totalProtein / daysLogged) : null;

  // Adherence
  const intakesByMed = new Map<string, MedIntake[]>();
  for (const it of intakes) {
    const list = intakesByMed.get(it.medicationId) ?? [];
    list.push(it);
    intakesByMed.set(it.medicationId, list);
  }
  const adherence = meds.map((med) => {
    const list = intakesByMed.get(med.id) ?? [];
    const daysTaken = new Set(list.map((it) => dateKey(it.takenAt))).size;
    return { name: med.name, daysTaken, doses: list.length, rate: days ? daysTaken / days : 0 };
  });

  const report: Omit<WeeklyReport, "markdown"> = {
    rangeStart: startISO,
    rangeEnd: now.toISOString(),
    days,
    training: {
      workouts: w.length,
      daysTrained: new Set(w.map((x) => dateKey(x.performedAt))).size,
      sets,
      volume,
      topExercises,
    },
    nutrition: { meals: m.length, daysLogged, avgCalories, avgProtein },
    adherence,
  };

  return { ...report, markdown: toMarkdown(report) };
}

function toMarkdown(r: Omit<WeeklyReport, "markdown">): string {
  const lines: string[] = [];
  lines.push("# FitCoach weekly report");
  lines.push(`_${fmtDay(r.rangeStart)}–${fmtDay(r.rangeEnd)} (${r.days} days)_`);
  lines.push("");

  lines.push("## Training");
  if (r.training.workouts === 0) {
    lines.push("- No workouts logged this week.");
  } else {
    lines.push(`- ${r.training.workouts} workouts across ${r.training.daysTrained} day(s)`);
    const vol = r.training.volume > 0 ? `, ${r.training.volume.toLocaleString("en-US")} total volume` : "";
    lines.push(`- ${r.training.sets} sets${vol}`);
    if (r.training.topExercises.length) {
      lines.push(
        `- Top: ${r.training.topExercises.map((e) => `${e.exercise} (${e.sets})`).join(", ")}`,
      );
    }
  }
  lines.push("");

  lines.push("## Nutrition");
  if (r.nutrition.meals === 0) {
    lines.push("- No meals logged this week.");
  } else {
    lines.push(`- ${r.nutrition.meals} meals over ${r.nutrition.daysLogged} day(s)`);
    const bits: string[] = [];
    if (r.nutrition.avgCalories != null) bits.push(`~${r.nutrition.avgCalories} kcal/day`);
    if (r.nutrition.avgProtein != null) bits.push(`${r.nutrition.avgProtein}g protein/day`);
    if (bits.length) lines.push(`- ${bits.join(", ")} (avg on logged days)`);
  }
  lines.push("");

  lines.push("## Meds & supplements");
  if (r.adherence.length === 0) {
    lines.push("- Nothing tracked.");
  } else {
    for (const a of r.adherence) {
      lines.push(`- ${a.name}: ${a.daysTaken}/${r.days} days (${Math.round(a.rate * 100)}%)`);
    }
  }

  return lines.join("\n");
}

export async function buildWeeklyReport(userId: string, days = 7): Promise<WeeklyReport> {
  const startISO = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [workouts, meals, meds, intakes] = await Promise.all([
    listWorkouts(userId),
    listMeals(userId),
    listMedications(userId),
    listIntakesSince(userId, startISO),
  ]);
  return computeWeeklyReport(workouts, meals, meds, intakes, days);
}
