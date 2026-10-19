import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/** The browser side of Better Auth, for the sign-in and settings pages. */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
})
