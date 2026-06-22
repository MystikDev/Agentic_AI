import { CreateWorkoutSchema, CreateMealSchema } from "../types.js";
import {
  createWorkout,
  createMeal,
  createMedication,
  listMedications,
  logIntake,
} from "../store/index.js";
import { z } from "zod";

/**
 * Tools the coach can call to log the athlete's activity from chat — so the user
 * can just say "I did 3x5 squats at 100 and took my creatine" and it's recorded.
 *
 * Schemas are intentionally close to the manual-logging endpoints. The executor
 * validates every input with zod (the model's tool input is untrusted) and only
 * ever writes to the calling user's own data.
 */

export const coachTools = [
  {
    name: "log_workout",
    description:
      "Log a workout the user says they did. One call per workout session; include every set. " +
      "Use ONLY for completed work the user reports — never for plans, suggestions, or hypotheticals.",
    input_schema: {
      type: "object",
      properties: {
        sets: {
          type: "array",
          description: "The sets performed.",
          items: {
            type: "object",
            properties: {
              exercise: { type: "string", description: "Exercise name, e.g. 'Squat'." },
              weight: { type: "number", description: "Weight per rep. Omit for bodyweight." },
              reps: { type: "integer", description: "Reps in the set." },
            },
            required: ["exercise", "reps"],
          },
        },
        notes: { type: "string" },
      },
      required: ["sets"],
    },
  },
  {
    name: "log_meal",
    description:
      "Log a meal the user says they ate. Macros are optional — include them only if the user gives " +
      "them or they're obvious. Use ONLY for food actually eaten, not meal plans.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "What they ate, e.g. 'Chicken & rice'." },
        calories: { type: "integer" },
        proteinG: { type: "number" },
        carbsG: { type: "number" },
        fatG: { type: "number" },
      },
      required: ["description"],
    },
  },
  {
    name: "log_supplement",
    description:
      "Log that the user just took a medication or supplement, by name. If it isn't tracked yet, " +
      "it will be added automatically. Use ONLY when the user says they took it.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name, e.g. 'Creatine' or 'Vitamin D'." },
      },
      required: ["name"],
    },
  },
] as const;

const SupplementSchema = z.object({ name: z.string().min(1).max(120) }).strict();

export interface ToolOutcome {
  /** Returned to the model as the tool_result. */
  result: string;
  /** Short human summary surfaced in the UI (e.g. "Logged workout: Squat 100×5"). */
  summary: string;
}

/** Execute a coach tool call for a user. Validates input; writes only the user's data. */
export async function executeCoachTool(
  userId: string,
  name: string,
  input: unknown,
): Promise<ToolOutcome> {
  switch (name) {
    case "log_workout": {
      const w = CreateWorkoutSchema.parse(input);
      await createWorkout(userId, w);
      const summary =
        "Logged workout: " +
        w.sets
          .map((s) => (s.weight == null ? `${s.exercise} ${s.reps}` : `${s.exercise} ${s.weight}×${s.reps}`))
          .join(", ");
      return { result: summary, summary };
    }
    case "log_meal": {
      const m = CreateMealSchema.parse(input);
      await createMeal(userId, m);
      const summary = `Logged meal: ${m.description}${m.calories != null ? ` (${m.calories} kcal)` : ""}`;
      return { result: summary, summary };
    }
    case "log_supplement": {
      const { name: medName } = SupplementSchema.parse(input);
      const existing = (await listMedications(userId)).find(
        (m) => m.name.toLowerCase() === medName.toLowerCase(),
      );
      const medId = existing ? existing.id : await createMedication(userId, { name: medName, kind: "supplement" });
      await logIntake(userId, medId);
      const summary = `Logged ${medName}${existing ? "" : " (added to your stack)"}`;
      return { result: summary, summary };
    }
    default:
      return { result: `Unknown tool: ${name}`, summary: "" };
  }
}
