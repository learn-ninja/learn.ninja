"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"

import { accountApi, rememberAccount, type AccountApi } from "@/lib/auth/browser"
import { AVATAR_TYPES, avatarProblem } from "@/lib/auth/avatar-rules"

import { FormError } from "./form-error"
import { UserAvatar } from "./user-avatar"

/**
 * Choose, replace, or remove the profile picture. The file picker (a plain file input, hidden
 * behind a button) is checked against the size and type rules before anything is sent; a chosen
 * picture previews in place until it's saved or dropped.
 */
export function AvatarForm({
  initial,
  handle,
  api = accountApi,
}: {
  /** The current picture's URL, or null. */
  initial: string | null
  handle: string | null
  api?: AccountApi
}) {
  const [image, setImage] = React.useState(initial)
  const [chosen, setChosen] = React.useState<File | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState("")
  const input = React.useRef<HTMLInputElement>(null)

  // The preview is an object URL for the chosen file, released once it's no longer shown.
  const preview = React.useMemo(
    () => (chosen ? URL.createObjectURL(chosen) : null),
    [chosen]
  )
  React.useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clearing the input lets the same file be chosen again after a cancel.
    e.target.value = ""
    if (!file) return
    setStatus("")
    const problem = avatarProblem(file)
    if (problem) {
      setChosen(null)
      return setError(problem)
    }
    setError(null)
    setChosen(file)
  }

  async function save() {
    if (!chosen) return
    setBusy(true)
    setError(null)
    const result = await api.uploadAvatar(chosen)
    setBusy(false)
    if (result.error || !result.image) return setError(result.error ?? null)
    setChosen(null)
    setImage(result.image)
    setStatus("Saved")
    rememberAccount({ image: result.image })
  }

  async function remove() {
    setBusy(true)
    setError(null)
    const result = await api.removeAvatar()
    setBusy(false)
    if (result.error) return setError(result.error)
    setChosen(null)
    setImage(null)
    setStatus("Removed")
    rememberAccount({ image: null })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5">
        <UserAvatar image={preview ?? image} handle={handle} size="settings" />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {chosen ? (
              <>
                <Button size="sm" isDisabled={busy} onPress={() => void save()}>
                  {busy ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={busy}
                  onPress={() => {
                    setChosen(null)
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={busy}
                  onPress={() => input.current?.click()}
                >
                  {image ? "Change picture" : "Choose picture"}
                </Button>
                {image ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={busy}
                    onPress={() => void remove()}
                  >
                    {busy ? "Removing…" : "Remove"}
                  </Button>
                ) : null}
              </>
            )}
            <span aria-live="polite" className="text-sm text-muted-foreground">
              {status}
            </span>
          </div>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        name="file"
        accept={AVATAR_TYPES.join(",")}
        onChange={choose}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <FormError>{error}</FormError>
    </div>
  )
}
