"use client"

import * as React from "react"
import Link from "next/link"
import { LinkIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
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

import { CopyButton } from "@/components/site/copy-button"
import type { McpConnection } from "@/lib/auth/account"
import {
  accountApi,
  type AccountApi,
  type NewMcpConnection,
} from "@/lib/auth/browser"
import { mcpPath } from "@/lib/publish/paths"
import { relative } from "@/lib/relative-time"
import { SITE } from "@/lib/site"

import { FormError } from "./form-error"
import { SettingsList } from "./settings-section"

/**
 * The personal MCP URL, for apps that take only a URL and can't log in over OAuth (Claude.ai,
 * ChatGPT, and Claude Code log in on their own and show up in Connected apps). It's a secret that stands for the account (the key at its end),
 * so it's shown once when made, then masked; Rotate makes a new one and Revoke ends it.
 */
export function ConnectChat({
  initial,
  api = accountApi,
}: {
  /** The current URL, masked, or null when none was made. */
  initial: McpConnection | null
  api?: AccountApi
}) {
  const [connection, setConnection] = React.useState(initial)
  const [fresh, setFresh] = React.useState<NewMcpConnection | null>(null)
  const [confirming, setConfirming] = React.useState<"rotate" | "revoke" | null>(
    null
  )
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function connect() {
    setBusy(true)
    setError(null)
    const result = await api.connectChat()
    setBusy(false)
    setConfirming(null)
    if (result.error || !result.connection)
      return setError(result.error ?? null)
    setFresh(result.connection)
    setConnection(result.connection)
  }

  async function revoke() {
    setBusy(true)
    setError(null)
    const { error } = await api.disconnectChat()
    setBusy(false)
    setConfirming(null)
    if (error) return setError(error)
    setFresh(null)
    setConnection(null)
  }

  const docs = (
    <Link
      href="/docs#connect-with-your-account"
      className="underline underline-offset-3 hover:text-foreground"
    >
      how to add it
    </Link>
  )

  return (
    <>
      {fresh ? (
        <Alert>
          <LinkIcon />
          <AlertTitle>Copy your URL now</AlertTitle>
          <AlertDescription className="flex min-w-0 flex-col gap-2">
            <span>
              It&apos;s shown once. Paste it where your chat app asks for an
              MCP server ({docs}). It stands for your account, so treat it
              like a password: anyone who has it can publish as you.
            </span>
            <span className="flex items-center gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 truncate rounded-md border bg-background px-2 py-1 font-mono text-xs dark:bg-input/30"
              >
                {fresh.url}
              </code>
              <CopyButton text={fresh.url} size="sm" variant="outline">
                Copy
              </CopyButton>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {connection ? (
        <SettingsList>
          <Item role="listitem">
            <ItemContent className="min-w-0 gap-0.5">
              <ItemTitle className="w-full min-w-0">
                <bdi dir="ltr" className="truncate font-mono text-xs">
                  {SITE.url}
                  {mcpPath(connection.start ?? "learn_mcp_")}…
                </bdi>
              </ItemTitle>
              <ItemDescription>
                Made {relative(connection.createdAt)}
                {connection.lastUsedAt
                  ? ` · last used ${relative(connection.lastUsedAt)}`
                  : " · never used"}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                size="sm"
                isDisabled={busy}
                onPress={() => setConfirming("rotate")}
              >
                Rotate
              </Button>
              <Button
                variant="outline"
                size="sm"
                isDisabled={busy}
                onPress={() => setConfirming("revoke")}
              >
                Revoke
              </Button>
            </ItemActions>
          </Item>
        </SettingsList>
      ) : (
        <div>
          <Button
            variant="outline"
            size="sm"
            isDisabled={busy}
            onPress={() => void connect()}
          >
            Make my URL
          </Button>
        </div>
      )}
      <FormError>{error}</FormError>

      <Dialog
        isOpen={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {confirming === "rotate" ? "Rotate the URL?" : "Revoke the URL?"}
          </DialogTitle>
          <DialogDescription>
            {confirming === "rotate"
              ? "The current URL stops working at once and a new one is shown. Update every chat app that uses it. Lessons it published stay in your account."
              : "Chat apps using it stop publishing at once; they can still use the public URL without an account. Lessons it published stay in your account."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Keep it</DialogClose>
          <Button
            variant={confirming === "rotate" ? "default" : "destructive"}
            isDisabled={busy}
            onPress={() => void (confirming === "rotate" ? connect() : revoke())}
          >
            {confirming === "rotate" ? "Rotate" : "Revoke"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

