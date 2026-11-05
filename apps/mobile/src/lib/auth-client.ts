import { expoClient } from "@better-auth/expo/client"
import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import * as SecureStore from "expo-secure-store"

import { API_BASE_URL } from "./config"

// Better Auth's client against the web app's /api/auth, as the web's login page uses it
// (apps/web/lib/auth/browser.ts), with the Expo plugin: it keeps the session cookie in the keychain
// and sends the app's scheme as the origin, which the server trusts (APP_ORIGIN in lib/auth/auth.ts).

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    expoClient({
      scheme: "learnninja",
      storagePrefix: "learn",
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
})

/** The session cookie for the app's own API requests ("" when signed out). */
export const sessionCookie = () => authClient.getCookie()
