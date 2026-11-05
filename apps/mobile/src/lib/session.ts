import { useEffect } from "react"

import { sendToApi } from "./api"
import { authClient } from "./auth-client"
import { sendFinishes } from "./finishes"
import { deviceStorage } from "./progress-storage"
import { signedIn } from "./progress-sync"

// Who's signed in, from Better Auth's session (kept in the keychain by its Expo client, checked with
// the server on launch and when the app comes back to the front).

export interface Account {
  id: string
  email: string
  /** The profile's handle (/u/{handle}); every account gets one when it's made. */
  handle: string | null
  image: string | null
}

export type SessionState =
  { state: "loading" } | { state: "out" } | { state: "in"; account: Account }

export function useSession(): SessionState {
  const session = authClient.useSession()
  const user = session.data?.user as
    | {
        id: string
        email: string
        handle?: string | null
        image?: string | null
      }
    | undefined
  if (user)
    return {
      state: "in",
      account: {
        id: user.id,
        email: user.email,
        handle: user.handle ?? null,
        image: user.image ?? null,
      },
    }
  return session.isPending ? { state: "loading" } : { state: "out" }
}

/** Re-reads the session from the server, after something changed it (a new handle). */
export const refreshSession = () =>
  authClient.getSession({ query: { disableCookieCache: true } })

export async function signOut() {
  await authClient.signOut().catch(() => {})
}

/**
 * Once the app is signed in (on log-in, or on launch with a kept session): the progress sync
 * starts again and every open lesson sends what the server missed, and the finishes kept while
 * logged out go to the profile, as the web's sendFinishes does on a page that's logged in.
 */
export function SessionEffects() {
  const session = useSession()
  const id = session.state === "in" ? session.account.id : null
  useEffect(() => {
    if (!id) return
    signedIn()
    void sendFinishes(deviceStorage, sendToApi)
  }, [id])
  return null
}
