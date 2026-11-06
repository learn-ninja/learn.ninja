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

import {
  accountApi,
  rememberAccount,
  type AccountApi,
} from "@/lib/auth/browser"
import { HANDLE_RULES, normalizeHandle } from "@workspace/player-core/handle-rules"

import { FormError } from "./form-error"

/** Choose or change the handle: an @ input with the rules under it. */
export function HandleForm({
  initial,
  api = accountApi,
  submitLabel = "Save",
  submitVariant = "default",
  stretch = false,
  onSaved,
}: {
  initial: string | null
  api?: AccountApi
  submitLabel?: string
  /** `outline` when the form sits beside the screen's main action, which keeps the one filled button. */
  submitVariant?: React.ComponentProps<typeof Button>["variant"]
  /** Full-width input and button, for the centered auth panel. */
  stretch?: boolean
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

  // In settings the rules show once you start changing the handle; the log-in panel always shows them.
  const showRules = stretch || !unchanged || error !== null
  const input = (
    <InputGroup className={stretch ? undefined : "max-w-64"}>
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
        aria-describedby={showRules ? "handle-rules" : undefined}
      />
    </InputGroup>
  )
  const submitButton = (
    <Button
      type="submit"
      variant={submitVariant}
      className={stretch ? "w-full" : undefined}
      isDisabled={busy || unchanged || !normalized}
    >
      {submitLabel}
    </Button>
  )

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="handle">Handle</Label>
        {stretch ? (
          input
        ) : (
          // In settings the button sits beside the input, as on the other forms there.
          <div className="flex items-center gap-2">
            {input}
            {submitButton}
            <span aria-live="polite" className="text-sm text-muted-foreground">
              {done && unchanged ? "Saved" : ""}
            </span>
          </div>
        )}
        {showRules ? (
          <p id="handle-rules" className="text-sm text-muted-foreground">
            {HANDLE_RULES}
            {normalized && normalized !== value.trim() ? (
              <>
                {" "}
                Saved as <bdi dir="ltr">@{normalized}</bdi>.
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <FormError>{error}</FormError>
      {stretch ? submitButton : null}
    </form>
  )
}
