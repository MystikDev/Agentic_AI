import { Router } from "express";
import { ChatTurnSchema } from "../types.js";
import { streamCoachReply } from "../coach/chat.js";
import { personaLabel, voiceProfile } from "../coach/persona.js";
import { buildAthleteContext } from "../coach/context.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import {
  getProfile,
  getMessages,
  appendMessage,
  createConversation,
  ownsConversation,
  titleFrom,
} from "../store/index.js";

export const coachRouter = Router();

/**
 * GET /coach/persona?intensity=7  (public — no account needed)
 * Lightweight helper so the app can label the intensity dial and pick the matching
 * text-to-speech delivery, without a model call. Keeps persona definitions in one
 * place (the server) rather than duplicated in the client.
 */
coachRouter.get("/persona", (req, res) => {
  const intensity = Number(req.query.intensity);
  if (!Number.isInteger(intensity) || intensity < 1 || intensity > 10) {
    return res.status(400).json({ error: "intensity must be an integer 1–10" });
  }
  res.json({ intensity, label: personaLabel(intensity), voice: voiceProfile(intensity) });
});

/**
 * POST /coach/chat  (auth required)
 * Body: ChatTurn (conversationId?, intensity, message).
 *
 * The server owns conversation state: it loads prior history and the athlete
 * profile from the database, persists the new user message and the assistant
 * reply, and streams the reply back as Server-Sent Events:
 *   event: meta         data: {"conversationId": "..."}   (once, first)
 *   event: token        data: {"text": "..."}             (many)
 *   event: done         data: {"text": "<full reply>"}
 *   event: coach_error  data: {"message": "..."}
 *
 * The error event is named `coach_error` (not `error`) so it doesn't collide with
 * the reserved transport-error event in the app's SSE client.
 */
coachRouter.post("/chat", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = ChatTurnSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.flatten() });
  }
  const userId = req.userId!;
  const { intensity, message } = parsed.data;

  // Resolve the conversation (validate ownership, or start a new one) before we
  // open the SSE stream so we can still return a clean JSON error.
  let conversationId = parsed.data.conversationId;
  try {
    if (conversationId) {
      if (!(await ownsConversation(userId, conversationId))) {
        return res.status(404).json({ error: "conversation not found" });
      }
    } else {
      conversationId = await createConversation(userId, intensity, titleFrom(message));
    }
  } catch (err) {
    const m = err instanceof Error ? err.message : "could not open conversation";
    return res.status(500).json({ error: m });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send("meta", { conversationId });

    const [profile, history, context] = await Promise.all([
      getProfile(userId),
      getMessages(userId, conversationId),
      buildAthleteContext(userId),
    ]);
    await appendMessage(userId, conversationId, "user", message);

    const full = await streamCoachReply(
      {
        intensity,
        profile: profile ?? undefined,
        messages: [...history, { role: "user", content: message }],
        context,
      },
      (delta) => send("token", { text: delta }),
      controller.signal,
    );

    if (!controller.signal.aborted) {
      await appendMessage(userId, conversationId, "assistant", full);
      send("done", { text: full });
    }
  } catch (err) {
    if (!controller.signal.aborted) {
      const message = err instanceof Error ? err.message : "coaching failed";
      send("coach_error", { message });
    }
  } finally {
    res.end();
  }
});
