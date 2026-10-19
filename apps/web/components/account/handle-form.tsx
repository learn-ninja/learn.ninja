"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import { Label } from "@workspace/ui/components/label"

import { accountApi, rememberAccount, type AccountApi } from "@/lib/auth/browser"
import { HANDLE_RULES, normalizeHandle } from "@/lib/auth/handle-rules"

import { FormError } from "./form-error"

/** Choose or change the handle: an @ input with the rules under it. */
export function HandleForm({
  initial,
  api = accountApi,
  submitLabel = "Save",
  onSaved,
}: {
  initial: string | null
  api?: AccountApi
  submitLabel?: string
  onSaved?: (handle: string) => void
}) {
  const [value, setValue] = React.useState(initial ?? "")
  const [saved, setSaved] = React.useState(initial)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)
  const normalized = normalizeHandle(value)
  const unchanged = normalized === saved

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (unchanged) return
    setBusy(true)
    setError(null)
    setDone(false)
    const result = await api.setHandle(normalized)
    setBusy(false)
    if (result.error || !result.handle) return setError(result.error ?? null)
    setValue(result.handle)
    setSaved(result.handle)
    setDone(true)
    rememberAccount({ handle: result.handle })
    onSaved?.(result.handle)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="handle">Handle</Label>
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <InputGroupText>@</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id="handle"
            name="handle"
            dir="ltr"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="your-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
            aria-describedby="handle-rules"
          />
        </InputGroup>
        <p id="handle-rules" className="text-sm text-muted-foreground">
          {HANDLE_RULES}
          {normalized && normalized !== value.trim() ? (
            <>
              {" "}
              Saved as <bdi dir="ltr">@{normalized}</bdi>.
            </>
          ) : null}
        </p>
      </div>
      <FormError>{error}</FormError>
      <div className="flex items-center gap-3">
        <Button type="submit" isDisabled={busy || unchanged || !normalized}>
          {submitLabel}
        </Button>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {done && unchanged ? "Saved" : ""}
        </span>
      </div>
    </form>
  )
}
