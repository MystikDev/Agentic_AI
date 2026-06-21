import EventSource from "react-native-sse";
import { authHeader } from "../supabase";
import { API_BASE_URL } from "./base";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AthleteProfile = {
  name?: string;
  goals?: string[];
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  constraints?: string[];
};

export type VoiceProfile = { rate: number; pitch: number };
export type Persona = { intensity: number; label: string; voice: VoiceProfile };

export type ConversationSummary = {
  id: string;
  title: string | null;
  intensity: number | null;
  updated_at: string;
};

/**
 * Fetch the persona for an intensity (label + TTS delivery). Public endpoint —
 * no auth required, so the dial labels work even before sign-in.
 */
export async function fetchPersona(intensity: number): Promise<Persona> {
  const res = await fetch(`${API_BASE_URL}/coach/persona?intensity=${intensity}`);
  if (!res.ok) throw new Error(`persona lookup failed (${res.status})`);
  return (await res.json()) as Persona;
}

// ---- Profile (server-backed) ----------------------------------------------

export async function getProfile(): Promise<AthleteProfile> {
  const res = await fetch(`${API_BASE_URL}/profile`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`profile load failed (${res.status})`);
  return (await res.json()) as AthleteProfile;
}

export async function saveProfile(profile: AthleteProfile): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(`profile save failed (${res.status})`);
}

// ---- Conversations ---------------------------------------------------------

export async function listConversations(): Promise<ConversationSummary[]> {
  const res = await fetch(`${API_BASE_URL}/conversations`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`conversations load failed (${res.status})`);
  return ((await res.json()) as { conversations: ConversationSummary[] }).conversations;
}

export async function getConversationMessages(id: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE_URL}/conversations/${id}/messages`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`history load failed (${res.status})`);
  return ((await res.json()) as { messages: ChatMessage[] }).messages;
}

// ---- Coaching turn (streamed) ---------------------------------------------

export type ChatTurn = {
  conversationId?: string;
  intensity: number;
  message: string;
};

export type StreamHandlers = {
  /** Fires once with the (possibly newly created) conversation id. */
  onMeta?: (conversationId: string) => void;
  /** Fires for each streamed text delta. */
  onToken: (delta: string) => void;
};

type CoachEvent = "meta" | "token" | "done" | "coach_error";

/**
 * Send one coaching turn and stream the reply over Server-Sent Events using
 * react-native-sse (XHR-based), which works reliably on iOS, Android, and web —
 * unlike fetch's ReadableStream body, which isn't exposed on all RN platforms.
 *
 * The server loads prior history and the athlete profile itself, so we only send
 * the new message. Resolves with the full reply text.
 */
export function streamCoachTurn(
  turn: ChatTurn,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const es = new EventSource<CoachEvent>(`${API_BASE_URL}/coach/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(turn),
      pollingInterval: 0, // one-shot stream — don't auto-reconnect when it ends
    });

    let full = "";
    let settled = false;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      es.removeAllEventListeners();
      es.close();
      run();
    };

    if (signal) {
      signal.addEventListener("abort", () =>
        finish(() => reject(new DOMException("Aborted", "AbortError"))),
      );
    }

    es.addEventListener("meta", (e) => {
      if (e.data) handlers.onMeta?.((JSON.parse(e.data) as { conversationId: string }).conversationId);
    });

    es.addEventListener("token", (e) => {
      if (!e.data) return;
      const delta = (JSON.parse(e.data) as { text: string }).text;
      full += delta;
      handlers.onToken(delta);
    });

    es.addEventListener("done", (e) => {
      const text = e.data ? (JSON.parse(e.data) as { text: string }).text : full;
      finish(() => resolve(text));
    });

    es.addEventListener("coach_error", (e) => {
      const msg = e.data ? (JSON.parse(e.data) as { message: string }).message : "coaching failed";
      finish(() => reject(new Error(msg)));
    });

    // Reserved transport-level errors (connection refused, non-2xx, timeout).
    es.addEventListener("error", (e) => {
      const msg =
        "message" in e && e.message ? e.message : "could not reach the coach";
      finish(() => reject(new Error(msg)));
    });
  });
}
