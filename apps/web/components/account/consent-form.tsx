"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeftRightIcon,
  BookmarkIcon,
  PencilIcon,
  UploadIcon,
} from "lucide-react"

import { LearnLogo } from "@workspace/player"
import { Button } from "@workspace/ui/components/button"

import { accountApi, forgetAccount, type AccountApi } from "@/lib/auth/browser"

import { AuthHeading } from "./auth-panel"
import { FormError } from "./form-error"
import { HandleForm } from "./handle-form"

/** What a connected app can do: the MCP's tools that act on the account (lib/mcp/server.ts). */
const CAN = [
  { icon: UploadIcon, text: "Publish lessons to your account" },
  { icon: PencilIcon, text: "Update the lessons in your account" },
  { icon: BookmarkIcon, text: "Keep lessons you made elsewhere, when you ask" },
]

/**
 * The consent step of a chat app signing in over OAuth, laid out like Agendolo's: the app and
 * learn.ninja side by side, what it could do, who is signed in, then Allow or Cancel. Either
 * answer goes to Better Auth with the signed request from the page's query, which replies with
 * where to send the browser: back to the app with a code, or with a refusal. Switch signs out and
 * goes to sign in, which comes back here. A user without a handle (a new account: the sign-in
 * page skips the handle step on this path) can pick one here, so the app's lessons have a name to
 * be listed under; it's optional, and settings has it too.
 */
export function ConsentForm({
  app,
  handle: initialHandle,
  email,
  returnTo,
  switchHref,
  api = accountApi,
  navigate = (to) => window.location.assign(to),
}: {
  /** Who is asking, as shown to the user: the app's host (claude.ai) or its name. */
  app: string
  /** The signed-in user's handle, or null when they haven't picked one. */
  handle: string | null
  /** The signed-in user's email, shown when there's no handle yet. */
  email: string
  /** The host the browser goes back to (claude.ai), or null when it can't be read. */
  returnTo: string | null
  /** Where Switch goes once signed out: sign in, then back to this request. */
  switchHref: string
  api?: AccountApi
  navigate?: (to: string) => void
}) {
  const [handle, setHandle] = React.useState(initialHandle)
  const [busy, setBusy] = React.useState<"allow" | "cancel" | "switch" | null>(
    null
  )
  const [error, setError] = React.useState<string | null>(null)

  async function answer(accept: boolean) {
    setBusy(accept ? "allow" : "cancel")
    setError(null)
    const { url, error } = await api.consent(accept)
    if (error || !url) {
      setBusy(null)
      return setError(error ?? "Something went wrong. Try again.")
    }
    navigate(url)
  }

  async function switchAccount() {
    setBusy("switch")
    await api.signOut()
    forgetAccount()
    navigate(switchHref)
  }

  return (
    <>
      <div aria-hidden className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl border bg-muted text-lg font-semibold">
          {app.charAt(0).toUpperCase()}
        </span>
        <ArrowLeftRightIcon className="size-4 text-muted-foreground" />
        <span className="flex size-12 items-center justify-center rounded-xl border bg-card">
          <LearnLogo className="size-6" />
        </span>
      </div>
      <AuthHeading
        title={
          <>
            Connect <bdi dir="ltr">{app}</bdi> to learn.ninja
          </>
        }
      >
        It will make lessons as you. It can&apos;t read your email, change your
        handle, or sign in on the website.
      </AuthHeading>
      <ul className="w-full divide-y rounded-xl border text-start">
        {CAN.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 px-4 py-3 text-sm">
            <Icon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            {text}
          </li>
        ))}
      </ul>
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted py-2.5 ps-4 pe-3 text-start text-sm dark:bg-input/30">
            <span className="min-w-0 truncate">
              Signed in as{" "}
              <bdi dir="ltr" className="font-medium">
                {handle ? `@${handle}` : email}
              </bdi>
            </span>
            <Button
              variant="link"
              size="sm"
              className="h-auto shrink-0 p-0"
              onPress={() => void switchAccount()}
              isDisabled={busy !== null}
            >
              Switch
            </Button>
          </div>
          {handle === null ? (
            <div className="flex flex-col gap-3 rounded-xl border p-4 text-start">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">Pick a handle</h2>
                <p className="text-sm text-muted-foreground">
                  Lessons it publishes are listed under it. You can skip this
                  and pick one later in settings.
                </p>
              </div>
              <HandleForm
                initial={null}
                api={api}
                submitVariant="outline"
                onSaved={setHandle}
              />
            </div>
          ) : null}
        </div>
        {error ? <FormError>{error}</FormError> : null}
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            onPress={() => void answer(true)}
            isDisabled={busy !== null}
            isPending={busy === "allow"}
          >
            Allow
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onPress={() => void answer(false)}
            isDisabled={busy !== null}
            isPending={busy === "cancel"}
          >
            Cancel
          </Button>
        </div>
        <p className="text-sm text-pretty text-muted-foreground">
          {returnTo ? (
            <>
              You&apos;ll go back to{" "}
              <bdi dir="ltr" className="font-medium text-foreground">
                {returnTo}
              </bdi>
              .{" "}
            </>
          ) : null}
          Disconnect it any time in{" "}
          <Link
            href="/settings#apps"
            className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Settings
          </Link>
          .
        </p>
      </div>
    </>
  )
}
