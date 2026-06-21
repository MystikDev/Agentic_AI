import { supabaseConfigured } from "../supabase.js";
import * as supa from "./supabase.js";
import * as mem from "./memory.js";

/**
 * Storage facade. Picks the Supabase backend when configured, otherwise an
 * in-memory store so the app runs with just an Anthropic key (demo mode). Routes
 * import from here and stay backend-agnostic.
 */
const impl = supabaseConfigured ? supa : mem;

export const getProfile = impl.getProfile;
export const upsertProfile = impl.upsertProfile;
export const listConversations = impl.listConversations;
export const createConversation = impl.createConversation;
export const ownsConversation = impl.ownsConversation;
export const getMessages = impl.getMessages;
export const appendMessage = impl.appendMessage;
export const createWorkout = impl.createWorkout;
export const listWorkouts = impl.listWorkouts;
export const createMeal = impl.createMeal;
export const listMeals = impl.listMeals;
export const createMedication = impl.createMedication;
export const listMedications = impl.listMedications;
export const ownsMedication = impl.ownsMedication;
export const logIntake = impl.logIntake;

export { titleFrom } from "./shared.js";
export type { ConversationSummary, Workout, Meal, Medication } from "./shared.js";
