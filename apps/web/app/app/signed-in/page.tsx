import type { Metadata } from "next"

import { AuthHeading, AuthPanel } from "@/components/account/auth-panel"

export const metadata: Metadata = {
  title: "Back to the app",
  robots: { index: false },
  // The URL can hold a one-time log-in code: never sent on to another page.
  referrer: "no-referrer",
}

/**
 * Where the iOS app's GitHub log-in ends (lib/auth/app-github.ts). The app's sign-in sheet takes
 * this URL before it loads, so a browser only shows this page when the log-in didn't start in the
 * app: the code in the URL is useless without the app's own secret, so there's nothing to do here.
 */
export default async function AppSignedInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { error } = await searchParams
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
