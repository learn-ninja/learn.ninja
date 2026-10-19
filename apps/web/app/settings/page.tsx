import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AccountPage } from "@/components/account/account-page"
import { ApiKeys } from "@/components/account/api-keys"
import { HandleForm } from "@/components/account/handle-form"
import { SignOutButton } from "@/components/account/sign-out-button"
import { listKeys } from "@/lib/auth/account"
import { getAuth } from "@/lib/auth/auth"
import { currentActor } from "@/lib/auth/session"
import type { KeySummary } from "@/lib/auth/account"

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
}

/** The account: handle, API keys, and sign out. */
export default async function SettingsPage() {
  const actor = await currentActor()
  if (!actor) redirect("/sign-in?callback=/settings")
  const keys = (await listKeys(await getAuth(), await headers())).body
    .keys as KeySummary[]
  return (
    <AccountPage handle={actor.handle ?? ""} wide>
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
        <h2 className="text-xl font-semibold tracking-tight">Handle</h2>
        <HandleForm initial={actor.handle} />
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
