import Constants from "expo-constants";
import { authHeader } from "../supabase";

const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? "http://localhost:8787";

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

/**
 * Send one coaching turn and stream the reply. The server loads prior history and
 * the athlete profile itself, so we only send the new message.
 *
 * Note: React Native's fetch doesn't expose a streaming body on all platforms.
 * Where it doesn't, we fall back to the final "done" payload. Production streaming
 * transport (react-native-sse / WebSocket) is tracked in docs/ROADMAP.md.
 */
export async function streamCoachTurn(
  turn: ChatTurn,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/coach/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(await authHeader()),
    },
    body: JSON.stringify(turn),
    signal,
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = ((await res.json()) as { error?: string }).error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`coach error: ${detail}`);
  }

  if (!res.body) {
    const text = await res.text();
    applyFrames(text, handlers);
    return lastDonePayload(text);
  }

  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      full = handleFrame(frame, handlers, full);
    }
  }
  return full;
}

function handleFrame(frame: string, handlers: StreamHandlers, full: string): string {
  const { event, data } = parseFrame(frame);
  if (!data) return full;
  if (event === "meta") {
    handlers.onMeta?.((JSON.parse(data) as { conversationId: string }).conversationId);
  } else if (event === "token") {
    const delta = (JSON.parse(data) as { text: string }).text;
    handlers.onToken(delta);
    return full + delta;
  } else if (event === "done") {
    return (JSON.parse(data) as { text: string }).text;
  } else if (event === "error") {
    throw new Error((JSON.parse(data) as { message: string }).message);
  }
  return full;
}

function applyFrames(sse: string, handlers: StreamHandlers): void {
  let full = "";
  for (const frame of sse.split("\n\n")) full = handleFrame(frame, handlers, full);
}

function parseFrame(frame: string): { event: string; data: string } {
  let event = "message";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  return { event, data };
}

function lastDonePayload(sse: string): string {
  const frames = sse.split("\n\n");
  for (let i = frames.length - 1; i >= 0; i--) {
    const { event, data } = parseFrame(frames[i]);
    if (event === "done" && data) {
      try {
        return (JSON.parse(data) as { text: string }).text;
      } catch {
        /* ignore */
      }
    }
  }
  return "";
}
