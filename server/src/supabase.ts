import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabaseConfigured = Boolean(url && serviceKey);

/**
 * Admin client, authenticated with the service-role key. It bypasses row-level
 * security, so EVERY query in db.ts must scope by user_id explicitly. This client
 * is server-only and must never be exposed to the app.
 *
 * When the project isn't configured we still construct a client (with harmless
 * placeholders) so the server boots — createClient throws on empty values. Any
 * real call is gated behind `supabaseConfigured` / `requireAuth`, which return a
 * 503 before this client is ever used.
 */
export const supabase = createClient(
  url || "http://localhost:54321",
  serviceKey || "placeholder-key",
  { auth: { persistSession: false, autoRefreshToken: false } },
);
