import { Router } from "express";
import { CreateMedicationSchema } from "../types.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { createMedication, listMedications, ownsMedication, logIntake } from "../store/index.js";

export const medicationsRouter = Router();

/** GET /medications — active meds/supplements with today's intake count. */
medicationsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    res.json({ medications: await listMedications(req.userId!) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "load failed" });
  }
});

/** POST /medications — add a medication or supplement to track. */
medicationsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = CreateMedicationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid medication", details: parsed.error.flatten() });
  }
  try {
    const id = await createMedication(req.userId!, parsed.data);
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "save failed" });
  }
});

/** POST /medications/:id/intakes — log that a dose was taken now. */
medicationsRouter.post("/:id/intakes", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const id = String(req.params.id);
  try {
    if (!(await ownsMedication(userId, id))) {
      return res.status(404).json({ error: "medication not found" });
    }
    await logIntake(userId, id);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "save failed" });
  }
});
