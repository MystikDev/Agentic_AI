import { Router } from "express";
import { CoachRequestSchema } from "../types.js";
import { streamCoachReply } from "../coach/chat.js";
import { personaLabel } from "../coach/persona.js";

export const coachRouter = Router();

/**
 * GET /coach/persona?intensity=7
 * Lightweight helper so the app can label the intensity dial without a model call.
 */
coachRouter.get("/persona", (req, res) => {
  const intensity = Number(req.query.intensity);
  if (!Number.isInteger(intensity) || intensity < 1 || intensity > 10) {
    return res.status(400).json({ error: "intensity must be an integer 1–10" });
  }
  res.json({ intensity, label: personaLabel(intensity) });
});

/**
 * POST /coach/chat
 * Body: CoachRequest. Streams the coach's reply back as Server-Sent Events:
 *   event: token  data: {"text": "..."}    (many)
 *   event: done   data: {"text": "<full reply>"}
 *   event: error  data: {"message": "..."}
 */
coachRouter.post("/chat", async (req, res) => {
  const parsed = CoachRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.flatten() });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const controller = new AbortController();
  // If the client disconnects mid-stream, stop paying for tokens.
  req.on("close", () => controller.abort());

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const full = await streamCoachReply(
      parsed.data,
      (delta) => send("token", { text: delta }),
      controller.signal,
    );
    send("done", { text: full });
  } catch (err) {
    if (!controller.signal.aborted) {
      const message = err instanceof Error ? err.message : "coaching failed";
      send("error", { message });
    }
  } finally {
    res.end();
  }
});
