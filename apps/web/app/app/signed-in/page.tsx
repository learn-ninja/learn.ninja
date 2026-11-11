import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthHeading, AuthPanel } from "@/components/account/auth-panel"
import { burnAppCode } from "@/lib/auth/app-github"
import { getAuth } from "@/lib/auth/auth"

export const metadata: Metadata = {
  title: "Back to the app",
  robots: { index: false },
  // The URL can hold a one-time log-in code: never sent on to another page.
  referrer: "no-referrer",
}

/**
 * Where the iOS app's GitHub log-in ends (lib/auth/app-github.ts). The app's sign-in sheet takes
 * this URL before it loads, so a browser only shows this page when the log-in didn't start in the
 * app. A code that comes with it is burned at once and dropped from the address bar, so it can't
 * be shared with whoever sent the link.
 */
export default async function AppSignedInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { code, error } = await searchParams
  if (code !== undefined) {
    if (typeof code === "string") await burnAppCode(await getAuth(), code)
    redirect(error ? "/app/signed-in?error=1" : "/app/signed-in")
  }
  return (
    <AuthPanel>
      {error ? (
        <AuthHeading title="GitHub didn’t log you in">
          Go back to the learn.ninja app and try again.
        </AuthHeading>
      ) : (
        <AuthHeading title="Back to the app">
          Log in from the learn.ninja app on your iPhone. This page only
          finishes a log-in the app started.
        </AuthHeading>
      )}
    </AuthPanel>
  )
}
