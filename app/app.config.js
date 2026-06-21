// Dynamic Expo config. Lets the API base URL and Supabase keys be injected at
// build time via environment variables (used by the hosted web build), while
// falling back to the static values in app.json for local development.
//
// Expo runs this in Node at build time, so process.env is available here. The app
// code keeps reading Constants.expoConfig.extra — it doesn't touch process.env.

/** Prepend https:// if a host was provided without a scheme (e.g. Render's host property). */
function withScheme(value) {
  if (!value) return undefined;
  return /^https?:\/\//.test(value) ? value : `https://${value}`;
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiBaseUrl: withScheme(process.env.API_BASE_URL) ?? config.extra.apiBaseUrl,
    supabaseUrl: process.env.SUPABASE_URL ?? config.extra.supabaseUrl,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? config.extra.supabaseAnonKey,
  },
});
