import { expoClient, storageAdapter } from "@better-auth/expo/client"
import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import * as SecureStore from "expo-secure-store"

import { API_BASE_URL } from "./config"

// Better Auth's client against the web app's /api/auth, as the web's login page uses it
// (apps/web/lib/auth/browser.ts), with the Expo plugin: it keeps the session cookie in the keychain
// and sends the app's scheme as the origin, which the server trusts (APP_ORIGIN in lib/auth/auth.ts).

const STORAGE_PREFIX = "learn"

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    expoClient({
      scheme: "learnninja",
      storagePrefix: STORAGE_PREFIX,
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
})

/** The session cookie for the app's own API requests ("" when signed out). */
export const sessionCookie = () => authClient.getCookie()

/**
 * Forgets the session on this device without the server: the stored cookie and session cache (the
 * keys the Expo plugin keeps, `{prefix}_cookie` and `{prefix}_session_data`, cleared as it clears
 * them on a sign-out that reaches the server) and the session in memory. For a log-out the server
 * couldn't take (offline, server down): the device is logged out anyway, and the server's session
 * runs out on its own.
 */
export async function forgetSessionLocally() {
  const storage = storageAdapter(SecureStore)
  await storage.setItemAsync(`${STORAGE_PREFIX}_cookie`, "{}")
  await storage.setItemAsync(`${STORAGE_PREFIX}_session_data`, "{}")
  const session = authClient.$store.atoms.session
  session?.set({ ...session.get(), data: null, error: null, isPending: false })
}
