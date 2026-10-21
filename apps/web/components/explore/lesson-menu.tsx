"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { EyeOffIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTarget,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu"
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

import { FormError } from "@/components/account/form-error"
import { exploreApi, TITLE_MAX, type ExploreApi } from "@/lib/explore/browser"
import type { Visibility } from "@/lib/explore/queries"

type Action = "unpublish" | "rename" | "delete"

/**
 * The title link of a row the viewer made, with a menu on right click (or a long press, or
 * Shift+F10): unpublish it (back to link-only, so it leaves Explore and the profile), rename it,
 * or delete it. Each opens a dialog that says what happens and shows the server's error, then the
 * page refreshes so the row shows the change or goes. The link covers the whole row, so the menu
 * opens anywhere on it except the author, the check, and the heart.
 */
export function LessonMenu(props: Omit<LessonMenuViewProps, "onDone">) {
  const router = useRouter()
  return <LessonMenuView {...props} onDone={() => router.refresh()} />
}

interface LessonMenuViewProps {
  lesson: {
    id: string
    title: string
    language: string
    visibility: Visibility
  }
  href: string
  className?: string
  children: React.ReactNode
  api?: ExploreApi
  /** After a change went through: the page refreshes. */
  onDone: () => void
}

/** LessonMenu without Next's router, for Storybook. */
export function LessonMenuView({
  lesson,
  href,
  className,
  children,
  api = exploreApi,
  onDone,
}: LessonMenuViewProps) {
  // The action stays set while the dialog closes, so its words don't change as it fades.
  const [action, setAction] = React.useState<Action>("rename")
  const [isOpen, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState(lesson.title)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const fieldId = React.useId()

  function open(next: Action) {
    setTitle(lesson.title)
    setError(null)
    setAction(next)
    setOpen(true)
  }

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (action === "rename" && !title.trim()) {
      return setError("Give it a title first.")
    }
    setBusy(true)
    setError(null)
    const result =
      action === "unpublish"
        ? await api.setVisibility(lesson.id, "unlisted")
        : action === "rename"
          ? await api.rename(lesson.id, title)
          : await api.remove(lesson.id)
    setBusy(false)
    if (result.error) return setError(result.error)
    setOpen(false)
    onDone()
  }

  return (
    <>
      <ContextMenuTrigger>
        <ContextMenuTarget>
          <Link
            href={href}
            data-slot="row-link"
            lang={lesson.language}
            dir="auto"
            className={className}
          >
            {children}
          </Link>
        </ContextMenuTarget>
        <ContextMenu
          aria-label={`Manage ${lesson.title}`}
          onAction={(key) => open(key as Action)}
        >
          {lesson.visibility === "public" ? (
            <ContextMenuItem id="unpublish" textValue="Unpublish">
              <EyeOffIcon aria-hidden="true" />
              Unpublish
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem id="rename" textValue="Rename">
            <PencilIcon aria-hidden="true" />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem id="delete" textValue="Delete" variant="destructive">
            <Trash2Icon aria-hidden="true" />
            Delete
          </ContextMenuItem>
        </ContextMenu>
      </ContextMenuTrigger>
      <Dialog
        isOpen={isOpen}
        onOpenChange={(next) => {
          if (!busy) setOpen(next)
        }}
      >
        <form onSubmit={(e) => void run(e)} className="contents">
          {action === "unpublish" ? (
            <DialogHeader>
              <DialogTitle>Unpublish this lesson?</DialogTitle>
              <DialogDescription>
                It leaves Explore and your profile. Its link keeps working, and
                you can list it again in your settings.
              </DialogDescription>
            </DialogHeader>
          ) : action === "rename" ? (
            <>
              <DialogHeader>
                <DialogTitle>Rename this lesson</DialogTitle>
                <DialogDescription>
                  The new title shows everywhere. Its link stays the same.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor={fieldId}>Title</Label>
                <Input
                  id={fieldId}
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={TITLE_MAX}
                  disabled={busy}
                  lang={lesson.language}
                  dir="auto"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </>
          ) : (
            <DialogHeader>
              <DialogTitle>Delete this lesson?</DialogTitle>
              <DialogDescription>
                It&apos;s gone for good, with its plays and likes, and its link
                stops working. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
          )}
          <FormError>{error}</FormError>
          <DialogFooter>
            <DialogClose isDisabled={busy}>Cancel</DialogClose>
            <Button
              type="submit"
              variant={action === "delete" ? "destructive" : "default"}
              isDisabled={busy}
            >
              {action === "unpublish"
                ? "Unpublish"
                : action === "rename"
                  ? "Save"
                  : "Delete lesson"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}
