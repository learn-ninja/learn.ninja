import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SignInForm } from "@/components/account/sign-in-form"
import { AccountPage } from "@/components/account/account-page"
import { githubFromEnv } from "@/lib/auth/auth"
import { currentActor, oauthResume, safeCallback } from "@/lib/auth/session"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to keep lessons beyond 7 days.",
  robots: { index: false },
}

// Always rendered per request: these pages read the session, and the lesson store, which don't
// exist on a build machine.
export const dynamic = "force-dynamic"

/**
 * GitHub or an email code; `?callback=` says where to go afterwards (the /keep link uses it). A
 * chat app signing in over OAuth arrives with the authorize request in the query instead, and goes
 * back into it (then to /consent) once signed in.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const resume = oauthResume(params)
  const callback = resume ?? safeCallback(params.callback)
  if (await currentActor()) redirect(callback)
  return (
    <AccountPage account={null}>
      {resume && (
        <p className="text-sm text-muted-foreground">
          A chat app wants to save lessons to your learn.ninja account. Sign in
          to continue; you&apos;ll be asked to allow it next.
        </p>
      )}
      <SignInForm
        github={githubFromEnv() !== null}
        callback={callback}
        pickHandle={resume === null}
      />
    </AccountPage>
  )
}
