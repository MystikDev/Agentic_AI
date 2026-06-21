import { authHeader } from "../supabase";
import { API_BASE_URL } from "./base";

export type WorkoutSet = {
  exercise: string;
  weight?: number; // omit for bodyweight
  reps: number;
};

export type Workout = {
  id: string;
  performedAt: string;
  notes: string | null;
  sets: WorkoutSet[];
};

export type NewWorkout = {
  performedAt?: string;
  notes?: string;
  sets: WorkoutSet[];
};

export async function listWorkouts(): Promise<Workout[]> {
  const res = await fetch(`${API_BASE_URL}/workouts`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`workouts load failed (${res.status})`);
  return ((await res.json()) as { workouts: Workout[] }).workouts;
}

export async function createWorkout(workout: NewWorkout): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/workouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(workout),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = ((await res.json()) as { error?: string }).error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`could not save workout: ${detail}`);
  }
  return ((await res.json()) as { id: string }).id;
}
