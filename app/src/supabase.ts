// URL polyfill must be imported before supabase-js in React Native.
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const url = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? "";
const anonKey = (Constants.expoConfig?.extra?.supabaseAnonKey as string) ?? "";

export const supabaseConfigured =
  Boolean(url && anonKey) && !url.includes("YOUR-PROJECT");

/**
 * App-side Supabase client. The anon key is public and safe to ship — row-level
 * security and our backend enforce access. The session is persisted in
 * AsyncStorage and auto-refreshed; `detectSessionInUrl` is off (no web redirect
 * flow in the native app).
 */
export const supabase = createClient(
  url || "http://localhost:54321",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/** Bearer header for calls to our own backend. Empty when signed out. */
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
