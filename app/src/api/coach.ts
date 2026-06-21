import Constants from "expo-constants";

const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? "http://localhost:8787";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AthleteProfile = {
  name?: string;
  goals?: string[];
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  constraints?: string[];
};

export type CoachRequest = {
  intensity: number;
  profile?: AthleteProfile;
  messages: ChatMessage[];
};

export type VoiceProfile = { rate: number; pitch: number };
export type Persona = { intensity: number; label: string; voice: VoiceProfile };

/**
 * Fetch the persona for an intensity: its label (e.g. 9 -> "The Drill Sergeant")
 * and its text-to-speech delivery. The server is the single source of truth for
 * both, so the dial and the voice never drift apart.
 */
export async function fetchPersona(intensity: number): Promise<Persona> {
  const res = await fetch(`${API_BASE_URL}/coach/persona?intensity=${intensity}`);
  if (!res.ok) throw new Error(`persona lookup failed (${res.status})`);
  return (await res.json()) as Persona;
}

/**
 * Stream a coaching reply. Calls `onToken` for each text delta and resolves with the
 * full reply when done.
 *
 * Note: React Native's fetch does not expose a streaming body reader on all platforms.
 * This parses the SSE stream where supported and otherwise falls back to the final
 * "done" event. See docs/ROADMAP.md for the production streaming-transport plan.
 */
export async function streamCoachReply(
  req: CoachRequest,
  onToken: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/coach/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok || !res.body) {
    // Fallback: no streaming body available — read the whole response and pull the
    // last "done" payload out of the SSE text.
    const text = await res.text();
    const full = lastDonePayload(text);
    if (full) onToken(full);
    return full;
  }

  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  // SSE frames are separated by a blank line.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const { event, data } = parseFrame(frame);
      if (!data) continue;
      if (event === "token") {
        const delta = (JSON.parse(data) as { text: string }).text;
        full += delta;
        onToken(delta);
      } else if (event === "done") {
        full = (JSON.parse(data) as { text: string }).text;
      } else if (event === "error") {
        throw new Error((JSON.parse(data) as { message: string }).message);
      }
    }
  }
  return full;
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
