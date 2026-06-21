import "dotenv/config";
import express from "express";
import cors from "cors";
import { coachRouter } from "./routes/coach.js";
import { profileRouter } from "./routes/profile.js";
import { conversationsRouter } from "./routes/conversations.js";
import { workoutsRouter } from "./routes/workouts.js";
import { mealsRouter } from "./routes/meals.js";
import { supabaseConfigured } from "./supabase.js";

const app = express();

const allowed = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim());
app.use(cors({ origin: allowed.includes("*") ? true : allowed }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, supabase: supabaseConfigured }));
app.use("/coach", coachRouter);
app.use("/profile", profileRouter);
app.use("/conversations", conversationsRouter);
app.use("/workouts", workoutsRouter);
app.use("/meals", mealsRouter);

const port = Number(process.env.PORT ?? 8787);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "⚠️  ANTHROPIC_API_KEY is not set. Copy server/.env.example to server/.env and add your key.",
  );
}
if (!supabaseConfigured) {
  console.warn(
    "⚠️  Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). " +
      "Auth, profile, and conversation persistence will be unavailable. See docs/SUPABASE.md.",
  );
}

app.listen(port, () => {
  console.log(`🏋️  FitCoach server listening on http://localhost:${port}`);
});
