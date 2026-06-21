import type { WorkoutSet } from "../types.js";

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

/** Derive a short conversation title from the first user message. */
export function titleFrom(message: string): string {
  const t = message.trim().replace(/\s+/g, " ");
  return t.length <= 48 ? t : `${t.slice(0, 47)}…`;
}
