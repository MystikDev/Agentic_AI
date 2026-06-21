import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./persona.js";
import type { CoachInvocation } from "../types.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

// Opus 4.8 is the most capable model; the coach benefits from its instruction-following
// and nuanced tone control across the intensity range.
const MODEL = "claude-opus-4-8";

/**
 * Stream a coaching reply. We deliberately keep replies short and skip extended
 * thinking: a coach talking mid-workout needs to respond *fast* (low time-to-first-
 * token), and these turns are conversational rather than hard reasoning problems.
 *
 * `onText` is called with each text delta as it arrives. Returns the final full text.
 */
export async function streamCoachReply(
  req: CoachInvocation,
  onText: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const system = buildSystemPrompt(req.intensity, req.profile);

  const stream = client.messages.stream(
    {
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    },
    { signal },
  );

  stream.on("text", (delta) => onText(delta));

  const final = await stream.finalMessage();
  return final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
