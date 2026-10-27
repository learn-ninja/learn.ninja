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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Label } from "@workspace/ui/components/label"

import { CopyButton } from "@/components/site/copy-button"
import type { KeySummary } from "@/lib/auth/account"
import { accountApi, type AccountApi, type NewKey } from "@/lib/auth/browser"
import { relative } from "@/lib/relative-time"

import { FormError } from "./form-error"
import { SettingsList } from "./settings-section"

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
  const [creating, setCreating] = React.useState(false)
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
    setCreating(false)
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
    <>
      {fresh ? (
        <Alert>
          <KeyRoundIcon />
          <AlertTitle>Copy your new key now</AlertTitle>
          <AlertDescription className="flex min-w-0 flex-col gap-2">
            <span>
              It&apos;s shown once. Put it in{" "}
              <code className="font-mono break-all">~/.config/learn/credentials</code>,
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
        <SettingsList>
          {keys.map((key) => (
            <Item key={key.id} role="listitem">
              <ItemContent className="min-w-0 gap-0.5">
                <ItemTitle>{key.name ?? "Unnamed key"}</ItemTitle>
                <ItemDescription>
                  <bdi dir="ltr" className="font-mono text-xs">
                    {key.start ?? "learn_"}…
                  </bdi>{" "}
                  · made {relative(key.createdAt)}
                  {key.lastUsedAt
                    ? ` · last used ${relative(key.lastUsedAt)}`
                    : " · never used"}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={busy}
                  onPress={() => setRevoking(key)}
                >
                  Revoke
                </Button>
              </ItemActions>
            </Item>
          ))}
        </SettingsList>
      ) : null}

      <div>
        <Button
          variant="outline"
          size="sm"
          isDisabled={busy}
          onPress={() => {
            setName("")
            setError(null)
            setCreating(true)
          }}
        >
          Create key
        </Button>
      </div>
      <FormError>{creating ? null : error}</FormError>

      <Dialog
        isOpen={creating}
        onOpenChange={(open) => {
          if (!open) setCreating(false)
        }}
      >
        <form className="flex flex-col gap-6" onSubmit={(e) => void create(e)}>
          <DialogHeader>
            <DialogTitle>Create a key</DialogTitle>
            <DialogDescription>
              Name it after where you&apos;ll use it, so you can tell keys
              apart later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              name="name"
              placeholder="e.g. work laptop"
              maxLength={32}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <FormError>{error}</FormError>
          </div>
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button type="submit" isDisabled={busy}>
              {busy ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

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
    </>
  )
}

