import { Router } from "express";
import { CreateWorkoutSchema } from "../types.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { createWorkout, listWorkouts } from "../db.js";

export const workoutsRouter = Router();

/** GET /workouts — the athlete's logged workouts (most recent first), with sets. */
workoutsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    res.json({ workouts: await listWorkouts(req.userId!) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "load failed" });
  }
});

/** POST /workouts — log a workout (a session of one or more sets). */
workoutsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = CreateWorkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid workout", details: parsed.error.flatten() });
  }
  try {
    const id = await createWorkout(req.userId!, parsed.data);
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "save failed" });
  }
});
