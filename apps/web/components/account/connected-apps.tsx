"use client"

import * as React from "react"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import type { ConnectedApp } from "@/lib/auth/account"
import { accountApi, type AccountApi } from "@/lib/auth/browser"

import { FormError } from "./form-error"

/**
 * "Connected apps": the chat apps that signed in to the account over OAuth (Claude.ai, ChatGPT,
 * Claude Code) and were allowed on /consent. Disconnect ends the app's tokens at once; it asks
 * the user to sign in again the next time they keep a lesson from it.
 */
export function ConnectedApps({
  initial,
  api = accountApi,
}: {
  initial: ConnectedApp[]
  api?: AccountApi
}) {
  const [apps, setApps] = React.useState(initial)
  const [disconnecting, setDisconnecting] = React.useState<ConnectedApp | null>(
    null
  )
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function disconnect(app: ConnectedApp) {
    setBusy(true)
    setError(null)
    const { error } = await api.disconnectApp(app.id)
    setBusy(false)
    setDisconnecting(null)
    if (error) return setError(error)
    setApps(apps.filter((a) => a.id !== app.id))
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">
        Chat apps that signed in to your account. Each one publishes lessons as
        you, and keeps the ones you ask it to. Disconnect any you don&apos;t
        recognize.
      </p>

      {apps.length ? (
        <ul className="flex flex-col divide-y rounded-xl border">
          {apps.map((app) => (
            <li
              key={app.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  <bdi dir="ltr">{app.name}</bdi>
                </span>
                <span className="text-sm text-muted-foreground">
                  allowed {relative(app.allowedAt)}
                  {app.lastUsedAt
                    ? ` · last used ${relative(app.lastUsedAt)}`
                    : " · never used"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                isDisabled={busy}
                onPress={() => setDisconnecting(app)}
              >
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No apps yet. Claude, ChatGPT, and Claude Code sign in on their own the
          first time you keep a lesson from them (
          <Link
            href="/docs#connect-with-your-account"
            className="underline underline-offset-3 hover:text-foreground"
          >
            how to add them
          </Link>
          ).
        </p>
      )}
      <FormError>{error}</FormError>

      <Dialog
        isOpen={disconnecting !== null}
        onOpenChange={(open) => {
          if (!open) setDisconnecting(null)
        }}
      >
        <DialogHeader>
          <DialogTitle>
            Disconnect <bdi dir="ltr">{disconnecting?.name}</bdi>?
          </DialogTitle>
          <DialogDescription>
            It stops publishing to your account at once, and asks you to sign in
            again the next time you keep a lesson from it. Lessons it published
            stay in your account.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Keep it</DialogClose>
          <Button
            variant="destructive"
            isDisabled={busy}
            onPress={() => {
              if (disconnecting) void disconnect(disconnecting)
            }}
          >
            Disconnect
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

/** "today", "3 days ago", "on 2 Oct 2026". */
function relative(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 864e5)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  return `on ${new Date(iso).toLocaleDateString("en", { dateStyle: "medium" })}`
}
