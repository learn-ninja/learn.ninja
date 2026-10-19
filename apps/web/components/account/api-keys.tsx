"use client"

import * as React from "react"
import { KeyRoundIcon } from "lucide-react"

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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { CopyButton } from "@/components/site/copy-button"
import type { KeySummary } from "@/lib/auth/account"
import { accountApi, type AccountApi, type NewKey } from "@/lib/auth/browser"

import { FormError } from "./form-error"

/**
 * The account's API keys: the ones `learn login` made and any made here. A new key is shown once,
 * with a copy button; the list only ever shows the first characters.
 */
export function ApiKeys({
  initial,
  api = accountApi,
}: {
  initial: KeySummary[]
  api?: AccountApi
}) {
  const [keys, setKeys] = React.useState(initial)
  const [name, setName] = React.useState("")
  const [fresh, setFresh] = React.useState<NewKey | null>(null)
  const [revoking, setRevoking] = React.useState<KeySummary | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await api.createKey(name.trim())
    setBusy(false)
    if (result.error || !result.key) return setError(result.error ?? null)
    setFresh(result.key)
    setName("")
    setKeys([
      {
        id: result.key.id,
        name: result.key.name,
        start: result.key.start,
        createdAt: result.key.createdAt,
        lastUsedAt: null,
      },
      ...keys,
    ])
  }

  async function revoke(key: KeySummary) {
    setBusy(true)
    setError(null)
    const { error } = await api.deleteKey(key.id)
    setBusy(false)
    setRevoking(null)
    if (error) return setError(error)
    setKeys(keys.filter((k) => k.id !== key.id))
    if (fresh?.id === key.id) setFresh(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground">
        Keys let the terminal publish to your account.{" "}
        <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-sm">
          learn login
        </code>{" "}
        makes one for each machine. Revoke any you don&apos;t recognize.
      </p>

      {fresh ? (
        <Alert>
          <KeyRoundIcon />
          <AlertTitle>Copy your new key now</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              It&apos;s shown once. Put it in{" "}
              <code className="font-mono">~/.config/learn/credentials</code>,
              or set <code className="font-mono">LEARN_API_KEY</code>.
            </span>
            <span className="flex items-center gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 truncate rounded-md border bg-background px-2 py-1 font-mono text-xs dark:bg-input/30"
              >
                {fresh.key}
              </code>
              <CopyButton text={fresh.key} size="sm" variant="outline">
                Copy
              </CopyButton>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {keys.length ? (
        <ul className="flex flex-col divide-y rounded-xl border">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {key.name ?? "Unnamed key"}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  <bdi dir="ltr" className="font-mono text-xs">
                    {key.start ?? "learn_"}…
                  </bdi>{" "}
                  · made {relative(key.createdAt)}
                  {key.lastUsedAt
                    ? ` · last used ${relative(key.lastUsedAt)}`
                    : " · never used"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                isDisabled={busy}
                onPress={() => setRevoking(key)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No keys yet.</p>
      )}

      <form className="flex flex-col gap-4" onSubmit={(e) => void create(e)}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="key-name">New key</Label>
          <div className="flex gap-2">
            <Input
              id="key-name"
              name="name"
              placeholder="What it's for, e.g. work laptop"
              maxLength={32}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              className="max-w-xs"
            />
            <Button type="submit" variant="outline" isDisabled={busy}>
              Create key
            </Button>
          </div>
        </div>
        <FormError>{error}</FormError>
      </form>

      <Dialog
        isOpen={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null)
        }}
      >
        <DialogHeader>
          <DialogTitle>Revoke this key?</DialogTitle>
          <DialogDescription>
            Publishing with{" "}
            <span className="font-medium text-foreground">
              {revoking?.name ?? "this key"}
            </span>{" "}
            stops working at once. Lessons it published stay in your account.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Keep it</DialogClose>
          <Button
            variant="destructive"
            isDisabled={busy}
            onPress={() => revoking && void revoke(revoking)}
          >
            Revoke
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
