// The pure part of Sign in with Apple (apple-sign-in.ts): what the app sends Better Auth's
// /sign-in/social from the credential iOS hands back. The server's side is the `apple` provider in
// apps/web/lib/auth/auth.ts.

/** The parts of expo-apple-authentication's credential this reads. */
export interface AppleCredential {
  identityToken: string | null
  fullName: { givenName: string | null; familyName: string | null } | null
}

export interface AppleIdToken {
  token: string
  /** The nonce itself: iOS put its SHA-256 in the token, and the server hashes this to compare. */
  nonce: string
  /** Apple gives the name only the first time someone signs in to the app. */
  user?: { name: { firstName?: string; lastName?: string } }
}

/** The `idToken` for /sign-in/social, or null when iOS gave no identity token. */
export function appleIdToken(
  credential: AppleCredential,
  nonce: string
): AppleIdToken | null {
  if (!credential.identityToken) return null
  const firstName = credential.fullName?.givenName?.trim() || undefined
  const lastName = credential.fullName?.familyName?.trim() || undefined
  return {
    token: credential.identityToken,
    nonce,
    ...(firstName || lastName ? { user: { name: { firstName, lastName } } } : {}),
  }
}

/** Whether signInAsync failed because the person closed Apple's sheet, which isn't an error. */
export function cancelledApple(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "ERR_REQUEST_CANCELED"
  )
}
