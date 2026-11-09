"use client"

import * as React from "react"

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

import { accountApi, forgetAccount, type AccountApi } from "@/lib/auth/browser"

import { FormError } from "./form-error"

/**
 * Delete account: a red button, then a dialog that says what goes and that it can't be undone,
 * and asks for the account's email typed again (as the iOS app's prompt does). Once it's gone the
 * browser is logged out and goes home.
 */
export function DeleteAccount({
  email,
  api = accountApi,
  navigate = (to) => window.location.assign(to),
}: {
  email: string
  api?: AccountApi
  navigate?: (to: string) => void
}) {
  const [isOpen, setOpen] = React.useState(false)
  const [typed, setTyped] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const matches = typed.trim().toLowerCase() === email.toLowerCase()

  async function remove() {
    if (!matches || busy) return
    setBusy(true)
    setError(null)
    const result = await api.deleteAccount(typed)
    if (result.error) {
      setBusy(false)
      return setError(result.error)
    }
    forgetAccount()
    navigate("/")
  }

  return (
    <>
      <div>
        <Button variant="destructive" size="sm" onPress={() => setOpen(true)}>
          Delete account
        </Button>
      </div>
      <Dialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (busy) return
          setOpen(open)
          if (!open) {
            setTyped("")
            setError(null)
          }
        }}
      >
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void remove()
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This deletes your account and everything in it for good: your
              lessons, profile, likes, finished lessons, progress, streak, API
              keys, and connected apps. It can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-confirm">
              <span>
                Type <bdi dir="ltr">{email}</bdi> to confirm
              </span>
            </Label>
            <Input
              id="delete-confirm"
              type="email"
              dir="ltr"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <FormError>{error}</FormError>
          </div>
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button
              type="submit"
              variant="destructive"
              isDisabled={busy || !matches}
            >
              {busy ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}
