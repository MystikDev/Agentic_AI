import type { Request, Response, NextFunction } from "express";
import { supabase, supabaseConfigured } from "./supabase.js";

/** Express request carrying the authenticated Supabase user id. */
export interface AuthedRequest extends Request {
  userId?: string;
}

/**
 * Verify the caller's Supabase access token (sent as `Authorization: Bearer …`)
 * and attach the user id to the request. We validate by asking Supabase about the
 * token, which works regardless of the project's JWT signing algorithm. For high
 * traffic this can later be swapped for local JWKS verification to avoid the round
 * trip — see docs/SUPABASE.md.
 */
/** Fixed user id used for all requests when running without Supabase (demo mode). */
export const DEMO_USER_ID = "demo-user";

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Demo mode: no Supabase configured → run as a single shared demo user so the
  // app is usable with just an Anthropic key. See docs/SUPABASE.md / README.
  if (!supabaseConfigured) {
    req.userId = DEMO_USER_ID;
    next();
    return;
  }

  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "invalid or expired token" });
    return;
  }

  req.userId = data.user.id;
  next();
}
