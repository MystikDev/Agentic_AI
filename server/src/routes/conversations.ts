import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { listConversations, getMessages, ownsConversation } from "../store/index.js";

export const conversationsRouter = Router();

/** GET /conversations — the athlete's conversations, most recently updated first. */
conversationsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    res.json({ conversations: await listConversations(req.userId!) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "load failed" });
  }
});

/** GET /conversations/:id/messages — full message history for one conversation. */
conversationsRouter.get("/:id/messages", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const id = String(req.params.id);
  try {
    if (!(await ownsConversation(userId, id))) {
      return res.status(404).json({ error: "conversation not found" });
    }
    res.json({ messages: await getMessages(userId, id) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "load failed" });
  }
});
