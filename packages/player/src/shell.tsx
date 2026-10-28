"use client"

import * as React from "react"
import {
  createLucideIcon,
  ChevronDownIcon,
  ClockIcon,
  EllipsisIcon,
  GlobeIcon,
  KeyboardIcon,
  MonitorIcon,
  MoonIcon,
  RotateCcwIcon,
  SettingsIcon,
  ShareIcon,
  SunIcon,
  TypeIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react"

import type { ConceptKata } from "@workspace/spec"
import { Button, LinkButton } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Kbd } from "@workspace/ui/components/kbd"
import { Popover, PopoverTrigger } from "@workspace/ui/components/popover"
import { Progress } from "@workspace/ui/components/progress"
import { Slider } from "@workspace/ui/components/slider"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { usePlayer } from "./context"
import { CreatorMenuItems, CreatorShare, useCreatorControls } from "./creator"
import type { QuestionCount } from "./flow"
import { BRAND, LearnLogo } from "./logo"
import { Ninja, type NinjaMood } from "./ninja"
import { RichBlocks } from "./rich-text"
import { timeLeft, type TimeLeft } from "./time"
import {
  UI_LANGUAGES,
  UI_TRANSLATIONS,
  uiLanguageFor,
  type NinjaLevel,
  type Strings,
  type TextSize,
  type Theme,
} from "./strings"
import { hasVoice } from "./voices"

// The frame around every lesson screen: header (home, title menu, progress, Share), the player's
// settings at the end of the tray, footer (credit and app settings), and the Theory panel. Layout
// follows the Figma frame "Learn" (node 2004:15459).
//
// Three kinds of controls, each in its own place: the header is about this lesson (title, progress,
// share, restart) plus a gear menu for the app (theme, language); the tray is about how you play
// (the screen's actions in the middle, the ninja at the start where he lives, text size at the end);
// the footer holds the credit, the legal and docs links, and the keyboard shortcuts.

/** Lucide's PanelRight with the panel filled in, for showing the Theory panel is open. */
export const PanelRightFilledIcon = createLucideIcon("panel-right-filled", [
  [
    "rect",
    { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "frame" },
  ],
  ["path", { d: "M15 3v18", key: "divider" }],
  [
    "path",
    {
      d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4Z",
      fill: "currentColor",
      key: "panel",
    },
  ],
])

// ---------- viewer preferences (kept in this browser only) ----------

export interface Preferences {
  textSize: TextSize
  /** The viewer's chosen language for the player's own text. */
  uiLanguage?: string
  /** Whether the tray of action buttons under the lesson is open (it is until closed). */
  tray?: "open" | "closed"
  /** The ninja's voice (on until muted). */
  sound?: "on" | "off"
  /** The ninja's character (Sensei until changed). */
  ninja?: NinjaLevel
}

const PREFERENCES_KEY = "learn:preferences"

/** The viewer's preferences, the setter, and whether the saved ones have been read yet. */
export function usePreferences() {
  const [prefs, setPrefs] = React.useState<Preferences>({ textSize: "md" })
  const [loaded, setLoaded] = React.useState(false)
  React.useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(PREFERENCES_KEY) ?? "{}"
      ) as Partial<Preferences> & { ninja?: string }
      // The characters were renamed: Normal became Default (now Casual), and Sensei took Caffeinated's place.
      const renamed: Record<string, NinjaLevel> = {
        normal: "casual",
        default: "casual",
        caffeinated: "sensei",
      }
      if (saved.ninja && saved.ninja in renamed)
        saved.ninja = renamed[saved.ninja]
      // In a transition: a saved language keeps the current one up until it has loaded, and
      // `loaded` turns true in the same commit as the preferences it read.
      React.startTransition(() => {
        setPrefs((p) => ({ ...p, ...(saved as Partial<Preferences>) }))
        setLoaded(true)
      })
    } catch {
      // Storage can be blocked or empty; the defaults are fine.
      setLoaded(true)
    }
  }, [])
  const update = React.useCallback((patch: Partial<Preferences>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch }
      try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next))
      } catch {
        // Not saved; the choice still applies until the page closes.
      }
      return next
    })
  }, [])
  return [prefs, update, loaded] as const
}

/** Time until the link expires, updated every minute. Null until mounted. */
export function useTimeLeft(expiresAt?: number): TimeLeft | null {
  const [left, setLeft] = React.useState<TimeLeft | null>(null)
  React.useEffect(() => {
    if (!expiresAt) return
    const update = () => setLeft(timeLeft(expiresAt - Date.now()))
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [expiresAt])
  return expiresAt ? left : null
}

// ---------- header ----------

export function LessonHeader({
  title,
  progress,
  count,
  startedAt,
  endedAt,
  showProgress = true,
  expiresAt,
  homeHref,
  shareUrl,
  settings,
  menuItems,
  phoneMenu,
  onRestart,
  onRename,
  t,
}: {
  title: string
  /** How far through the lesson, 0–100. */
  progress: number
  count: QuestionCount
  /** When the learner left the title screen, and when they reached the wrap-up (ms since epoch). */
  startedAt?: number
  endedAt?: number
  /** False on the title screen: the bar appears with the first question. */
  showProgress?: boolean
  expiresAt?: number
  homeHref: string
  shareUrl?: string
  /** The app's settings menu, shown before Share. */
  settings?: React.ReactNode
  /** The app's own entries for the lesson menu, after Restart. */
  menuItems?: React.ReactNode
  /**
   * Sections for the end of the phone menu: on phones one menu holds what the gear, the tray's
   * settings, and the footer hold on wider screens.
   */
  phoneMenu?: React.ReactNode
  onRestart: () => void
  /** Called with the new title when the learner renames the lesson in the header. */
  onRename?: (title: string) => void
  t: Strings
}) {
  const left = useTimeLeft(expiresAt)
  const [confirmRestart, setConfirmRestart] = React.useState(false)
  const controls = useCreatorControls()
  return (
    // On phones the header is the logo, the progress bar, and one menu: the title shows only on the
    // intro (the screen itself names the lesson after that), and the gear, Share, and the footer's
    // links move into the menu.
    <header className="flex h-14 shrink-0 items-center gap-2 px-4 max-sm:gap-3 sm:h-16 sm:px-8">
      <div
        className={cn(
          "flex min-w-0 items-center sm:flex-1",
          !showProgress && "flex-1"
        )}
      >
        <LinkButton
          href={homeHref}
          variant="ghost"
          size="icon-sm"
          aria-label={t.home}
          className={PHONE_HIT}
        >
          <LearnLogo className="size-5.5" />
        </LinkButton>
        {/* The mark sits 3px inside its box and the title text 10px in (a 4px margin plus the button's
            6px padding), so the slash's margins are uneven on purpose: the visible gaps come out the
            same on both sides. */}
        <span
          aria-hidden="true"
          className={cn(
            "ms-2 text-xs text-muted-foreground",
            showProgress && "max-sm:hidden"
          )}
        >
          /
        </span>
        <div
          className={cn(
            "flex min-w-0 items-center",
            showProgress && "max-sm:hidden"
          )}
        >
          <LessonTitle title={title} onRename={onRename} t={t} />
          <DropdownMenuTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.lessonMenu}
              className="max-sm:hidden"
            >
              <ChevronDownIcon />
            </Button>
            <DropdownMenu className="w-auto">
              <DropdownMenuGroup>
                {left ? (
                  <DropdownMenuLabel className="flex items-center gap-1.5">
                    <ClockIcon className="size-3.5" aria-hidden="true" />
                    {t.expires[left.unit](left.count)}
                  </DropdownMenuLabel>
                ) : null}
                <DropdownMenuItem onAction={() => setConfirmRestart(true)}>
                  <RotateCcwIcon />
                  {t.restart}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {menuItems ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>{menuItems}</DropdownMenuGroup>
                </>
              ) : null}
            </DropdownMenu>
          </DropdownMenuTrigger>
        </div>
        <Dialog isOpen={confirmRestart} onOpenChange={setConfirmRestart}>
          <DialogHeader>
            <DialogTitle>{t.restartTitle}</DialogTitle>
            <DialogDescription>{t.restartBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>{t.stay}</DialogClose>
            <DialogClose variant="destructive" onPress={onRestart}>
              {t.restart}
            </DialogClose>
          </DialogFooter>
        </Dialog>
      </div>
      {showProgress ? (
        <LessonProgress
          value={progress}
          count={count}
          startedAt={startedAt}
          endedAt={endedAt}
          t={t}
        />
      ) : (
        // Holds the middle of the header so the buttons don't shift when the bar appears.
        <div aria-hidden="true" className="min-w-0 max-sm:hidden sm:flex-1" />
      )}
      <div className="flex items-center justify-end gap-2 max-sm:hidden sm:flex-1">
        {settings}
        {/* The maker's Share shows where the lesson stands and holds the link and publishing. */}
        {controls ? (
          <CreatorShare url={shareUrl} />
        ) : (
          <ShareButton title={title} url={shareUrl} t={t} />
        )}
      </div>
      <PhoneMenu
        title={title}
        expires={left ? t.expires[left.unit](left.count) : null}
        shareUrl={shareUrl}
        onRestart={() => setConfirmRestart(true)}
        menuItems={menuItems}
        phoneMenu={phoneMenu}
        t={t}
      />
    </header>
  )
}

/**
 * The frame's buttons are 28–32px, under the 44px a thumb needs. On phones this grows the tap
 * target with an invisible margin around the button, without changing how it looks.
 */
export const PHONE_HIT =
  "max-sm:relative max-sm:after:absolute max-sm:after:-inset-1.5"

/** Everything the header's chevron menu, gear, and Share hold on wider screens, in one menu for phones. */
function PhoneMenu({
  title,
  expires,
  shareUrl,
  onRestart,
  menuItems,
  phoneMenu,
  t,
}: {
  title: string
  expires: string | null
  shareUrl?: string
  onRestart: () => void
  menuItems?: React.ReactNode
  phoneMenu?: React.ReactNode
  t: Strings
}) {
  const { share } = useShare(title, shareUrl, t)
  const controls = useCreatorControls()
  return (
    <DropdownMenuTrigger>
      <Button
        variant="outline"
        size="icon"
        aria-label={t.lessonMenu}
        className={cn("sm:hidden", PHONE_HIT)}
      >
        <EllipsisIcon />
      </Button>
      <DropdownMenu
        placement="bottom end"
        // Rows a thumb can hit.
        className="w-auto max-w-72 min-w-56 **:data-[slot=dropdown-menu-item]:py-2 **:data-[slot=dropdown-menu-sub-trigger]:py-2"
      >
        <DropdownMenuGroup aria-label={title}>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm text-foreground">{title}</span>
            {expires ? (
              <span className="flex items-center gap-1.5">
                <ClockIcon className="size-3.5" aria-hidden="true" />
                {expires}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuItem onAction={() => void share()}>
            <ShareIcon />
            {t.share}
          </DropdownMenuItem>
          <DropdownMenuItem onAction={onRestart}>
            <RotateCcwIcon />
            {t.restart}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {controls ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <CreatorMenuItems />
            </DropdownMenuGroup>
          </>
        ) : null}
        {menuItems ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>{menuItems}</DropdownMenuGroup>
          </>
        ) : null}
        {phoneMenu}
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}

/** The lesson's title. Press it to edit; Enter or leaving the field saves, Escape cancels. */
function LessonTitle({
  title,
  onRename,
  t,
}: {
  title: string
  onRename?: (title: string) => void
  t: Strings
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const commit = () => {
    const next = draft?.trim()
    if (next && next !== title) onRename?.(next)
    setDraft(null)
  }
  if (draft !== null)
    return (
      // Edited in place: the field takes the title's exact look and spot, and its width follows the
      // text (the hidden copy underneath sets the size). Nothing moves when editing starts.
      // The field floats over an invisible copy of the text, so only the text sets the width: an
      // input in the flow would widen the box to its own default size on short titles.
      <span className="relative ms-1 inline-block max-w-40 min-w-0 shrink sm:max-w-80">
        <span
          aria-hidden="true"
          className="invisible block h-7 border border-transparent px-1.5 text-sm font-medium whitespace-pre"
        >
          {draft || " "}
        </span>
        <Input
          autoFocus
          aria-label={t.lessonName}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") setDraft(null)
          }}
          className="absolute inset-0 h-7 w-full min-w-0 border-transparent bg-muted px-1.5 text-sm font-medium shadow-none md:text-sm dark:bg-muted"
        />
      </span>
    )
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t.renameLesson}
      onPress={() => setDraft(title)}
      // Hugs the title up to a cap, then truncates (titles are at most 60 characters).
      className="ms-1 max-w-40 min-w-0 shrink px-1.5 sm:max-w-80"
    >
      <span className="truncate">{title}</span>
    </Button>
  )
}

/**
 * One bar for the whole lesson. The question count and the time spent wait behind it: hovering or
 * focusing the bar shows them, and so does a tap on touch screens, so they're there when wanted
 * and out of the way otherwise.
 */
function LessonProgress({
  value,
  count,
  startedAt,
  endedAt,
  t,
}: {
  value: number
  count: QuestionCount
  startedAt?: number
  endedAt?: number
  t: Strings
}) {
  const [open, setOpen] = React.useState(false)
  // React Aria only opens a tooltip on hover when the last input was the mouse, and learners press
  // Enter all lesson long, so the bar opens on hover itself, after a short pause.
  const hover = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(hover.current), [])
  const counter = count.total > 0 ? `${count.current} / ${count.total}` : null
  return (
    <div className="flex min-w-0 flex-1 justify-center motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0">
      <TooltipTrigger
        isOpen={open}
        onOpenChange={setOpen}
        delay={300}
        shouldCloseOnPress={false}
      >
        <Button
          variant="ghost"
          size="sm"
          aria-label={counter ? `${t.progress}: ${counter}` : t.progress}
          onHoverStart={() => {
            window.clearTimeout(hover.current)
            hover.current = window.setTimeout(() => setOpen(true), 300)
          }}
          onHoverEnd={() => {
            window.clearTimeout(hover.current)
            setOpen(false)
          }}
          onPress={(e) => {
            // Touch has no hover, so a tap opens and closes the details.
            if (e.pointerType === "touch") setOpen((o) => !o)
          }}
          className="h-7 w-full cursor-help px-0 hover:bg-transparent active:translate-y-0 sm:max-w-[400px] dark:hover:bg-transparent"
        >
          <Progress
            value={value}
            aria-hidden="true"
            className="w-full transition-all duration-500 [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-track]]:h-2.5"
          />
        </Button>
        <Tooltip placement="bottom" className="tabular-nums">
          {counter ? (
            <span>{count.fixing ? t.fixing : t.progressLabel}</span>
          ) : null}
          {counter ? <span>{counter}</span> : null}
          {counter ? <span aria-hidden="true">·</span> : null}
          <Elapsed startedAt={startedAt} endedAt={endedAt} />
        </Tooltip>
      </TooltipTrigger>
    </div>
  )
}

/** Time spent as MM:SS (H:MM:SS past an hour), ticking while it's on screen. */
function Elapsed({
  startedAt,
  endedAt,
}: {
  startedAt?: number
  endedAt?: number
}) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (endedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [endedAt])
  const seconds = startedAt
    ? Math.max(0, Math.floor(((endedAt ?? now) - startedAt) / 1000))
    : 0
  return <span dir="ltr">{formatElapsed(seconds)}</span>
}

export function formatElapsed(seconds: number): string {
  const two = (n: number) => String(n).padStart(2, "0")
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}

/**
 * Shares the lesson: the system share sheet on phones, the link copied everywhere else, with a toast
 * that says so.
 */
export function useShare(title: string, url: string | undefined, t: Strings) {
  async function share() {
    const link = url ?? window.location.href
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url: link })
      } catch {
        // Dismissed by the viewer.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(link)
      toast.success(t.linkCopied)
    } catch {
      toast.error(t.copyFailed)
    }
  }

  return { share }
}

function ShareButton({
  title,
  url,
  t,
}: {
  title: string
  url?: string
  t: Strings
}) {
  const { share } = useShare(title, url, t)
  return (
    <Button variant="outline" size="sm" onPress={share} aria-label={t.share}>
      <ShareIcon className="sm:hidden" />
      <span className="max-sm:sr-only">{t.share}</span>
    </Button>
  )
}

// ---------- footer ----------

export function LessonFooter({
  homeHref,
  privacyHref,
  termsHref,
  docsHref,
  t,
  shortcutsOpen,
  onShortcutsChange,
}: {
  homeHref: string
  /** The legal pages and the docs. Omit any to hide its link. */
  privacyHref?: string
  termsHref?: string
  docsHref?: string
  t: Strings
  /** The keyboard shortcuts dialog, which "?" also opens. */
  shortcutsOpen: boolean
  onShortcutsChange: (open: boolean) => void
}) {
  const links = [
    [docsHref, t.docs],
    [privacyHref, t.privacy],
    [termsHref, t.terms],
  ].filter((l): l is [string, string] => Boolean(l[0]))
  return (
    // Phones have no room for it during a lesson: its links are in the header's menu there.
    <footer className="flex h-12 shrink-0 items-center gap-2 px-4 pb-[env(safe-area-inset-bottom,0px)] max-sm:hidden sm:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 ps-2 text-xs font-medium text-muted-foreground">
        <a
          href={homeHref}
          className="shrink-0 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="max-sm:hidden">© {new Date().getFullYear()} </span>
          {BRAND.name}
        </a>
        {links.map(([href, label]) => (
          <React.Fragment key={href}>
            <span aria-hidden="true">·</span>
            <a
              href={href}
              className="shrink-0 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {label}
            </a>
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1">
        {/* Touch screens have no keys to list. */}
        <Button
          variant="ghost"
          size="sm"
          aria-label={t.shortcuts}
          className="pointer-coarse:hidden"
          onPress={() => onShortcutsChange(true)}
        >
          <KeyboardIcon />
          <Kbd>?</Kbd>
        </Button>
        <ShortcutsDialog
          isOpen={shortcutsOpen}
          onOpenChange={onShortcutsChange}
          t={t}
        />
      </div>
    </footer>
  )
}

type AppSettingsProps = {
  theme?: Theme
  onThemeChange?: (theme: Theme) => void
  uiLanguage: string
  onPrefs: (patch: Partial<Preferences>) => void
  t: Strings
}

/** Props for a submenu that picks one of its items. */
const single = (onPick: (key: string) => void) => ({
  selectionMode: "single" as const,
  disallowEmptySelection: true,
  onSelectionChange: (keys: "all" | Iterable<unknown>) => {
    if (keys === "all") return
    const [key] = keys
    if (key !== undefined) onPick(String(key))
  },
})

/** The app's settings behind a gear in the header: theme and language as submenus. */
export function AppSettings(props: AppSettingsProps) {
  return (
    <DropdownMenuTrigger>
      <Button variant="outline" size="icon-sm" aria-label={props.t.settings}>
        <SettingsIcon />
      </Button>
      <DropdownMenu placement="bottom end" className="w-auto min-w-44">
        <DropdownMenuGroup aria-label={props.t.settings}>
          <AppSettingsItems {...props} />
        </DropdownMenuGroup>
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}

/** Theme and language as submenus, for the gear's menu and the phone menu. */
export function AppSettingsItems({
  theme,
  onThemeChange,
  uiLanguage,
  onPrefs,
  t,
}: AppSettingsProps) {
  const language = uiLanguageFor(uiLanguage) ?? UI_LANGUAGES[0]
  const ThemeIcon =
    theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorIcon
  return (
    <>
      {onThemeChange ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger textValue={t.theme}>
            <ThemeIcon />
            {t.theme}
            <span className="text-muted-foreground">
              {t.themes[theme ?? "system"]}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            aria-label={t.theme}
            selectedKeys={[theme ?? "system"]}
            {...single((key) => onThemeChange(key as Theme))}
          >
            {(["system", "light", "dark"] as const).map((id) => (
              <DropdownMenuItem key={id} id={id} textValue={t.themes[id]}>
                {t.themes[id]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
      {UI_TRANSLATIONS ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger textValue={t.language}>
            <GlobeIcon />
            {t.language}
            <span className="text-muted-foreground">{language.label}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            aria-label={t.language}
            // About nine rows; the rest scrolls.
            maxHeight={320}
            selectedKeys={[language.code]}
            {...single((code) => onPrefs({ uiLanguage: code }))}
          >
            {UI_LANGUAGES.map((l) => (
              <DropdownMenuItem key={l.code} id={l.code} textValue={l.label}>
                <span lang={l.code}>{l.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
    </>
  )
}

/** The keys the player answers to. Opened from the footer or with "?". */
function ShortcutsDialog({
  isOpen,
  onOpenChange,
  t,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  t: Strings
}) {
  // A range (1–9), or a pair of keys that each do it (← and →).
  const rows: [keys: string[], label: string, join?: "pair"][] = [
    [["Enter"], t.shortcutMain],
    [["1", "9"], t.shortcutPick],
    [["↑", "↓"], t.shortcutOrder, "pair"],
    [["←", "→"], t.shortcutSort, "pair"],
    [["Delete"], t.shortcutUnsort],
    [["D"], t.shortcutTray],
    [["W"], t.why],
    [["?"], t.shortcutHelp],
  ]
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{t.shortcuts}</DialogTitle>
      </DialogHeader>
      <ul className="flex flex-col divide-y">
        {rows.map(([keys, label, join]) => (
          <li
            key={label}
            className="flex items-center justify-between gap-4 py-2 text-sm"
          >
            <span>{label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {keys.map((key, i) => (
                <React.Fragment key={key}>
                  {i > 0 && join !== "pair" ? (
                    <span className="text-xs text-muted-foreground">–</span>
                  ) : null}
                  <Kbd>{key}</Kbd>
                </React.Fragment>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

// ---------- player settings (the end of the tray) ----------

/** Every button in the tray is `lg` and a pill, with room for the round ends. */
export const TRAY_BUTTON = "rounded-full px-4"

/**
 * The tray is grey (bg-muted), which is also a ghost button's hover and open colour, so a ghost
 * button in the tray steps off it: a shade darker in light mode, a lighter wash in dark mode.
 */
export const TRAY_GHOST =
  "hover:bg-input aria-expanded:bg-input dark:hover:bg-input/50 dark:aria-expanded:bg-input/50"

export const NINJA_LEVELS = [
  "off",
  "sensei",
  "casual",
  "unhinged",
] as const satisfies readonly NinjaLevel[]

/** The signature move the preview plays when you land on each level. */
const NINJA_PREVIEW: Record<NinjaLevel, NinjaMood> = {
  off: "closed",
  sensei: "bow",
  casual: "happy",
  unhinged: "flip",
}

/**
 * Settings that change how the lesson plays, in the tray. The ninja's sits at the start, under the
 * corner he lives in; text size and sound sit at the end. Sound is his voice, so it shows only in a
 * language he speaks.
 */
export function PlayerSettings({
  side,
  prefs,
  onPrefs,
  t,
}: {
  /** Which end of the tray: the ninja's setting, or text size and sound. */
  side: "start" | "end"
  prefs: Preferences
  onPrefs: (patch: Partial<Preferences>) => void
  t: Strings
}) {
  const { lang = "en" } = usePlayer()
  const sound = prefs.sound ?? "on"
  const ninja = prefs.ninja ?? "sensei"
  if (side === "start")
    return (
      <NinjaSetting
        value={ninja}
        onChange={(ninja) => onPrefs({ ninja })}
        t={t}
      />
    )
  return (
    <>
      <SettingMenu
        label={t.textSize}
        icon={<TypeIcon />}
        value={prefs.textSize}
        valueLabel={t.sizesShort[prefs.textSize]}
        defaultValue="md"
        defaultLabel={t.defaultOption}
        options={(["sm", "md", "lg"] as const).map((id) => ({
          id,
          label: t.sizes[id],
        }))}
        onChange={(textSize) => onPrefs({ textSize })}
        size="lg"
        className={cn(TRAY_BUTTON, TRAY_GHOST)}
      />
      {hasVoice(lang) ? (
        <Button
          variant="ghost"
          size="lg"
          className={cn(TRAY_BUTTON, TRAY_GHOST)}
          aria-label={`${t.sound}: ${sound === "on" ? t.sound : t.muted}`}
          onPress={() => onPrefs({ sound: sound === "on" ? "off" : "on" })}
        >
          {sound === "on" ? <Volume2Icon /> : <VolumeXIcon />}
          <span className="max-sm:sr-only">
            {sound === "on" ? t.sound : t.muted}
          </span>
        </Button>
      ) : null}
    </>
  )
}

/** The tray's settings (the ninja and text size as submenus, and sound) for the phone menu. */
export function PlayerSettingsItems({
  prefs,
  onPrefs,
  t,
}: {
  prefs: Preferences
  onPrefs: (patch: Partial<Preferences>) => void
  t: Strings
}) {
  const { lang = "en" } = usePlayer()
  const sound = prefs.sound ?? "on"
  const ninja = prefs.ninja ?? "sensei"
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger textValue={t.ninja}>
          <Ninja
            mood={ninja === "off" ? "closed" : "idle"}
            className="size-4"
          />
          {t.ninja}
          <span className="text-muted-foreground">{t.ninjaLevels[ninja]}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent
          aria-label={t.ninja}
          className="max-w-64"
          selectedKeys={[ninja]}
          {...single((key) => onPrefs({ ninja: key as NinjaLevel }))}
        >
          {NINJA_LEVELS.map((id) => (
            <DropdownMenuItem key={id} id={id} textValue={t.ninjaLevels[id]}>
              <span className="flex flex-col">
                {t.ninjaLevels[id]}
                <span className="text-xs text-muted-foreground">
                  {t.ninjaHints[id]}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger textValue={t.textSize}>
          <TypeIcon />
          {t.textSize}
          <span className="text-muted-foreground">
            {t.sizesShort[prefs.textSize]}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent
          aria-label={t.textSize}
          selectedKeys={[prefs.textSize]}
          {...single((key) => onPrefs({ textSize: key as TextSize }))}
        >
          {(["sm", "md", "lg"] as const).map((id) => (
            <DropdownMenuItem key={id} id={id} textValue={t.sizes[id]}>
              {t.sizes[id]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {hasVoice(lang) ? (
        <DropdownMenuItem
          textValue={sound === "on" ? t.sound : t.muted}
          aria-label={`${t.sound}: ${sound === "on" ? t.sound : t.muted}`}
          onAction={() => onPrefs({ sound: sound === "on" ? "off" : "on" })}
        >
          {sound === "on" ? <Volume2Icon /> : <VolumeXIcon />}
          {sound === "on" ? t.sound : t.muted}
        </DropdownMenuItem>
      ) : null}
    </>
  )
}

/** The ninja's character: a slider with four stops, from hidden to unhinged, with him previewing each and a line on what to expect. */
function NinjaSetting({
  value,
  onChange,
  t,
}: {
  value: NinjaLevel
  onChange: (level: NinjaLevel) => void
  t: Strings
}) {
  const index = NINJA_LEVELS.indexOf(value)
  return (
    <PopoverTrigger>
      <Button
        variant="ghost"
        size="lg"
        className={cn(TRAY_BUTTON, TRAY_GHOST)}
        aria-label={`${t.ninja}: ${t.ninjaLevels[value]}`}
      >
        <Ninja mood={value === "off" ? "closed" : "idle"} />
        <span className="max-sm:sr-only">{t.ninjaLevels[value]}</span>
      </Button>
      <Popover placement="top start" className="w-64 gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{t.ninja}</span>
          {/* Announced on change, since the slider itself only says the stop's number. */}
          <span aria-live="polite" className="text-muted-foreground">
            {t.ninjaLevels[value]}
          </span>
        </div>
        {/* What each character is like, so the names don't have to explain themselves. */}
        <p className="text-sm text-muted-foreground">{t.ninjaHints[value]}</p>
        <div className="flex items-center gap-4">
          <Ninja
            mood={NINJA_PREVIEW[value]}
            className={cn(
              "size-10 shrink-0 transition-opacity",
              value === "off" && "opacity-30"
            )}
          />
          <Slider
            aria-label={t.ninja}
            minValue={0}
            maxValue={NINJA_LEVELS.length - 1}
            step={1}
            ticks
            value={index}
            onChange={(v) => {
              const next = NINJA_LEVELS[Array.isArray(v) ? v[0]! : v]
              if (next && next !== value) onChange(next)
            }}
          />
        </div>
      </Popover>
    </PopoverTrigger>
  )
}

function SettingMenu<K extends string>({
  label,
  icon,
  value,
  valueLabel,
  defaultValue,
  defaultLabel,
  options,
  onChange,
  placement = "top end",
  size = "sm",
  className,
}: {
  label: string
  icon: React.ReactNode
  value: K
  valueLabel: string
  /** The option used until the viewer picks one, marked with defaultLabel. */
  defaultValue?: K
  defaultLabel?: string
  options: { id: K; label: string; lang?: string }[]
  onChange: (value: K) => void
  /** Up from the tray, down from the header. */
  placement?: "top end" | "bottom end"
  size?: "sm" | "lg"
  className?: string
}) {
  return (
    <DropdownMenuTrigger>
      <Button
        variant="ghost"
        size={size}
        className={className}
        aria-label={`${label}: ${valueLabel}`}
      >
        {icon}
        <span className="max-sm:sr-only">{valueLabel}</span>
      </Button>
      <DropdownMenu
        placement={placement}
        // About nine rows; longer lists (languages) scroll inside.
        maxHeight={320}
        className="w-auto min-w-40"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          if (keys === "all") return
          const [key] = keys
          if (key !== undefined) onChange(String(key) as K)
        }}
      >
        <DropdownMenuGroup aria-label={label}>
          {options.map((o) => (
            <DropdownMenuItem key={o.id} id={o.id} textValue={o.label}>
              <span>
                <span lang={o.lang}>{o.label}</span>
                {o.id === defaultValue ? (
                  <span className="text-muted-foreground"> {defaultLabel}</span>
                ) : null}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}

// ---------- Theory panel ----------

/** The concepts the learner has reached so far, to re-read during practice. */
export function TheoryPanel({
  id,
  concepts,
  onClose,
  t,
  textSize,
}: {
  id: string
  concepts: ConceptKata[]
  onClose: () => void
  t: Strings
  textSize: TextSize
}) {
  return (
    <aside
      id={id}
      aria-label={t.theory}
      className="absolute inset-0 z-20 flex flex-col overflow-hidden border-y bg-background motion-safe:animate-in motion-safe:fade-in-0 sm:inset-x-8 sm:rounded-2xl sm:border lg:static lg:w-[360px] lg:shrink-0"
    >
      <div className="flex items-center justify-between gap-2 px-6 pt-6 pb-4">
        <h2 className="text-xl font-semibold">{t.theory}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t.closeTheory}
          onPress={onClose}
          className="lg:hidden"
        >
          <XIcon />
        </Button>
      </div>
      <div
        data-text-size={textSize}
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-6"
      >
        {concepts.length ? (
          <ol className="flex flex-col gap-6">
            {concepts.map((c) => (
              <li key={c.id} className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold">{c.title}</h3>
                <RichBlocks text={c.body} className="text-sm" />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{t.theoryEmpty}</p>
        )}
      </div>
    </aside>
  )
}
