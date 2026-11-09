import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AccountPage } from "@/components/account/account-page"
import { SettingsView } from "@/components/account/settings-view"
import { viewerStreak } from "@/lib/activity/server"
import {
  connectedApps,
  githubLinkedAt,
  listKeys,
  mcpConnection,
} from "@/lib/auth/account"
import { accountOf } from "@/lib/auth/account-info"
import { getAuth, githubFromEnv } from "@/lib/auth/auth"
import { currentActor } from "@/lib/auth/session"
import { blockedPeople } from "@/lib/explore/queries"
import type { KeySummary } from "@/lib/auth/account"
import { getDb } from "@/lib/publish/store"

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
}

// Always rendered per request: these pages read the session, and the lesson store, which don't
// exist on a build machine.
export const dynamic = "force-dynamic"

/** The account: picture, handle, connected chat apps, API keys, and blocked people. */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actor = await currentActor()
  if (!actor) redirect("/login?callback=/settings")
  const auth = await getAuth()
  const h = await headers()
  const db = await getDb()
  // Better Auth sends a refused GitHub link back here with ?error=…
  const { error } = await searchParams
  const [keys, connection, apps, streak, linkedAt, blocked] = await Promise.all(
    [
      listKeys(auth, h).then((r) => r.body.keys as KeySummary[]),
      mcpConnection(auth, h),
      connectedApps(db, actor.userId),
      viewerStreak(actor.userId),
      githubLinkedAt(db, actor.userId),
      blockedPeople(db, actor.userId),
    ]
  )
  return (
    <AccountPage account={accountOf(actor)} streak={streak} wide>
      <SettingsView
        email={actor.email}
        github={githubFromEnv() ? { linkedAt } : null}
        githubError={typeof error === "string" ? error : null}
        image={actor.image}
        handle={actor.handle}
        apps={apps}
        connection={connection}
        keys={keys}
        blocked={blocked}
      />
    </AccountPage>
  )
}
