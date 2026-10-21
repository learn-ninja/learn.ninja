"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"

import { accountApi, type AccountApi } from "@/lib/auth/browser"

import { FormError } from "./form-error"

/**
 * The consent step of a chat app signing in over OAuth: one question, Allow or Cancel. Either
 * answer goes to Better Auth with the signed request from the page's query, which replies with
 * where to send the browser: back to the app with a code, or with a refusal.
 */
export function ConsentForm({
  app,
  handle,
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
          any time from the app&apos;s own settings.
        </p>
      </div>
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
