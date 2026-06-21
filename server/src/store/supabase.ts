import { supabase } from "../supabase.js";
import type {
  AthleteProfile,
  ChatMessage,
  CreateWorkout,
  WorkoutSet,
  CreateMeal,
  CreateMedication,
  MedicationKind,
} from "../types.js";
import type { ConversationSummary, Workout, Meal, Medication } from "./shared.js";
import { startOfUtcDay } from "./shared.js";

/**
 * Supabase-backed storage. Every function scopes by userId because the
 * service-role client bypasses row-level security — userId filtering here is the
 * real authorization boundary, with the SQL RLS policies as defense-in-depth.
 */

export async function getProfile(userId: string): Promise<AthleteProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("name, experience_level, goals, constraints")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    name: data.name ?? undefined,
    experienceLevel: data.experience_level ?? undefined,
    goals: data.goals ?? [],
    constraints: data.constraints ?? [],
  };
}

export async function upsertProfile(userId: string, p: AthleteProfile): Promise<void> {
  const { error } = await supabase.from("profiles").upsert({
    user_id: userId,
    name: p.name ?? null,
    experience_level: p.experienceLevel ?? null,
    goals: p.goals ?? [],
    constraints: p.constraints ?? [],
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, intensity, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ConversationSummary[];
}

export async function createConversation(
  userId: string,
  intensity: number,
  title: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, intensity, title })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function ownsConversation(userId: string, conversationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function getMessages(
  userId: string,
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({ role: m.role, content: m.content })) as ChatMessage[];
}

export async function appendMessage(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .insert({ user_id: userId, conversation_id: conversationId, role, content });
  if (error) throw new Error(error.message);
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);
}

export async function createWorkout(userId: string, w: CreateWorkout): Promise<string> {
  const { data, error } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      performed_at: w.performedAt ?? new Date().toISOString(),
      notes: w.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const workoutId = data.id as string;

  const rows = w.sets.map((s, i) => ({
    workout_id: workoutId,
    user_id: userId,
    exercise: s.exercise,
    weight: s.weight ?? null,
    reps: s.reps,
    position: i,
  }));
  const { error: setsError } = await supabase.from("workout_sets").insert(rows);
  if (setsError) {
    await supabase.from("workouts").delete().eq("id", workoutId).eq("user_id", userId);
    throw new Error(setsError.message);
  }
  return workoutId;
}

export async function listWorkouts(userId: string, limit = 50): Promise<Workout[]> {
  const { data: workouts, error } = await supabase
    .from("workouts")
    .select("id, performed_at, notes")
    .eq("user_id", userId)
    .order("performed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!workouts?.length) return [];

  const ids = workouts.map((w) => w.id as string);
  const { data: sets, error: setsError } = await supabase
    .from("workout_sets")
    .select("workout_id, exercise, weight, reps, position")
    .eq("user_id", userId)
    .in("workout_id", ids)
    .order("position", { ascending: true });
  if (setsError) throw new Error(setsError.message);

  const byWorkout = new Map<string, WorkoutSet[]>();
  for (const s of sets ?? []) {
    const list = byWorkout.get(s.workout_id) ?? [];
    list.push({
      exercise: s.exercise,
      weight: s.weight == null ? undefined : Number(s.weight),
      reps: s.reps,
    });
    byWorkout.set(s.workout_id, list);
  }

  return workouts.map((w) => ({
    id: w.id as string,
    performedAt: w.performed_at as string,
    notes: (w.notes as string | null) ?? null,
    sets: byWorkout.get(w.id as string) ?? [],
  }));
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export async function createMeal(userId: string, m: CreateMeal): Promise<string> {
  const { data, error } = await supabase
    .from("meals")
    .insert({
      user_id: userId,
      eaten_at: m.eatenAt ?? new Date().toISOString(),
      description: m.description,
      calories: m.calories ?? null,
      protein_g: m.proteinG ?? null,
      carbs_g: m.carbsG ?? null,
      fat_g: m.fatG ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function listMeals(userId: string, limit = 100): Promise<Meal[]> {
  const { data, error } = await supabase
    .from("meals")
    .select("id, eaten_at, description, calories, protein_g, carbs_g, fat_g")
    .eq("user_id", userId)
    .order("eaten_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id as string,
    eatenAt: m.eaten_at as string,
    description: m.description as string,
    calories: num(m.calories),
    proteinG: num(m.protein_g),
    carbsG: num(m.carbs_g),
    fatG: num(m.fat_g),
  }));
}

export async function createMedication(userId: string, m: CreateMedication): Promise<string> {
  const { data, error } = await supabase
    .from("medications")
    .insert({
      user_id: userId,
      name: m.name,
      kind: m.kind,
      dosage: m.dosage ?? null,
      schedule: m.schedule ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function listMedications(userId: string): Promise<Medication[]> {
  const { data: meds, error } = await supabase
    .from("medications")
    .select("id, name, kind, dosage, schedule, active")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!meds?.length) return [];

  const ids = meds.map((m) => m.id as string);
  const { data: intakes, error: intakesError } = await supabase
    .from("medication_intakes")
    .select("medication_id, taken_at")
    .eq("user_id", userId)
    .in("medication_id", ids)
    .order("taken_at", { ascending: false })
    .limit(1000);
  if (intakesError) throw new Error(intakesError.message);

  const dayStart = startOfUtcDay();
  const takenToday = new Map<string, number>();
  const lastTaken = new Map<string, string>();
  for (const it of intakes ?? []) {
    const medId = it.medication_id as string;
    const at = it.taken_at as string;
    if (!lastTaken.has(medId)) lastTaken.set(medId, at); // first seen = most recent
    if (at >= dayStart) takenToday.set(medId, (takenToday.get(medId) ?? 0) + 1);
  }

  return meds.map((m) => ({
    id: m.id as string,
    name: m.name as string,
    kind: m.kind as MedicationKind,
    dosage: (m.dosage as string | null) ?? null,
    schedule: (m.schedule as string | null) ?? null,
    active: m.active as boolean,
    takenToday: takenToday.get(m.id as string) ?? 0,
    lastTakenAt: lastTaken.get(m.id as string) ?? null,
  }));
}

export async function ownsMedication(userId: string, medicationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("medications")
    .select("id")
    .eq("id", medicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function logIntake(userId: string, medicationId: string): Promise<void> {
  const { error } = await supabase
    .from("medication_intakes")
    .insert({ user_id: userId, medication_id: medicationId });
  if (error) throw new Error(error.message);
}
