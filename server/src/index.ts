import "dotenv/config";
import express from "express";
import cors from "cors";
import { coachRouter } from "./routes/coach.js";

const app = express();

const allowed = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim());
app.use(cors({ origin: allowed.includes("*") ? true : allowed }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/coach", coachRouter);

const port = Number(process.env.PORT ?? 8787);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "⚠️  ANTHROPIC_API_KEY is not set. Copy server/.env.example to server/.env and add your key.",
  );
}

app.listen(port, () => {
  console.log(`🏋️  FitCoach server listening on http://localhost:${port}`);
});
