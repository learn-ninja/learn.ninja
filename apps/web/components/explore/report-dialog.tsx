"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

import { FormError } from "@/components/account/form-error"
import { exploreApi, REASON_MAX, type ExploreApi } from "@/lib/explore/browser"

/** Report a listed lesson: one text field, sent to the maker. */
export function ReportDialog({
  id,
  isOpen,
  onOpenChange,
  api = exploreApi,
}: {
  id: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  api?: ExploreApi
}) {
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)
  const fieldId = React.useId()

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = reason.trim()
    if (!text) return setError("Say what's wrong first.")
    setBusy(true)
    setError(null)
    const result = await api.report(id, text)
    setBusy(false)
    if (result.error) return setError(result.error)
    setSent(true)
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open)
        if (!open) {
          setReason("")
          setError(null)
          setSent(false)
        }
      }}
    >
      {sent ? (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckIcon className="size-4 text-green-600" aria-hidden="true" />
              Thanks
            </DialogTitle>
            <DialogDescription>
              Your report is on its way. Someone will take a look.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose variant="default">Done</DialogClose>
          </DialogFooter>
        </>
      ) : (
        <form onSubmit={(e) => void send(e)} className="contents">
          <DialogHeader>
            <DialogTitle>Report this lesson</DialogTitle>
            <DialogDescription>
              Tell us what&apos;s wrong and it goes straight to the people who
              run {"learn.ninja"}. Lessons that break the terms are taken out of
              Explore.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId}>What&apos;s wrong?</Label>
            <Textarea
              id={fieldId}
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={REASON_MAX}
              disabled={busy}
              placeholder="It's spam, it copies someone's work, it's harmful…"
              className="min-h-24"
            />
            <FormError>{error}</FormError>
          </div>
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button type="submit" isDisabled={busy}>
              Send report
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}
