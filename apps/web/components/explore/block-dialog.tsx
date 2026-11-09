"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { FormError } from "@/components/account/form-error"
import { exploreApi, type ExploreApi } from "@/lib/explore/browser"

/** Who a block names: their user id, and the handle to say (their name when there's none). */
export interface BlockTarget {
  id: string
  handle: string | null
  name?: string
}

/**
 * Confirms blocking someone (their lessons leave your Explore and the Likes tabs you read, and
 * they aren't told) or unblocking them, then calls `onDone`. The server's error shows in place.
 */
export function BlockDialog({
  person,
  unblock = false,
  isOpen,
  onOpenChange,
  onDone,
  api = exploreApi,
}: {
  person: BlockTarget
  unblock?: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
  api?: ExploreApi
}) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const who = <bdi dir="ltr">{person.handle ?? person.name ?? "them"}</bdi>

  async function run() {
    setBusy(true)
    setError(null)
    const result = unblock
      ? await api.unblock(person.id)
      : await api.block(person.id)
    setBusy(false)
    if (result.error) return setError(result.error)
    onOpenChange(false)
    onDone()
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (busy) return
        onOpenChange(open)
        if (!open) setError(null)
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {unblock ? "Unblock" : "Block"} {who}?
        </DialogTitle>
        <DialogDescription>
          {unblock
            ? "Their lessons show for you again in Explore and on profiles."
            : "Their lessons stop showing for you in Explore and on profiles. They aren't told, and you can unblock them in Settings."}
        </DialogDescription>
      </DialogHeader>
      <FormError>{error}</FormError>
      <DialogFooter>
        <DialogClose isDisabled={busy}>Cancel</DialogClose>
        <Button
          variant={unblock ? "default" : "destructive"}
          isDisabled={busy}
          onPress={() => void run()}
        >
          {unblock ? "Unblock" : "Block"}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

/** A profile's Block (or Unblock) button, for a signed-in visitor; the page refreshes after. */
export function BlockButton({
  person,
  blocked,
}: {
  person: BlockTarget
  blocked: boolean
}) {
  const router = useRouter()
  const [isOpen, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onPress={() => setOpen(true)}>
        {blocked ? "Unblock" : "Block"}
      </Button>
      <BlockDialog
        person={person}
        unblock={blocked}
        isOpen={isOpen}
        onOpenChange={setOpen}
        onDone={() => router.refresh()}
      />
    </>
  )
}
