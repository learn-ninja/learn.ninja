"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"

import { accountApi, type AccountApi } from "@/lib/auth/browser"

import { FormError } from "./form-error"
import { HandleForm } from "./handle-form"

/**
 * The consent step of a chat app signing in over OAuth: one question, Allow or Cancel. Either
 * answer goes to Better Auth with the signed request from the page's query, which replies with
 * where to send the browser: back to the app with a code, or with a refusal. A user without a
 * handle (a new account: the sign-in page skips the handle step on this path) picks one here,
 * so the app's lessons have a name to be listed under; it's optional, and settings has it too.
 */
export function ConsentForm({
  app,
  handle: initialHandle,
  api = accountApi,
  navigate = (to) => window.location.assign(to),
}: {
  /** Who is asking, as shown to the user: the app's host (claude.ai) or its name. */
  app: string
  /** The signed-in user's handle, or null when they haven't picked one. */
  handle: string | null
  api?: AccountApi
  navigate?: (to: string) => void
}) {
  const [handle, setHandle] = React.useState(initialHandle)
  const [busy, setBusy] = React.useState<"allow" | "cancel" | null>(null)
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Allow <bdi dir="ltr">{app}</bdi>?
        </h1>
        <p className="text-muted-foreground">
          It wants to publish lessons to your learn.ninja account
          {handle ? (
            <>
              {" "}
              as <span className="font-medium text-foreground">@{handle}</span>
            </>
          ) : null}
          , and keep the ones you ask it to. It can&apos;t read your email,
          change your handle, or sign in on the website. You can disconnect it
          any time under Connected apps in your settings.
        </p>
      </div>
      {handle === null ? (
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Pick a handle first</h2>
            <p className="text-sm text-muted-foreground">
              Lessons it publishes are listed under it. You can skip this and
              pick one later in settings.
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
      <FormError>{error}</FormError>
      <div className="flex gap-3">
        <Button
          onPress={() => void answer(true)}
          isDisabled={busy !== null}
          isPending={busy === "allow"}
        >
          Allow
        </Button>
        <Button
          variant="outline"
          onPress={() => void answer(false)}
          isDisabled={busy !== null}
          isPending={busy === "cancel"}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
