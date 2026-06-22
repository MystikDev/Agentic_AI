import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./persona.js";
import { coachTools } from "./tools.js";
import type { CoachInvocation } from "../types.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

// Opus 4.8 is the most capable model; the coach benefits from its instruction-following
// and nuanced tone control across the intensity range.
const MODEL = "claude-opus-4-8";

const MAX_TOOL_TURNS = 6; // safety cap on the log → continue loop

export interface ToolOutcome {
  result: string;
  summary: string;
}

export interface CoachHandlers {
  /** Each streamed text delta. */
  onText: (delta: string) => void;
  /** A short summary when the coach logs something (for the UI). */
  onTool?: (summary: string) => void;
  /** Execute a tool the coach called; return the result for the model + a UI summary. */
  runTool?: (name: string, input: unknown) => Promise<ToolOutcome>;
}

/**
 * Stream a coaching reply, running an agentic loop when tools are enabled so the
 * coach can log workouts/meals/supplements mid-conversation and then keep talking.
 * Replies stay short and thinking is off — a coach mid-workout needs low latency.
 *
 * Returns the full assistant text (all text across turns) for persistence.
 */
export async function streamCoachReply(
  req: CoachInvocation,
  handlers: CoachHandlers,
  signal?: AbortSignal,
): Promise<string> {
  const system = buildSystemPrompt(req.intensity, req.profile, req.context, Boolean(handlers.runTool));
  const messages: Anthropic.MessageParam[] = req.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let fullText = "";

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 1024,
        system,
        messages,
        ...(handlers.runTool ? { tools: coachTools as unknown as Anthropic.Tool[] } : {}),
      },
      { signal },
    );

    stream.on("text", (delta) => {
      fullText += delta;
      handlers.onText(delta);
    });

    const final = await stream.finalMessage();

    if (final.stop_reason !== "tool_use" || !handlers.runTool) {
      break;
    }

    // Carry the assistant turn (text + tool_use blocks) forward, then answer each tool.
    messages.push({ role: "assistant", content: final.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type !== "tool_use") continue;
      let outcome: ToolOutcome;
      try {
        outcome = await handlers.runTool(block.name, block.input);
      } catch (err) {
        outcome = {
          result: `Error: ${err instanceof Error ? err.message : "could not log that"}`,
          summary: "",
        };
      }
      if (outcome.summary) handlers.onTool?.(outcome.summary);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: outcome.result,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return fullText;
}
