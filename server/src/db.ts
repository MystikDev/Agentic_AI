import { supabase } from "./supabase.js";
import type { AthleteProfile, ChatMessage } from "./types.js";

/**
 * Data access. Every function scopes by userId because the service-role client
 * bypasses row-level security — userId filtering here is the real authorization
 * boundary, with the SQL RLS policies as defense-in-depth.
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

export interface ConversationSummary {
  id: string;
  title: string | null;
  intensity: number | null;
  updated_at: string;
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
  // Bump the conversation so it sorts to the top of the list.
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);
}

/** Derive a short title from the first user message. */
export function titleFrom(message: string): string {
  const t = message.trim().replace(/\s+/g, " ");
  return t.length <= 48 ? t : `${t.slice(0, 47)}…`;
}
