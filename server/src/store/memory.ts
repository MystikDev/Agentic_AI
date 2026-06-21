import { randomUUID } from "node:crypto";
import type { AthleteProfile, ChatMessage, CreateWorkout, CreateMeal } from "../types.js";
import type { ConversationSummary, Workout, Meal } from "./shared.js";

/**
 * In-memory storage for demo / no-Supabase mode. Lets the app run with only an
 * Anthropic API key so the product can be tried and reviewed without standing up
 * a database. Data lives in process memory and resets when the server restarts.
 *
 * Mirrors the Supabase store's signatures exactly so routes are backend-agnostic.
 */

const profiles = new Map<string, AthleteProfile>();

interface ConvRecord {
  id: string;
  userId: string;
  title: string | null;
  intensity: number | null;
  updatedAt: string;
}
const conversations = new Map<string, ConvRecord>();
const messages = new Map<string, ChatMessage[]>(); // conversationId -> messages

interface WorkoutRecord extends Workout {
  userId: string;
}
const workouts: WorkoutRecord[] = [];

interface MealRecord extends Meal {
  userId: string;
}
const meals: MealRecord[] = [];

export async function getProfile(userId: string): Promise<AthleteProfile | null> {
  return profiles.get(userId) ?? null;
}

export async function upsertProfile(userId: string, p: AthleteProfile): Promise<void> {
  profiles.set(userId, p);
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  return [...conversations.values()]
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((c) => ({ id: c.id, title: c.title, intensity: c.intensity, updated_at: c.updatedAt }));
}

export async function createConversation(
  userId: string,
  intensity: number,
  title: string | null,
): Promise<string> {
  const id = randomUUID();
  conversations.set(id, { id, userId, title, intensity, updatedAt: new Date().toISOString() });
  messages.set(id, []);
  return id;
}

export async function ownsConversation(userId: string, conversationId: string): Promise<boolean> {
  return conversations.get(conversationId)?.userId === userId;
}

export async function getMessages(
  userId: string,
  conversationId: string,
): Promise<ChatMessage[]> {
  if (conversations.get(conversationId)?.userId !== userId) return [];
  return [...(messages.get(conversationId) ?? [])];
}

export async function appendMessage(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const conv = conversations.get(conversationId);
  if (!conv || conv.userId !== userId) return;
  const list = messages.get(conversationId) ?? [];
  list.push({ role, content });
  messages.set(conversationId, list);
  conv.updatedAt = new Date().toISOString();
}

export async function createWorkout(userId: string, w: CreateWorkout): Promise<string> {
  const id = randomUUID();
  workouts.push({
    id,
    userId,
    performedAt: w.performedAt ?? new Date().toISOString(),
    notes: w.notes ?? null,
    sets: w.sets.map((s) => ({ exercise: s.exercise, weight: s.weight, reps: s.reps })),
  });
  return id;
}

export async function listWorkouts(userId: string, limit = 50): Promise<Workout[]> {
  return workouts
    .filter((w) => w.userId === userId)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
    .slice(0, limit)
    .map(({ id, performedAt, notes, sets }) => ({ id, performedAt, notes, sets }));
}

export async function createMeal(userId: string, m: CreateMeal): Promise<string> {
  const id = randomUUID();
  meals.push({
    id,
    userId,
    eatenAt: m.eatenAt ?? new Date().toISOString(),
    description: m.description,
    calories: m.calories ?? null,
    proteinG: m.proteinG ?? null,
    carbsG: m.carbsG ?? null,
    fatG: m.fatG ?? null,
  });
  return id;
}

export async function listMeals(userId: string, limit = 100): Promise<Meal[]> {
  return meals
    .filter((m) => m.userId === userId)
    .sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))
    .slice(0, limit)
    .map(({ id, eatenAt, description, calories, proteinG, carbsG, fatG }) => ({
      id,
      eatenAt,
      description,
      calories,
      proteinG,
      carbsG,
      fatG,
    }));
}
