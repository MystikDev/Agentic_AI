import { Router } from "express";
import { AthleteProfileSchema } from "../types.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { getProfile, upsertProfile } from "../db.js";

export const profileRouter = Router();

/** GET /profile — the signed-in athlete's profile (empty object if none yet). */
profileRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const profile = await getProfile(req.userId!);
    res.json(profile ?? {});
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "load failed" });
  }
});

/** PUT /profile — create or update the signed-in athlete's profile. */
profileRouter.put("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = AthleteProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid profile", details: parsed.error.flatten() });
  }
  try {
    await upsertProfile(req.userId!, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "save failed" });
  }
});
