import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AccountPage } from "@/components/account/account-page"
import { AuthPanel, LegalConsent } from "@/components/account/auth-panel"
import { LoginForm } from "@/components/account/login-form"
import { ButtonLink } from "@/components/site/button-link"
import { accountOf } from "@/lib/auth/account-info"
import { githubFromEnv } from "@/lib/auth/auth"
import { currentActor } from "@/lib/auth/session"
import { hashToken } from "@/lib/publish/ids"
import { getLessonStore } from "@/lib/publish/store"

export const metadata: Metadata = {
  title: "Keep this lesson",
  robots: { index: false },
}

// Always rendered per request: these pages read the session, and the lesson store, which don't
// exist on a build machine.
export const dynamic = "force-dynamic"

/**
 * The claim link from publishing: /keep/{claimToken}. Logs the visitor in if needed, then
 * /keep/{claimToken}/claim moves the lesson into their account and opens it.
 */
export default async function KeepPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const [actor, record] = await Promise.all([
    currentActor(),
    (await getLessonStore()).getByClaimTokenHash(hashToken(token)),
  ])
  const account = accountOf(actor)

  if (!record) {
    return (
      <AccountPage account={account}>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Nothing to keep here
          </h1>
          <p className="text-muted-foreground">
            This lesson was already saved to an account, it expired before
            anyone kept it, or a newer keep link was made for it. Each keep link
            works once.
          </p>
        </div>
        <ButtonLink href="/" variant="outline" className="self-start">
          Make your own
        </ButtonLink>
      </AccountPage>
    )
  }

  if (!actor) {
    return (
      <AuthPanel footer={<LegalConsent />}>
        <LoginForm
          github={githubFromEnv() !== null}
          callback={`/keep/${token}/claim`}
          title="Log in to keep this lesson"
          description={
            <>
              Log in or make a free account, and{" "}
              <span className="font-medium text-foreground">
                {record.lesson.title}
              </span>{" "}
              stops expiring.
            </>
          }
        />
      </AuthPanel>
    )
  }

  redirect(`/keep/${token}/claim`)
}
