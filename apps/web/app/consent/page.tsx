import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { verifyOAuthQueryParams } from "@better-auth/oauth-provider"
import { eq } from "drizzle-orm"

import { oauthClient } from "@workspace/db"

import { AccountPage } from "@/components/account/account-page"
import { ConsentForm } from "@/components/account/consent-form"
import { ButtonLink } from "@/components/site/button-link"
import { accountOf } from "@/lib/auth/account-info"
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
 * The consent step of a chat app signing in over OAuth. Better Auth sends the signed-in user here
 * with the authorize request signed into the query; the page checks that signature, names the app
 * asking, and the form posts the answer. A signed-out visitor signs in first and comes back.
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
      <AccountPage account={accountOf(await currentActor())}>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            This sign-in has expired
          </h1>
          <p className="text-muted-foreground">
            The request from your chat app is no longer valid. Go back to the
            app and try connecting again.
          </p>
        </div>
        <ButtonLink href="/" variant="outline" className="self-start">
          Go to learn.ninja
        </ButtonLink>
      </AccountPage>
    )
  }

  const actor = await currentActor()
  if (!actor)
    redirect(`/sign-in?callback=${encodeURIComponent(`/consent?${query}`)}`)

  return (
    <AccountPage account={accountOf(actor)}>
      <ConsentForm app={await appName(clientId)} handle={actor.handle} />
    </AccountPage>
  )
}

/**
 * Who is asking. A client that identifies itself with a Client ID Metadata Document (Claude,
 * ChatGPT) has a URL for an id: show its host, since the document's own name is self-asserted. A
 * registered client is shown by the name it registered with.
 */
async function appName(clientId: string): Promise<string> {
  if (/^https:\/\//.test(clientId)) {
    try {
      return new URL(clientId).host
    } catch {
      // fall through to the lookup
    }
  }
  const [row] = await (await getDb())
    .select({ name: oauthClient.name })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
  return row?.name?.trim() || "A chat app"
}
