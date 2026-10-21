import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthPanel, LegalConsent } from "@/components/account/auth-panel"
import { LoginForm } from "@/components/account/login-form"
import { githubFromEnv } from "@/lib/auth/auth"
import { currentActor, oauthResume, safeCallback } from "@/lib/auth/session"

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to keep lessons beyond 7 days.",
  robots: { index: false },
}

// Always rendered per request: these pages read the session, and the lesson store, which don't
// exist on a build machine.
export const dynamic = "force-dynamic"

/**
 * GitHub or an email code; `?callback=` says where to go afterwards (the /keep link uses it). A
 * chat app logging in over OAuth arrives with the authorize request in the query instead, and goes
 * back into it (then to /consent) once logged in. Drawn in the same bare panel as /consent, so
 * connecting an app looks like one flow.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const resume = oauthResume(params)
  const callback = resume ?? safeCallback(params.callback)
  if (await currentActor()) redirect(callback)
  return (
    <AuthPanel footer={<LegalConsent />}>
      <LoginForm
        github={githubFromEnv() !== null}
        callback={callback}
        pickHandle={resume === null}
        {...(resume && {
          title: "Log in to connect your app",
          description:
            "An agent wants to publish lessons to your account. Log in, then you’ll be asked to allow it.",
        })}
      />
    </AuthPanel>
  )
}
