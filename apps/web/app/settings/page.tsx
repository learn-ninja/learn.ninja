import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AccountPage } from "@/components/account/account-page"
import { ApiKeys } from "@/components/account/api-keys"
import { AvatarForm } from "@/components/account/avatar-form"
import { ConnectChatFallback } from "@/components/account/connect-chat"
import { ConnectedApps } from "@/components/account/connected-apps"
import { HandleForm } from "@/components/account/handle-form"
import { SignOutButton } from "@/components/account/sign-out-button"
import { YourLessons } from "@/components/account/your-lessons"
import { ButtonLink } from "@/components/site/button-link"
import { connectedApps, listKeys, mcpConnection } from "@/lib/auth/account"
import { accountOf } from "@/lib/auth/account-info"
import { getAuth } from "@/lib/auth/auth"
import { currentActor } from "@/lib/auth/session"
import type { KeySummary } from "@/lib/auth/account"
import { lessonsOwnedBy } from "@/lib/explore/queries"
import { getDb } from "@/lib/publish/store"

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
}

// Always rendered per request: these pages read the session, and the lesson store, which don't
// exist on a build machine.
export const dynamic = "force-dynamic"

/** The account: picture, handle, lessons, connected chat apps, API keys, and sign out. */
export default async function SettingsPage() {
  const actor = await currentActor()
  if (!actor) redirect("/sign-in?callback=/settings")
  const auth = await getAuth()
  const h = await headers()
  const db = await getDb()
  const [keys, connection, apps, lessons] = await Promise.all([
    listKeys(auth, h).then((r) => r.body.keys as KeySummary[]),
    mcpConnection(auth, h),
    connectedApps(db, actor.userId),
    lessonsOwnedBy(db, actor.userId),
  ])
  return (
    <AccountPage account={accountOf(actor)} wide>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Signed in as{" "}
          <bdi dir="ltr" className="font-medium text-foreground">
            {actor.email}
          </bdi>
          .
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Picture</h2>
        <AvatarForm initial={actor.image} handle={actor.handle} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Handle</h2>
          {actor.handle ? (
            <ButtonLink
              href={`/u/${actor.handle}`}
              variant="outline"
              size="sm"
            >
              View profile
            </ButtonLink>
          ) : null}
        </div>
        <HandleForm initial={actor.handle} />
      </section>

      <section id="lessons" className="flex scroll-mt-20 flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Your lessons</h2>
        <YourLessons initial={lessons} handle={actor.handle} />
      </section>

      <section id="apps" className="flex scroll-mt-20 flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Connected apps</h2>
        <ConnectedApps initial={apps} />
        <ConnectChatFallback initial={connection} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">API keys</h2>
        <ApiKeys initial={keys} />
      </section>

      <section className="flex flex-col gap-4 border-t pt-8">
        <SignOutButton />
      </section>
    </AccountPage>
  )
}
