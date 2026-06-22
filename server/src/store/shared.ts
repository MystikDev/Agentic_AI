import type { WorkoutSet, MedicationKind } from "../types.js";

/** Shared shapes and pure helpers used by every storage backend. */

export interface ConversationSummary {
  id: string;
  title: string | null;
  intensity: number | null;
  updated_at: string;
}

export interface Workout {
  id: string;
  performedAt: string;
  notes: string | null;
  sets: WorkoutSet[];
}

export interface Meal {
  id: string;
  eatenAt: string;
  description: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface Medication {
  id: string;
  name: string;
  kind: MedicationKind;
  dosage: string | null;
  schedule: string | null;
  active: boolean;
  /** Doses logged so far today (UTC calendar day). */
  takenToday: number;
  lastTakenAt: string | null;
}

/** A single logged dose, used for reporting over a window. */
export interface MedIntake {
  medicationId: string;
  takenAt: string;
}

/** Start of the current UTC day as an ISO string — the boundary for "taken today". */
export function startOfUtcDay(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** Derive a short conversation title from the first user message. */
export function titleFrom(message: string): string {
  const t = message.trim().replace(/\s+/g, " ");
  return t.length <= 48 ? t : `${t.slice(0, 47)}…`;
}
