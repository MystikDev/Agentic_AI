import { Router } from "express";
import { CreateMealSchema } from "../types.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { createMeal, listMeals } from "../store/index.js";

export const mealsRouter = Router();

/** GET /meals — the athlete's logged meals, most recent first. */
mealsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    res.json({ meals: await listMeals(req.userId!) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "load failed" });
  }
});

/** POST /meals — log a meal (description + optional macros). */
mealsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = CreateMealSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid meal", details: parsed.error.flatten() });
  }
  try {
    const id = await createMeal(req.userId!, parsed.data);
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "save failed" });
  }
});
