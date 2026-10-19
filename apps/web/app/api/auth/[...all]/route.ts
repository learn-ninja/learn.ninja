import { toNextJsHandler } from "better-auth/next-js"

import { getAuth } from "@/lib/auth/auth"

// Better Auth's own routes: /api/auth/sign-in/social, /api/auth/email-otp/*, /api/auth/get-session,
// /api/auth/sign-out, and the rest. The CLI calls the email code endpoints directly.

export const { GET, POST } = toNextJsHandler(async (req) =>
  (await getAuth()).handler(req)
)
