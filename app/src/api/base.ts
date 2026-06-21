import Constants from "expo-constants";

/** Base URL of the FitCoach backend, configured in app.json (expo.extra). */
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? "http://localhost:8787";
