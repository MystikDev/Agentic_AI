import { z } from "zod";

/**
 * Intensity is the product's signature dial: 1 = calm, supportive guide;
 * 10 = full drill-sergeant. Everything about the coach's voice is derived from it.
 */
export const IntensitySchema = z.number().int().min(1).max(10);

/** Optional context the app knows about the athlete. All fields optional so v1 can ship thin. */
export const AthleteProfileSchema = z
  .object({
    name: z.string().max(60).optional(),
    goals: z.array(z.string().max(200)).max(10).optional(),
    experienceLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    /** Free-text limitations/injuries the coach must respect (e.g. "bad left knee"). */
    constraints: z.array(z.string().max(200)).max(10).optional(),
  })
  .strict();

export const ChatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(8000),
  })
  .strict();

/**
 * A single coaching turn. The client sends only the new user message plus the
 * conversation it belongs to (omit to start a new one); prior history and the
 * athlete profile are loaded server-side from the database.
 */
export const ChatTurnSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    intensity: IntensitySchema,
    message: z.string().min(1).max(8000),
  })
  .strict();

export type Intensity = z.infer<typeof IntensitySchema>;
export type AthleteProfile = z.infer<typeof AthleteProfileSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

/** What the model layer needs to produce a reply (assembled from DB + request). */
export interface CoachInvocation {
  intensity: Intensity;
  profile?: AthleteProfile;
  messages: ChatMessage[];
  /** Optional snapshot of the athlete's recent logged activity. */
  context?: string;
}

// ---- Workout logging -------------------------------------------------------

export const WorkoutSetSchema = z
  .object({
    exercise: z.string().min(1).max(80),
    /** Omit for bodyweight movements. */
    weight: z.number().min(0).max(2000).optional(),
    reps: z.number().int().min(1).max(1000),
  })
  .strict();

export const CreateWorkoutSchema = z
  .object({
    /** ISO timestamp; defaults to now on the server. */
    performedAt: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
    sets: z.array(WorkoutSetSchema).min(1).max(100),
  })
  .strict();

export type WorkoutSet = z.infer<typeof WorkoutSetSchema>;
export type CreateWorkout = z.infer<typeof CreateWorkoutSchema>;

// ---- Diet logging ----------------------------------------------------------

export const CreateMealSchema = z
  .object({
    /** ISO timestamp; defaults to now on the server. */
    eatenAt: z.string().datetime().optional(),
    description: z.string().min(1).max(200),
    calories: z.number().int().min(0).max(20000).optional(),
    proteinG: z.number().min(0).max(2000).optional(),
    carbsG: z.number().min(0).max(2000).optional(),
    fatG: z.number().min(0).max(2000).optional(),
  })
  .strict();

export type CreateMeal = z.infer<typeof CreateMealSchema>;

// ---- Medications & supplements ---------------------------------------------

export const MedicationKindSchema = z.enum(["medication", "supplement"]);

export const CreateMedicationSchema = z
  .object({
    name: z.string().min(1).max(120),
    kind: MedicationKindSchema.default("supplement"),
    dosage: z.string().max(80).optional(),
    schedule: z.string().max(120).optional(),
  })
  .strict();

export type MedicationKind = z.infer<typeof MedicationKindSchema>;
export type CreateMedication = z.infer<typeof CreateMedicationSchema>;
