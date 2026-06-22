import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { buildWeeklyReport } from "../reports/weekly.js";

export const reportsRouter = Router();

/** GET /reports/weekly?days=7 — a shareable summary of the last N days. */
reportsRouter.get("/weekly", requireAuth, async (req: AuthedRequest, res) => {
  const days = Number(req.query.days ?? 7);
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    return res.status(400).json({ error: "days must be an integer 1–90" });
  }
  try {
    res.json(await buildWeeklyReport(req.userId!, days));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "report failed" });
  }
});
