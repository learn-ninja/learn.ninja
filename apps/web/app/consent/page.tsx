import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { verifyOAuthQueryParams } from "@better-auth/oauth-provider"
import { eq } from "drizzle-orm"

import { oauthClient } from "@workspace/db"

import { AuthHeading, AuthPanel } from "@/components/account/auth-panel"
import { ConsentForm } from "@/components/account/consent-form"
import { ButtonLink } from "@/components/site/button-link"
import { appLabel } from "@/lib/auth/account"
import { getAuth } from "@/lib/auth/auth"
import { currentActor, queryOf } from "@/lib/auth/session"
import { getDb } from "@/lib/publish/store"

export const metadata: Metadata = {
  title: "Allow this app",
  robots: { index: false },
}

// Always rendered per request: it reads the session and the database.
export const dynamic = "force-dynamic"

/**
 * The consent step of a chat app logging in over OAuth. Better Auth sends the logged-in user here
 * with the authorize request logged into the query; the page checks that signature, names the app
 * asking and the host it goes back to, and the form posts the answer. A logged-out visitor logs
 * in first and comes back; one without a handle (a new account, since the log-in page skips that
 * step on this path) picks it here, beside Allow. The layout is Agendolo's consent page: a bare
 * panel with no header, since the visitor is mid-way through connecting an app.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = queryOf(params)
  const auth = await getAuth()
  const clientId = Array.isArray(params.client_id)
    ? params.client_id[0]
    : params.client_id
  const valid =
    Boolean(clientId) &&
    (await verifyOAuthQueryParams(query, (await auth.$context).secret))

  if (!valid || !clientId) {
    return (
      <AuthPanel>
        <AuthHeading title="This request has expired">
          Go back to your chat app and connect learn.ninja again. It only takes
          a moment.
        </AuthHeading>
        <ButtonLink href="/" variant="outline" className="w-full">
          Go to learn.ninja
        </ButtonLink>
      </AuthPanel>
    )
  }

  const back = `/login?callback=${encodeURIComponent(`/consent?${query}`)}`
  const actor = await currentActor()
  if (!actor) redirect(back)

  return (
    <AuthPanel>
      <ConsentForm
        app={await appName(clientId)}
        handle={actor.handle}
        email={actor.email}
        returnTo={hostOf(params.redirect_uri)}
        switchHref={back}
      />
    </AuthPanel>
  )
}

/** The address the app goes back to, as a person would read it: "claude.ai", "localhost". */
function hostOf(uri: string | string[] | undefined): string | null {
  const value = Array.isArray(uri) ? uri[0] : uri
  if (!value) return null
  try {
    return new URL(value).hostname || null
  } catch {
    return null
  }
}

/** Who is asking, as the settings' Connected apps will show it (appLabel). */
async function appName(clientId: string): Promise<string> {
  const [row] = await (
    await getDb()
  )
    .select({ name: oauthClient.name })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
  return appLabel(clientId, row?.name)
}
