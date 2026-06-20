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

export const CoachRequestSchema = z
  .object({
    intensity: IntensitySchema,
    profile: AthleteProfileSchema.optional(),
    /** Full prior conversation (the API is stateless; client resends history). */
    messages: z.array(ChatMessageSchema).min(1).max(100),
  })
  .strict();

export type Intensity = z.infer<typeof IntensitySchema>;
export type AthleteProfile = z.infer<typeof AthleteProfileSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type CoachRequest = z.infer<typeof CoachRequestSchema>;
