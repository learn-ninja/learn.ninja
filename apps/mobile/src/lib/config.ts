import Constants from "expo-constants"

/**
 * Where lessons come from: `extra.apiBaseUrl` in app.json, the web dev server by default. The iOS
 * simulator shares the Mac's network, so localhost reaches `npm run dev`. EXPO_PUBLIC_API_BASE_URL
 * overrides it for one run (a dev server on another port).
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  "http://localhost:3000"
).replace(/\/+$/, "")
