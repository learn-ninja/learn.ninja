"use client"

import * as React from "react"
import {
  CheckIcon,
  CopyIcon,
  EyeOffIcon,
  GlobeIcon,
  LockIcon,
  PencilIcon,
} from "lucide-react"

import { LEVELS, type Level } from "@workspace/spec"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Popover, PopoverTrigger } from "@workspace/ui/components/popover"
import { toast } from "@workspace/ui/components/sonner"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"

import { usePlayer } from "./context"
import { LESSON_CHANGES, type LessonChange, type Strings } from "./strings"

type Status = "private" | "published" | "hidden"

interface CreatorControls {
  status: Status
  busy: boolean
  publish?: () => void
  unpublish?: () => void
  openChanges: () => void
}

const ControlsContext = React.createContext<CreatorControls | null>(null)

/** The maker's controls, wherever the player shows them (the header, the phone menu); null for anyone else. */
export const useCreatorControls = () => React.useContext(ControlsContext)

/**
 * Holds what the lesson's maker can do from anywhere in the player: where the lesson stands (moved
 * on by Publish and Make private without a reload), and the Make changes dialog, which turns a new
 * level, ticked changes, and the maker's own words into one prompt to paste back into the chat
 * that made the lesson.
 */
export function CreatorProvider({
  level,
  children,
}: {
  level: Level
  children: React.ReactNode
}) {
  const { t, creator } = usePlayer()
  const [status, setStatus] = React.useState<Status>(
    creator?.status ?? "private"
  )
  React.useEffect(() => {
    if (creator) setStatus(creator.status)
  }, [creator?.status]) // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = React.useState(false)
  const [changesOpen, setChangesOpen] = React.useState(false)
  if (!creator) return children
  const { onPublish, onUnpublish } = creator

  /** Publishes or unpublishes, then says so in a toast, with Undo when it can go back. */
  async function move(to: "published" | "private", undoable = true) {
    const run = to === "published" ? onPublish : onUnpublish
    const back = to === "published" ? onUnpublish : onPublish
    if (!run || busy) return
    setBusy(true)
    const result = await run().catch(() => ({ error: "network" }))
    setBusy(false)
    if (result.error)
      return void toast.error(
        to === "published" ? t.publishFailed : t.makePrivateFailed
      )
    setStatus(to)
    toast.success(to === "published" ? t.creatorPublished : t.madePrivate, {
      description: to === "published" ? t.publishedBody : t.publishBody,
      action:
        undoable && back
          ? {
              label: t.undo,
              onClick: () =>
                void move(to === "published" ? "private" : "published", false),
            }
          : undefined,
    })
  }

  const controls: CreatorControls = {
    status,
    busy,
    publish: onPublish ? () => void move("published") : undefined,
    unpublish: onUnpublish ? () => void move("private") : undefined,
    openChanges: () => setChangesOpen(true),
  }
  return (
    <ControlsContext.Provider value={controls}>
      {children}
      <ChangesDialog
        isOpen={changesOpen}
        onOpenChange={setChangesOpen}
        url={creator.url}
        level={level}
      />
    </ControlsContext.Provider>
  )
}

const STATUS_COLOR: Record<Status, string> = {
  published: "text-green-600",
  hidden: "text-yellow-600 dark:text-yellow-500",
  private: "text-muted-foreground",
}

/**
 * The maker's Share, its icon saying where the lesson stands: a popover with the lesson's link to copy, a Show in Explore switch to
 * publish it or make it private, and Make changes.
 */
export function CreatorShare({
  url,
  className,
}: {
  url?: string
  className?: string
}) {
  const { t, creator } = usePlayer()
  const controls = useCreatorControls()
  const [open, setOpen] = React.useState(false)
  const id = React.useId()
  if (!controls || !creator) return null
  const link = url ?? creator.url
  const { Icon, label } = standing(t)[controls.status]

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast.success(t.linkCopied)
    } catch {
      // The link is still in the field to copy by hand.
      toast.error(t.copyFailed)
    }
  }

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      {/* Where the lesson stands is the button's icon, on every screen: a lock or a globe. */}
      <Button
        variant="outline"
        size="sm"
        aria-label={`${t.share}: ${label}`}
        className={className}
      >
        <Icon
          data-icon="inline-start"
          aria-hidden="true"
          className={STATUS_COLOR[controls.status]}
        />
        {t.share}
      </Button>
      <Popover placement="bottom end" className="w-80 gap-0 p-0">
        <div className="flex flex-col gap-2 p-3">
          <p className="font-medium">{t.share}</p>
          <div className="flex items-center gap-2">
            <Input
              aria-label={t.share}
              value={link}
              readOnly
              dir="ltr"
              onFocus={(e) => e.target.select()}
              className="h-7 flex-1 text-sm text-muted-foreground md:text-sm"
            />
            <Button variant="outline" size="sm" onPress={() => void copy()}>
              <CopyIcon data-icon="inline-start" />
              {t.copyLink}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t p-3">
          {/* One switch, always there, its label and body the same either way so it says what turning it on does: on is published, off is private; a hidden lesson can't be published. */}
          <div className="flex items-center justify-between gap-3">
            <p id={`${id}-explore`} className="font-medium">
              {t.showInExplore}
            </p>
            <Switch
              aria-labelledby={`${id}-explore`}
              aria-describedby={`${id}-explore-body`}
              isSelected={controls.status === "published"}
              isDisabled={
                controls.busy ||
                controls.status === "hidden" ||
                !(controls.status === "published"
                  ? controls.unpublish
                  : controls.publish)
              }
              // The popover stays open so the switch shows where the lesson now stands; the toast confirms it, with Undo.
              onChange={(on) => {
                const move = on ? controls.publish : controls.unpublish
                move?.()
              }}
            />
          </div>
          <p
            id={`${id}-explore-body`}
            className="text-sm text-muted-foreground"
          >
            {controls.status === "hidden" ? t.hiddenBody : t.publishedBody}
          </p>
        </div>
        <div className="border-t p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onPress={controls.openChanges}
          >
            <PencilIcon data-icon="inline-start" />
            {t.makeChanges}
          </Button>
        </div>
      </Popover>
    </PopoverTrigger>
  )
}

/** The same controls in the phone's menu: where the lesson stands, Publish or Make private, and Make changes. */
export function CreatorMenuItems() {
  const { t } = usePlayer()
  const controls = useCreatorControls()
  if (!controls) return null
  const { Icon, label } = standing(t)[controls.status]
  return (
    <>
      <DropdownMenuLabel className="flex items-center gap-1.5">
        <Icon
          aria-hidden="true"
          className={cn("size-3.5", STATUS_COLOR[controls.status])}
        />
        {label}
      </DropdownMenuLabel>
      {controls.status === "private" && controls.publish ? (
        <DropdownMenuItem onAction={controls.publish}>
          <GlobeIcon />
          {t.publish}
        </DropdownMenuItem>
      ) : controls.status === "published" && controls.unpublish ? (
        <DropdownMenuItem onAction={controls.unpublish}>
          <LockIcon />
          {t.makePrivate}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onAction={controls.openChanges}>
        <PencilIcon />
        {t.makeChanges}
      </DropdownMenuItem>
    </>
  )
}

function standing(t: Strings) {
  return {
    private: { Icon: LockIcon, label: t.creatorPrivate },
    published: { Icon: GlobeIcon, label: t.creatorPublished },
    hidden: { Icon: EyeOffIcon, label: t.creatorHidden },
  }
}

/**
 * The prompt Make changes copies: the lesson's link, then each change as a line of a list, a new
 * level first when there is one.
 */
export function changesPrompt(
  t: Strings,
  url: string,
  picked: LessonChange[],
  other: string,
  level?: Level
): string {
  const lines = [
    ...(level ? [t.changeLevel(t.levels[level])] : []),
    ...LESSON_CHANGES.filter((c) => picked.includes(c)).map(
      (c) => t.changes[c]
    ),
    ...(other.trim() ? [other.trim()] : []),
  ]
  if (!lines.length) return ""
  return `${t.changesPrompt(url)}\n${lines.map((l) => `- ${l}`).join("\n")}`
}

/**
 * The level to pick, starting at the lesson's own, ready-made changes to tick, and a box for anything
 * else, copied as one prompt. The page can't reach the maker's chat, so they paste it there; their
 * agent updates the lesson at the same link. The picks stay while the page is open, in case they
 * come back for more.
 */
function ChangesDialog({
  isOpen,
  onOpenChange,
  url,
  level,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  url: string
  level: Level
}) {
  const { t } = usePlayer()
  const [target, setTarget] = React.useState(level)
  const [picked, setPicked] = React.useState<LessonChange[]>([])
  const [other, setOther] = React.useState("")
  const [note, setNote] = React.useState<{ error: boolean; text: string }>()
  const [copied, setCopied] = React.useState(false)
  const id = React.useId()

  // An edit after copying makes the copy stale: back to Copy changes.
  function edited() {
    setCopied(false)
    setNote(undefined)
  }

  async function copy(e: React.FormEvent) {
    e.preventDefault()
    if (copied) return close(false)
    const text = changesPrompt(
      t,
      url,
      picked,
      other,
      target === level ? undefined : target
    )
    if (!text) return setNote({ error: true, text: t.changesEmpty })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setNote({ error: false, text: t.changesCopied })
    } catch {
      setNote({ error: true, text: t.copyFailed })
    }
  }

  function close(open: boolean) {
    onOpenChange(open)
    if (!open) edited()
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={close}>
      <form onSubmit={(e) => void copy(e)} className="contents">
        <DialogHeader>
          <DialogTitle>{t.makeChanges}</DialogTitle>
          <DialogDescription>{t.changesBody}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label id={`${id}-level`}>{t.changesLevel}</Label>
          <ToggleGroup
            aria-labelledby={`${id}-level`}
            variant="outline"
            spacing={1}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[target]}
            onSelectionChange={(keys) => {
              const [next] = keys
              if (next === undefined) return
              setTarget(next as Level)
              edited()
            }}
            className="w-full"
          >
            {LEVELS.map((l) => (
              // Selected as other controls are: the toggle's own fill alone vanishes in dark mode.
              <ToggleGroupItem
                key={l}
                id={l}
                className="flex-1 data-selected:border-primary"
              >
                {t.levels[l]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-3">
          {LESSON_CHANGES.map((change) => (
            <div key={change} className="flex items-center gap-2">
              <Checkbox
                id={`${id}-${change}`}
                isSelected={picked.includes(change)}
                onChange={(on) => {
                  setPicked((was) =>
                    on ? [...was, change] : was.filter((c) => c !== change)
                  )
                  edited()
                }}
              />
              <Label htmlFor={`${id}-${change}`} className="font-normal">
                {t.changes[change]}
              </Label>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-other`}>{t.changesOther}</Label>
          <Textarea
            id={`${id}-other`}
            value={other}
            placeholder={t.changesPlaceholder}
            onChange={(e) => {
              setOther(e.target.value)
              edited()
            }}
          />
        </div>
        <DialogFooter className="sm:items-center">
          <p
            role="status"
            className={cn(
              "text-sm sm:me-auto",
              note?.error ? "text-destructive" : "text-muted-foreground",
              !note && "sr-only"
            )}
          >
            {note?.text}
          </p>
          <DialogClose>{t.cancel}</DialogClose>
          <Button type="submit">
            {copied ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copied ? t.changesDone : t.copyChanges}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
