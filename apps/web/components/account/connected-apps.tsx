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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"

import type { ConnectedApp } from "@/lib/auth/account"
import { accountApi, type AccountApi } from "@/lib/auth/browser"
import { relative } from "@/lib/relative-time"

import { FormError } from "./form-error"
import { SettingsList } from "./settings-section"

/**
 * "Connected apps": the chat apps that logged in to the account over OAuth (Claude.ai, ChatGPT,
 * Claude Code) and were allowed on /consent. Disconnect ends the app's tokens at once; it asks
 * the user to log in again the next time they keep a lesson from it.
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
    <>
      {apps.length ? (
        <SettingsList>
          {apps.map((app) => (
            <Item key={app.id} role="listitem">
              <ItemContent className="min-w-0 gap-0.5">
                <ItemTitle>
                  <bdi dir="ltr">{app.name}</bdi>
                </ItemTitle>
                <ItemDescription>
                  Allowed {relative(app.allowedAt)}
                  {app.lastUsedAt
                    ? ` · last used ${relative(app.lastUsedAt)}`
                    : " · never used"}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={busy}
                  onPress={() => setDisconnecting(app)}
                >
                  Disconnect
                </Button>
              </ItemActions>
            </Item>
          ))}
        </SettingsList>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link
            href="/docs#connect-with-your-account"
            className="underline underline-offset-3 hover:text-foreground"
          >
            How to connect a chat app
          </Link>
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
            It stops publishing to your account at once, and asks you to log in
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
    </>
  )
}

