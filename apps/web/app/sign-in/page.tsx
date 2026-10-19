import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SignInForm } from "@/components/account/sign-in-form"
import { AccountPage } from "@/components/account/account-page"
import { githubFromEnv } from "@/lib/auth/auth"
import { currentActor, safeCallback } from "@/lib/auth/session"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to keep lessons beyond 7 days.",
  robots: { index: false },
}

// Always rendered per request: these pages read the session, and the lesson store, which don't
// exist on a build machine.
export const dynamic = "force-dynamic"

/** GitHub or an email code; `?callback=` says where to go afterwards (the /keep link uses it). */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callback?: string | string[] }>
}) {
  const callback = safeCallback((await searchParams).callback)
  if (await currentActor()) redirect(callback)
  return (
    <AccountPage account={null}>
      <SignInForm github={githubFromEnv() !== null} callback={callback} />
    </AccountPage>
  )
}
