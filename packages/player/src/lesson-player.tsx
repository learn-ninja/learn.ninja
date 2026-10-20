"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { LightbulbIcon, PanelRightIcon, RotateCcwIcon } from "lucide-react"

import type {
  ConceptBrick as ConceptBrickData,
  Lesson,
  QuestionBrick,
} from "@workspace/spec"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button, LinkButton } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { DirectionProvider } from "@workspace/ui/components/direction"
import { cn } from "@workspace/ui/lib/utils"

import {
  checkAnswer,
  initialAnswer,
  isReady,
  retryAnswer,
  shuffle,
  solution,
  solutionMarks,
  type Answer,
  type CheckResult,
  type Mark,
} from "./check"
import { Briefing } from "./briefing"
import { PlayerProvider, usePlayer } from "./context"
import { TimeAgo } from "./time"
import {
  hasOptionCards,
  BlankBrick,
  ConceptBrick,
  HotspotBrick,
  MatchBrick,
  Explanation,
  explanationAnchor,
  OptionsBrick,
} from "./bricks"
import { OrderBrick } from "./order"
import { SortBrick } from "./sort"
import {
  buildSequence,
  outcomeFor,
  progressAt,
  questionAt,
  summarize,
  type Item,
  type Outcome,
  type Role,
} from "./flow"
import {
  Aura,
  hueFor,
  Ninja,
  NinjaStage,
  reducedMotion,
  type CueKind,
  type NinjaCue,
} from "./ninja"
import { emptyPrepared, type Prepared } from "./prepared"
import {
  fingerprint,
  loadProgress,
  resumeScript,
  saveProgress,
} from "./progress"
import { seeded } from "./random"
import { plainText, RichText } from "./rich-text"
import {
  AppSettings,
  LessonFooter,
  LessonHeader,
  PanelRightFilledIcon,
  PlayerSettings,
  TheoryPanel,
  TRAY_BUTTON,
  TRAY_GHOST,
  usePreferences,
  type Preferences,
} from "./shell"
import {
  ariaLocaleFor,
  stringsFor,
  type NinjaLevel,
  type Strings,
  type TextSize,
  type Theme,
} from "./strings"
import { Visual } from "./visuals"
import {
  CADENCE,
  characterFor,
  createLinePicker,
  voiceLines,
  type LinePicker,
  type Moment,
} from "./voices"

/** Who published a lesson: their handle, where it links, and their picture when they have one. */
export interface Author {
  handle: string
  href: string
  image?: string | null
}

export interface LessonPlayerProps {
  lesson: Lesson
  /** Formulas and code prepared on the server (prepareLesson). */
  prepared?: Prepared
  /** Language of the player's own text. Defaults to the viewer's saved choice, then the lesson's language. */
  uiLanguage?: string
  /** When the lesson link expires (ms since epoch). Omit to hide the expiry note. */
  expiresAt?: number
  /** Stylesheet loaded inside the sandbox for HTML visuals. */
  visualsCss?: string
  /** Where the logo in the header goes. */
  homeHref?: string
  /** The Docs link in the footer. Omit it to hide it. */
  docsHref?: string
  /** Footer links to the legal pages. Omit either to hide it. */
  privacyHref?: string
  termsHref?: string
  /** The link Share copies. Defaults to the current page. */
  shareUrl?: string
  /** Who published the lesson, credited on the title screen with a link to their profile. */
  author?: Author
  /** When the lesson was published, shown on the title screen as how long ago. */
  publishedAt?: number
  /** The app's own entries for the lesson menu (the chevron by the title), after the player's. */
  menuItems?: React.ReactNode
  /** The app's color theme. Pass both to show the theme setting in the footer. */
  theme?: Theme
  onThemeChange?: (theme: Theme) => void
  /** Called when the learner renames the lesson in the header. The player shows the new name either way. */
  onRename?: (title: string) => void
  /** For demos: open on this brick instead of the intro, shuffled the same way on the server and in the browser. */
  startAt?: string
  /** For demos on a page with other players: only take keyboard shortcuts from inside this player. */
  scopeKeys?: boolean
  /** For product shots: just the lesson window, without the header and footer. */
  chrome?: boolean
  /**
   * Save where the learner is in the browser under this key (one per lesson page), so reopening or
   * reloading the page carries on from the same screen. Omit it to start fresh every time.
   */
  progressKey?: string
}

export function LessonPlayer({
  lesson,
  prepared = emptyPrepared,
  uiLanguage,
  expiresAt,
  visualsCss = "/lesson-visuals.css",
  homeHref = "/",
  docsHref,
  privacyHref,
  termsHref,
  shareUrl,
  author,
  publishedAt,
  menuItems,
  theme,
  onThemeChange,
  onRename,
  startAt,
  scopeKeys = false,
  chrome = true,
  progressKey,
}: LessonPlayerProps) {
  const root = React.useRef<HTMLDivElement>(null)
  // The title as shown, which a rename in the header changes.
  const [title, setTitle] = React.useState(lesson.title)
  React.useEffect(() => setTitle(lesson.title), [lesson.title])
  const shown = React.useMemo(() => ({ ...lesson, title }), [lesson, title])
  const [prefs, setPrefs] = usePreferences()
  const coarse = useCoarsePointer()
  // The keyboard shortcuts dialog lives in the footer; "?" (handled in the player) opens it too.
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
  // A choice made in the footer wins over the page's default for this session.
  const [chosen, setChosen] = React.useState<string>()
  const ui = chosen ?? uiLanguage ?? prefs.uiLanguage ?? lesson.language
  const t = stringsFor(ui)
  const locale = ariaLocaleFor(ui)
  const dir = /^(ar|he|fa|ur)\b/i.test(ui) ? "rtl" : "ltr"
  return (
    <DirectionProvider locale={locale}>
      <PlayerProvider
        value={{
          prepared,
          t,
          lang: ui,
          dir,
          visualsCss,
          keyScope: scopeKeys ? root : undefined,
        }}
      >
        <div
          ref={root}
          dir={dir}
          lang={ui}
          // Hidden while the resume script (in Player) has marked it before hydration: see
          // progress.ts. React must not report that mark as a mismatch.
          suppressHydrationWarning
          className="flex h-full min-h-0 flex-col bg-background text-foreground data-resuming:invisible"
        >
          <Player
            lesson={shown}
            startAt={startAt}
            progressKey={progressKey}
            onRename={(next) => {
              setTitle(next)
              onRename?.(next)
            }}
            prefs={prefs}
            onPrefs={setPrefs}
            onShortcuts={() => setShortcutsOpen((open) => !open)}
            headerSettings={
              <AppSettings
                theme={theme}
                onThemeChange={onThemeChange}
                uiLanguage={ui}
                onPrefs={(patch) => {
                  if (patch.uiLanguage) setChosen(patch.uiLanguage)
                  setPrefs(patch)
                }}
                t={t}
              />
            }
            // Touch screens have no hotkeys to fall back on, so the tray stays open there.
            trayOpen={coarse || prefs.tray !== "closed"}
            onTrayToggle={() =>
              setPrefs({ tray: prefs.tray === "closed" ? "open" : "closed" })
            }
            expiresAt={expiresAt}
            homeHref={homeHref}
            shareUrl={shareUrl}
            author={author}
            publishedAt={publishedAt}
            menuItems={menuItems}
            chrome={chrome}
          />
          {chrome ? (
            <LessonFooter
              homeHref={homeHref}
              privacyHref={privacyHref}
              termsHref={termsHref}
              docsHref={docsHref}
              t={t}
              shortcutsOpen={shortcutsOpen}
              onShortcutsChange={setShortcutsOpen}
            />
          ) : null}
        </div>
      </PlayerProvider>
    </DirectionProvider>
  )
}

// ---------- state ----------

type Phase = "answering" | "feedback" | "revealed"

export interface QuestionState {
  answer: Answer
  attempts: number
  /** The hint shows when the learner tries again after a miss. */
  hintOpen: boolean
  /** The explanation is open under the answer: after "Why?", or once the answer is revealed. */
  whyOpen: boolean
  result: CheckResult | null
  phase: Phase
  /** Display order for options and match columns, fixed for the life of the question. */
  optionOrder: string[]
  rightOrder: number[]
  bank: string[]
  /** A scenario opens with the ninja's brief: false until he's told it (true for other bricks). */
  briefed: boolean
  /** How many times the brief has been replayed, so each telling starts fresh. */
  briefs: number
  /** Scenario options already picked, missed and rewound: they can't be picked again. */
  tried: string[]
}

export interface State {
  items: Item[]
  index: number
  results: Record<string, Outcome>
  mistakes: QuestionBrick[]
  /** Ids of the fix round's questions answered right. */
  fixed: string[]
  inFix: boolean
  fixQueued: boolean
  question: QuestionState | null
  /** How many times the lesson has been restarted; seeds the feedback lines so a replay hears them in a new order. */
  run: number
}

/** `random` is for a fixed order, e.g. a demo rendered on the server that must match on the client. */
export function freshQuestion(
  item: Item | undefined,
  random: () => number = Math.random
): QuestionState | null {
  if (!item || item.kind !== "question") return null
  const brick = item.brick
  const optionIds =
    "options" in brick
      ? (brick.options as { id: string }[]).map((o) => o.id)
      : []
  return {
    answer: initialAnswer(brick, random),
    attempts: 0,
    hintOpen: false,
    whyOpen: false,
    result: null,
    phase: "answering",
    optionOrder:
      brick.type === "compare" ? optionIds : shuffle(optionIds, random),
    rightOrder:
      brick.type === "match"
        ? shuffle(
            brick.pairs.map((_, i) => i),
            random
          )
        : [],
    bank: brick.type === "blank" ? shuffle(wordBank(brick), random) : [],
    briefed: brick.type !== "scenario",
    briefs: 0,
    tried: [],
  }
}

/**
 * The word chips for a blank brick: every choice once, except a word that more than one gap accepts,
 * which gets a chip per such gap (otherwise the second gap could never be filled).
 */
export function wordBank(brick: Extract<QuestionBrick, { type: "blank" }>) {
  const words = [...new Set(brick.blanks.flatMap((b) => b.choices ?? []))]
  return words.flatMap((word) => {
    const needed = brick.blanks.filter((b) => b.accept.includes(word)).length
    return Array<string>(Math.max(1, needed)).fill(word)
  })
}

function start(lesson: Lesson, startAt?: string, run = 0): State {
  const items = buildSequence(lesson)
  // A demo opens on one brick; its shuffle is seeded so the server and the browser agree.
  const at = startAt
    ? items.findIndex((i) => "brick" in i && i.brick.id === startAt)
    : -1
  const index = at < 0 ? 0 : at
  return {
    items,
    index,
    results: {},
    mistakes: [],
    fixed: [],
    inFix: false,
    fixQueued: false,
    question: at < 0 ? null : freshQuestion(items[index], seeded(startAt!)),
    run,
  }
}

/**
 * What a correct answer earns beyond praise: the lesson's last question, three first-try answers in
 * a row, or a comeback (a retry that landed, a fix-round question, or the question after a miss
 * that was revealed).
 * The hook is a guess, so it earns nothing.
 */
export function earnedMoment(
  state: State,
  item: Extract<Item, { kind: "question" }>
): Moment | null {
  const s = state.question
  if (!s || item.role === "hook") return null
  const later = state.items
    .slice(state.index + 1)
    .some((i) => i.kind === "question")
  if (!later && state.mistakes.length === 0) return "last"
  if (s.attempts > 0 || item.role === "fix") return "comeback"
  // Scored questions so far, in play order, ending with this one.
  const outcomes = state.items
    .slice(0, state.index + 1)
    .flatMap((i) =>
      i.kind === "question" && i.role !== "hook"
        ? [state.results[i.brick.id]]
        : []
    )
  let streak = 0
  for (let i = outcomes.length - 1; i >= 0; i--) {
    if (outcomes[i] !== "first") break
    streak++
  }
  if (streak > 0 && streak % 3 === 0) return "streak"
  // A second-try success already had its comeback; only a real miss earns one on the next question.
  const previous = outcomes[outcomes.length - 2]
  if (previous === "missed") return "comeback"
  return null
}

/**
 * What the ninja's body knows about the answer just checked: the earned moments that get a move
 * of their own (a streak, the last question), a near miss, and the second miss that shows the
 * answer. A wrong hook guess is only a guess, so it's a plain miss.
 */
export function cueKindFor(
  state: State,
  item: Extract<Item, { kind: "question" }>
): CueKind {
  const s = state.question
  if (!s?.result) return "sad"
  if (s.result.correct) {
    const earned = earnedMoment(state, item)
    return earned === "streak" || earned === "last" ? "earned" : "happy"
  }
  if (item.role === "hook") return "sad"
  if (s.phase === "revealed") return "reveal"
  return s.result.partial ? "close" : "sad"
}

export type Action =
  | { type: "next" }
  | { type: "restart"; lesson: Lesson }
  /** Progress saved in the browser, loaded after mounting. */
  | { type: "resume"; state: State }
  | { type: "answer"; answer: Answer }
  | { type: "why" }
  | { type: "briefed" }
  | { type: "rebrief" }
  | { type: "check" }
  | { type: "retry" }
  | { type: "startFix" }

export function reducer(state: State, action: Action): State {
  const item = state.items[state.index]
  switch (action.type) {
    case "restart":
      return start(action.lesson, undefined, state.run + 1)
    case "resume":
      return action.state
    case "next": {
      let index = state.index + 1
      if (
        state.items[index]?.kind === "fix" &&
        state.mistakes.length === 0 &&
        !state.fixQueued
      )
        index++
      const nextItem = state.items[index]
      return {
        ...state,
        index,
        inFix: state.inFix || nextItem?.kind === "fix",
        question: freshQuestion(nextItem),
      }
    }
    case "startFix": {
      const retries: Item[] = state.mistakes.map((brick) => ({
        kind: "question",
        brick,
        role: "fix",
      }))
      const items = [
        ...state.items.slice(0, state.index + 1),
        ...retries,
        ...state.items.slice(state.index + 1),
      ]
      const index = state.index + 1
      return {
        ...state,
        items,
        index,
        mistakes: [],
        fixQueued: true,
        question: freshQuestion(items[index]),
      }
    }
    case "answer":
      // A change to the answer clears the marks kept from the last check.
      return state.question
        ? {
            ...state,
            question: {
              ...state.question,
              answer: action.answer,
              result: null,
            },
          }
        : state
    case "why":
      return state.question
        ? { ...state, question: { ...state.question, whyOpen: true } }
        : state
    case "briefed":
      return state.question
        ? { ...state, question: { ...state.question, briefed: true } }
        : state
    case "rebrief":
      // Only while answering: the brief comes back, then the same question.
      return state.question?.phase === "answering"
        ? {
            ...state,
            question: {
              ...state.question,
              briefed: false,
              briefs: state.question.briefs + 1,
            },
          }
        : state
    case "retry": {
      // The last check's marks stay until the answer changes, so the learner can see what to fix.
      if (!state.question || item?.kind !== "question") return state
      const s = state.question
      // A scenario rewinds to the decision: its marks clear and the missed pick is crossed out.
      const rewind = item.brick.type === "scenario"
      return {
        ...state,
        question: {
          ...s,
          phase: "answering",
          answer: retryAnswer(item.brick, s.answer),
          // There's no help button: a miss earns the hint on the second try.
          hintOpen: Boolean(item.brick.hint),
          ...(rewind
            ? {
                result: null,
                tried: [
                  ...s.tried,
                  ...(s.answer.kind === "select" ? s.answer.ids : []),
                ],
              }
            : null),
        },
      }
    }
    case "check": {
      if (!state.question || item?.kind !== "question") return state
      const { brick, role } = item
      const s = state.question
      const result = checkAnswer(brick, s.answer)
      if (role === "hook")
        return { ...state, question: { ...s, result, phase: "revealed" } }
      if (result.correct) {
        const results =
          role === "fix" || brick.id in state.results
            ? state.results
            : {
                ...state.results,
                [brick.id]: outcomeFor(s.attempts),
              }
        return {
          ...state,
          results,
          fixed: role === "fix" ? [...state.fixed, brick.id] : state.fixed,
          question: { ...s, result, phase: "feedback" },
        }
      }
      const attempts = s.attempts + 1
      if (attempts < 2)
        return {
          ...state,
          question: { ...s, attempts, result, phase: "feedback" },
        }
      const results =
        role === "fix"
          ? state.results
          : { ...state.results, [brick.id]: "missed" as const }
      const mistakes =
        role === "fix" ? state.mistakes : [...state.mistakes, brick]
      return {
        ...state,
        results,
        mistakes,
        question: {
          ...s,
          attempts,
          result,
          phase: "revealed",
          answer: solution(brick),
        },
      }
    }
  }
}

// ---------- player ----------

/** The Theory button and panel are hidden while the feature is being redesigned. */
const SHOW_THEORY = false

function Player({
  lesson,
  prefs,
  onPrefs,
  onShortcuts,
  headerSettings,
  trayOpen,
  onTrayToggle,
  onRename,
  startAt,
  chrome = true,
  expiresAt,
  homeHref,
  shareUrl,
  author,
  publishedAt,
  menuItems,
  progressKey,
}: {
  lesson: Lesson
  prefs: Preferences
  onPrefs: (patch: Partial<Preferences>) => void
  /** "?" was pressed: show (or hide) the keyboard shortcuts. */
  onShortcuts: () => void
  /** The app's settings, shown in the header. */
  headerSettings?: React.ReactNode
  trayOpen: boolean
  onTrayToggle: () => void
  onRename: (title: string) => void
  startAt?: string
  chrome?: boolean
  expiresAt?: number
  homeHref: string
  shareUrl?: string
  author?: Author
  /** When the lesson was published, shown on the title screen as how long ago. */
  publishedAt?: number
  menuItems?: React.ReactNode
  progressKey?: string
}) {
  const { t, keyScope, lang = "en" } = usePlayer()
  const { textSize } = prefs
  const ninja: NinjaLevel = prefs.ninja ?? "default"
  const [state, dispatch] = React.useReducer(reducer, lesson, (l) =>
    start(l, startAt)
  )
  // Saved progress comes back before the first paint after hydration, so a reload lands on the same
  // screen. The server's HTML still shows the intro until then; the inline script below (parsed
  // before the rest of the player) marks its parent, the player's root, to hide it when there's
  // progress to resume, and the effect clears the mark once the saved screen is in. The mark is
  // reached through the script's ref: the root's own ref isn't attached yet when this effect runs.
  // A demo (startAt) never saves. The fingerprint, not the lesson, keys the effects: a rename
  // changes the lesson object but not what was saved.
  const print = React.useMemo(() => fingerprint(lesson), [lesson])
  const remember = progressKey && !startAt ? progressKey : null
  const loaded = React.useRef(false)
  const mark = React.useRef<HTMLScriptElement>(null)
  React.useLayoutEffect(() => {
    if (!remember) return
    const saved = loadProgress(localStorage, remember, lesson)
    if (saved) dispatch({ type: "resume", state: saved })
    loaded.current = true
    mark.current?.parentElement?.removeAttribute("data-resuming")
    // The lesson is covered by its fingerprint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remember, print])
  React.useEffect(() => {
    if (!remember || !loaded.current) return
    saveProgress(localStorage, remember, lesson, state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remember, print, state])
  // One line picker for the whole run. It must not live in ActionArea: that remounts with every
  // screen (the keyed div below), and a fresh picker's first draw is always the same line.
  const pickLine = React.useMemo(
    () => createLinePicker(`${lesson.title}:${state.run}`),
    [lesson.title, state.run]
  )
  const [theoryOpen, setTheoryOpen] = React.useState(false)
  // Theory starts open where there's room for it beside the lesson.
  React.useEffect(() => {
    if (SHOW_THEORY && matchMedia("(min-width: 64rem)").matches)
      setTheoryOpen(true)
  }, [])
  const theoryId = React.useId()
  const item = state.items[state.index]!
  const scrollRef = React.useRef<HTMLElement>(null)
  // Each new screen starts at the top and takes focus, so keyboard and screen-reader users land on it.
  // Not on mount (a demo on a page must not pull focus), and robust to React running effects twice.
  const shownIndex = React.useRef(state.index)
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    if (shownIndex.current !== state.index)
      scrollRef.current?.focus({ preventScroll: true })
    shownIndex.current = state.index
  }, [state.index])
  // The clock starts when the learner leaves the title screen and stops at the wrap-up.
  const [clock, setClock] = React.useState<{ start?: number; end?: number }>({})
  React.useEffect(() => {
    if (item.kind === "intro") setClock({})
    else if (item.kind === "wrap")
      setClock((c) => (c.end ? c : { ...c, end: Date.now() }))
    else setClock((c) => (c.start ? c : { start: Date.now() }))
  }, [item.kind])
  const coarse = useCoarsePointer()
  // The tray holds the screen's buttons in the middle and the player's settings at the end. The notch
  // opens and closes it (Enter keeps working either way); the buttons render into `actionsEl`.
  const [trayEl, setTrayEl] = React.useState<HTMLDivElement | null>(null)
  const [actionsEl, setActionsEl] = React.useState<HTMLDivElement | null>(null)
  const trayId = React.useId()
  // The tray's natural height, and its height while the notch is being dragged.
  const [trayHeight, setTrayHeight] = React.useState(0)
  const [dragHeight, setDragHeight] = React.useState<number | null>(null)
  // The same value in a ref: a quick flick can end before the state from its last move has rendered.
  const dragRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!trayEl) return
    const measure = () => setTrayHeight(trayEl.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(trayEl)
    return () => observer.disconnect()
  }, [trayEl])
  const shownHeight = dragHeight ?? (trayOpen ? trayHeight : 0)
  // "?" shows the keyboard shortcuts, as it does on most of the web. D opens and closes the tray and
  // W the theory card (Why?), matched by key position so they work on any keyboard layout; touch
  // screens have no notch to toggle.
  const keys = React.useRef({ onShortcuts, onTrayToggle, coarse })
  keys.current = { onShortcuts, onTrayToggle, coarse }
  const toggleWhy = React.useRef<(() => void) | null>(null)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const help = e.key === "?"
      const tray = e.code === "KeyD" && !e.shiftKey && !keys.current.coarse
      const why = e.code === "KeyW" && !e.shiftKey && toggleWhy.current
      if (
        !(help || tray || why) ||
        e.repeat ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return
      const target = e.target as HTMLElement | null
      if (keyScope && !keyScope.current?.contains(target)) return
      if (target?.closest("input, textarea, select, [contenteditable=true]"))
        return
      e.preventDefault()
      if (help) keys.current.onShortcuts()
      else if (tray) keys.current.onTrayToggle()
      else toggleWhy.current?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [keyScope])
  // All feedback is in the ninja's speech bubble. After a right answer, Why? (or W) adds the
  // explanation to it; each new screen starts with it closed.
  const [whyOpen, setWhyOpen] = React.useState(false)
  // Extra scroll room under the lesson when the bubble is taller than the space the screen leaves
  // for it. It sits below the centered column, so the lesson itself never moves.
  const [bubbleRoom, setBubbleRoom] = React.useState(0)
  React.useEffect(() => setWhyOpen(false), [state.index])
  const canWhy =
    item.kind === "question" &&
    item.role !== "hook" &&
    state.question?.phase === "feedback" &&
    state.question.result?.correct === true
  toggleWhy.current = canWhy ? () => setWhyOpen((open) => !open) : null
  // Every path makes a scenario's rows taller: scroll them up clear of his bubble.
  const pathsOpen =
    canWhy &&
    whyOpen &&
    item.kind === "question" &&
    item.brick.type === "scenario"
  React.useEffect(() => {
    if (!pathsOpen) return
    const frame = requestAnimationFrame(() => {
      const el = scrollRef.current
      el?.scrollTo({
        top: el.scrollHeight,
        behavior: reducedMotion() ? "auto" : "smooth",
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathsOpen])
  // "Got it" sends the concept card back out the way it came before the next screen arrives.
  const [leaving, setLeaving] = React.useState(false)
  const leavingRef = React.useRef(false)
  const leaveConcept = React.useCallback(() => {
    if (leavingRef.current) return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dispatch({ type: "next" })
      return
    }
    leavingRef.current = true
    setLeaving(true)
    window.setTimeout(() => {
      leavingRef.current = false
      setLeaving(false)
      dispatch({ type: "next" })
    }, 200)
  }, [])
  const seenConcepts = state.items
    .slice(0, state.index + 1)
    .flatMap((i) => (i.kind === "concept" ? [i.brick] : []))
  // The ninja lives on the card and reacts to each check: pleased when it's right, sorry when it's not.
  const cardRef = React.useRef<HTMLDivElement>(null)
  const q = state.question
  // A scenario opens with his brief (story mode): he steps up to tell it, then goes back to his
  // corner for the question. Each telling has its own key, so a replay starts fresh. With him off
  // there's no brief: the situation is on the question screen.
  const briefKey =
    item.kind === "question" &&
    item.brick.type === "scenario" &&
    q &&
    !q.briefed &&
    ninja !== "off"
      ? `${state.run}:${state.index}:${q.briefs}`
      : null
  const [toldKey, setToldKey] = React.useState<string | null>(null)
  const [skipBrief, setSkipBrief] = React.useState(0)
  // A scenario miss rewinds to the decision: time runs back (and so does he) before the retry.
  const [rewinding, setRewinding] = React.useState(false)
  const rewind = React.useCallback(() => {
    if (reducedMotion()) {
      dispatch({ type: "retry" })
      return
    }
    setRewinding(true)
    window.setTimeout(() => {
      setRewinding(false)
      dispatch({ type: "retry" })
    }, 750)
  }, [])
  const cue: NinjaCue | null =
    item.kind === "question" && q && rewinding
      ? { kind: "rewind", key: `${state.index}-${q.attempts}-rewind` }
      : item.kind === "question" && q?.result && q.phase !== "answering"
        ? {
            kind: cueKindFor(state, item),
            key: `${state.index}-${q.attempts}-${q.phase}`,
          }
        : null
  // The wrap-up's send-off, with more for a perfect run: a line of his, shown under his slot once
  // he's leapt up there (or at once when he's off and there's no leap to wait for).
  const celebrate = React.useMemo(() => {
    if (item.kind !== "wrap") return undefined
    const s = summarize(lesson, state.results)
    return s.total > 0 && s.first === s.total ? "perfect" : "done"
  }, [item.kind, lesson, state.results])
  const wrapLine =
    celebrate === "perfect"
      ? pickLine(
          `${state.index}-0--perfect-${ninja}`,
          "perfect",
          voiceLines(lang, ninja, "perfect"),
          CADENCE[characterFor(ninja)]
        )
      : null
  const [landed, setLanded] = React.useState(false)
  React.useEffect(() => setLanded(false), [state.index])

  return (
    <>
      {remember ? (
        <script
          ref={mark}
          dangerouslySetInnerHTML={{ __html: resumeScript(remember, lesson) }}
        />
      ) : null}
      {chrome ? (
        <LessonHeader
          title={lesson.title}
          progress={progressAt(
            state.items,
            state.index,
            state.results,
            state.fixed
          )}
          count={questionAt(state.items, state.index, state.inFix)}
          startedAt={clock.start}
          endedAt={clock.end}
          showProgress={item.kind !== "intro"}
          expiresAt={expiresAt}
          homeHref={homeHref}
          shareUrl={shareUrl}
          settings={headerSettings}
          menuItems={menuItems}
          onRestart={() => {
            setTheoryOpen(false)
            dispatch({ type: "restart", lesson })
          }}
          onRename={onRename}
          t={t}
        />
      ) : null}
      <div
        className={cn(
          "relative flex min-h-0 flex-1 gap-4 sm:px-8",
          !chrome && "sm:px-0"
        )}
      >
        {/* The window: the content card on the tray's grey, so the card's corners stay round above it. */}
        <div
          className={cn(
            "relative flex min-w-0 flex-1 overflow-clip border-y bg-muted sm:rounded-4xl sm:border",
            // In a product shot the mock browser frames the window; its own border would double up.
            !chrome && "border-0"
          )}
        >
          <div className="relative flex min-w-0 flex-1 flex-col">
            {/* The card's border sits on the window's, so the top reads as one line and the bottom as the card on the tray. */}
            <div
              ref={cardRef}
              className="relative isolate flex min-h-0 flex-1 flex-col bg-background sm:-m-px sm:rounded-4xl sm:border"
            >
              {item.kind === "intro" ? (
                <Aura
                  hue={hueFor(lesson.topic ?? lesson.title)}
                  // Half of the slot (88px) and its gap (20px): the content moves up this far without the ninja.
                  shift={ninja === "off" ? -54 : 0}
                />
              ) : null}
              <main
                ref={scrollRef}
                tabIndex={-1}
                className="min-h-0 flex-1 overflow-y-auto outline-none"
              >
                <div
                  key={state.index}
                  className={cn(
                    "mx-auto flex min-h-full w-full flex-col justify-center-safe gap-8 px-4 py-16",
                    leaving
                      ? "motion-safe:animate-out motion-safe:duration-200 motion-safe:fade-out-0 motion-safe:fill-mode-forwards motion-safe:slide-out-to-end-24"
                      : item.kind === "concept"
                        ? // A concept arrives as a card from the side, so it doesn't read as the last answer's feedback.
                          "motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:slide-in-from-end-24"
                        : "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
                    columnWidth(item),
                    // Room under the content for the feedback toast (the wrap gets one on a perfect lesson).
                    (item.kind === "question" || item.kind === "wrap") &&
                      "pb-40"
                  )}
                >
                  <div
                    data-text-size={textSize}
                    className="flex flex-col gap-6"
                  >
                    <Screen
                      lesson={lesson}
                      item={item}
                      state={state}
                      dispatch={dispatch}
                      author={author}
                      publishedAt={publishedAt}
                      label={screenLabel(state, t)}
                      inBubble
                      ninja={ninja !== "off"}
                      wrapLine={ninja === "off" || landed ? wrapLine : null}
                      brief={
                        briefKey
                          ? {
                              key: briefKey,
                              skip: skipBrief,
                              onTold: () => setToldKey(briefKey),
                            }
                          : null
                      }
                      paths={canWhy && whyOpen}
                    />
                  </div>
                  <ActionArea
                    lesson={lesson}
                    item={item}
                    state={state}
                    dispatch={dispatch}
                    textSize={textSize}
                    tray={{ el: actionsEl, id: trayId }}
                    ninja={ninja !== "off"}
                    level={ninja}
                    pickLine={pickLine}
                    onConceptDone={leaveConcept}
                    onBubbleRoom={setBubbleRoom}
                    inBubble
                    brief={
                      briefKey
                        ? {
                            told: toldKey === briefKey,
                            onSkip: () => setSkipBrief((n) => n + 1),
                            onDone: () => dispatch({ type: "briefed" }),
                          }
                        : null
                    }
                    onRewind={rewind}
                    rewinding={rewinding}
                    why={
                      canWhy
                        ? {
                            open: whyOpen,
                            onToggle: () => setWhyOpen((open) => !open),
                          }
                        : null
                    }
                  />
                </div>
                {bubbleRoom > 0 ? (
                  <div aria-hidden="true" style={{ height: bubbleRoom }} />
                ) : null}
              </main>
              {ninja !== "off" ? (
                <NinjaStage
                  area={cardRef}
                  screen={briefKey ?? state.index}
                  cue={cue}
                  celebrate={celebrate}
                  onLanded={() => setLanded(true)}
                  level={ninja}
                />
              ) : null}
              {rewinding ? (
                // Time running back: faint scan lines over the card and a rewind tag in its corner.
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(0deg,color-mix(in_oklab,var(--color-foreground)_6%,transparent)_0_1px,transparent_1px_4px)] motion-safe:animate-in motion-safe:fade-in-0"
                >
                  <Badge className="absolute end-4 top-4 font-mono sm:end-6 sm:top-6">
                    ◀◀ {t.rewind}
                  </Badge>
                </div>
              ) : null}
              {coarse ? null : (
                <TrayNotch
                  open={trayOpen}
                  controls={trayId}
                  onToggle={onTrayToggle}
                  onDrag={(dy) => {
                    const from = trayOpen ? trayHeight : 0
                    dragRef.current =
                      dy === null
                        ? null
                        : Math.min(trayHeight, Math.max(0, from - dy))
                    setDragHeight(dragRef.current)
                  }}
                  onDrop={() => {
                    const open = (dragRef.current ?? 0) > trayHeight / 2
                    if (open !== trayOpen) onTrayToggle()
                    dragRef.current = null
                    setDragHeight(null)
                  }}
                  t={t}
                />
              )}
            </div>
            {/* The tray stays mounted so it can slide; closed, it's clipped to nothing and inert. */}
            <div
              className={cn(
                "shrink-0 overflow-hidden",
                dragHeight === null &&
                  "transition-[height] duration-200 ease-out motion-reduce:transition-none"
              )}
              style={{ height: shownHeight }}
              inert={!trayOpen && dragHeight === null}
            >
              <div
                id={trayId}
                ref={setTrayEl}
                className="flex items-center gap-2 px-4 py-4"
              >
                {/* Equal sides keep the actions in the middle (they give way when a phone is too narrow). */}
                <div className="flex flex-1 items-center gap-1">
                  <PlayerSettings prefs={prefs} onPrefs={onPrefs} t={t} />
                </div>
                <div
                  ref={setActionsEl}
                  className="flex flex-wrap items-center justify-center gap-2"
                />
                <div className="flex flex-1 items-center justify-end gap-1">
                  {/* The end of the tray holds help. Theory stays hidden while it's redesigned. */}
                  {SHOW_THEORY ? (
                    <Button
                      variant="ghost"
                      size="lg"
                      className={cn(TRAY_BUTTON, TRAY_GHOST)}
                      aria-expanded={theoryOpen}
                      aria-controls={theoryOpen ? theoryId : undefined}
                      onPress={() => setTheoryOpen((open) => !open)}
                    >
                      {theoryOpen ? (
                        <PanelRightFilledIcon className="rtl:-scale-x-100" />
                      ) : (
                        <PanelRightIcon className="rtl:-scale-x-100" />
                      )}
                      {t.theory}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
        {SHOW_THEORY && theoryOpen ? (
          <TheoryPanel
            id={theoryId}
            concepts={seenConcepts}
            onClose={() => setTheoryOpen(false)}
            t={t}
            textSize={textSize}
          />
        ) : null}
      </div>
    </>
  )
}

/**
 * Where the ninja stands on the intro and the wrap-up. With him off it folds shut (and swallows the
 * column's gap, passed as a negative margin class), so the rest of the screen stays centered.
 */
function NinjaSlot({ show, gap }: { show: boolean; gap: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid transition-[grid-template-rows,margin] duration-300 ease-out motion-reduce:transition-none",
        show ? "grid-rows-[1fr]" : cn("grid-rows-[0fr]", gap)
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div data-ninja-slot className="size-22" />
      </div>
    </div>
  )
}

/** Questions and short screens read best narrow; visuals and side-by-side bricks need room. */
function columnWidth(item: Item): string {
  if (item.kind === "intro") return "max-w-md"
  if (item.kind === "concept")
    return item.brick.visual ? "max-w-2xl" : "max-w-lg"
  if (item.kind !== "question") return "max-w-lg"
  const { brick } = item
  const wide =
    Boolean(brick.visual) ||
    hasOptionCards(brick) ||
    brick.type === "sort" ||
    brick.type === "match" ||
    brick.type === "hotspot"
  return wide ? "max-w-2xl" : "max-w-lg"
}

const Eyebrow = ({
  children,
  muted,
}: {
  children: React.ReactNode
  muted?: boolean
}) => (
  <div
    className={cn(
      "text-xs font-semibold tracking-[0.08em] uppercase",
      muted ? "text-muted-foreground" : "text-primary"
    )}
  >
    {children}
  </div>
)

/** Instructions under the prompt, only where the interaction isn't obvious (a single pick needs none). */
function helperFor(brick: QuestionBrick, t: Strings): string {
  switch (brick.type) {
    case "choice":
      return brick.multiple ? t.helper.choiceMany : ""
    case "compare":
    case "scenario":
    case "number":
      return ""
    case "hotspot":
      return brick.multiple ? t.helper.choiceMany : ""
    default:
      return t.helper[brick.type]
  }
}

export function Screen({
  lesson,
  item,
  state,
  dispatch,
  ninja = true,
  wrapLine,
  label,
  inBubble = false,
  brief = null,
  paths = false,
  author,
  publishedAt,
}: {
  lesson: Lesson
  item: Item
  state: State
  dispatch: React.Dispatch<Action>
  /** Who published the lesson, credited on the title screen. */
  author?: Author
  /** When the lesson was published, shown on the title screen as how long ago. */
  publishedAt?: number
  /** A scenario's brief, while the ninja tells it (the player's story mode). */
  brief?: BriefProps | null
  /** A scenario after the right answer: every option's outcome (Every path, the player's Why?). */
  paths?: boolean
  /** A quiet line above the screen saying what kind it is: "Concept 2 of 3", "Practice"... */
  label?: string
  /** The player says hints and explanations in the ninja's bubble; a lone demo shows them in place. */
  inBubble?: boolean
  /** Whether the ninja is on. Off, his slot folds away so the screen stays centered. */
  ninja?: boolean
  /** The wrap-up's line for a perfect run, once he's there to say it. */
  wrapLine?: string | null
}) {
  const { t } = usePlayer()
  switch (item.kind) {
    case "intro":
      return (
        // The ninja stands in the slot above the title (NinjaStage puts him there), in the lesson's light.
        <div className="flex flex-col items-center gap-5 text-center">
          <NinjaSlot show={ninja} gap="-mb-5" />
          <div className="flex w-full flex-col gap-3">
            <Byline author={author} publishedAt={publishedAt} />
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {lesson.title}
            </h1>
            <p className="text-base font-medium text-pretty text-muted-foreground">
              {lesson.summary}
            </p>
          </div>
          <MetaLine
            lesson={lesson}
            minutes={t.minutes(lesson.estimatedMinutes)}
            level={t.levels[lesson.level]}
          />
        </div>
      )
    case "concept":
      return (
        // Styled like a question (no card of its own), so the screens read as one lesson.
        <>
          {label ? <ScreenLabel text={label} className="-mb-4" /> : null}
          <ConceptBrick brick={item.brick} />
        </>
      )
    case "fix":
      return (
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">{t.fixTitle}</h2>
          <p className="text-sm font-medium text-muted-foreground">
            {t.fixBody(state.mistakes.length)}
          </p>
        </div>
      )
    case "wrap":
      return (
        <WrapUp
          lesson={lesson}
          results={state.results}
          ninja={ninja}
          line={wrapLine}
        />
      )
    case "question":
      return (
        <QuestionScreen
          item={item}
          state={state.question!}
          dispatch={dispatch}
          label={label}
          inBubble={inBubble}
          brief={brief}
          paths={paths}
          lang={lesson.language}
          storyMode={inBubble && ninja}
        />
      )
  }
}

/** The quiet label above the warm-up, so the first question reads as a guess. Later screens go without. */
function screenLabel(state: State, t: Strings): string | undefined {
  const item = state.items[state.index]
  return item?.kind === "question" && item.role === "hook"
    ? t.warmUp
    : undefined
}

/**
 * The title screen's byline, the same as a row in Explore: who made the lesson (their picture
 * and handle, linking to their profile) at the start, and how long ago it was published at the
 * end. The picture and handle alone, no "by": it reads the same in every language.
 */
function Byline({
  author,
  publishedAt,
}: {
  author?: Author
  publishedAt?: number
}) {
  const { lang = "en" } = usePlayer()
  if (!author && !publishedAt) return null
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      {author ? (
        <LinkButton
          href={author.href}
          variant="link"
          size="sm"
          className="h-auto min-w-0 gap-1.5 rounded-sm p-0 text-foreground"
        >
          <Avatar className="size-5">
            {author.image ? <AvatarImage src={author.image} alt="" /> : null}
            <AvatarFallback className="text-xs font-medium uppercase">
              {author.handle[0]}
            </AvatarFallback>
          </Avatar>
          <bdi dir="ltr" className="min-w-0 truncate">
            {author.handle}
          </bdi>
        </LinkButton>
      ) : null}
      {publishedAt ? (
        // Alone (an anonymous lesson), the age sits centered over the title rather than floating at the end.
        <TimeAgo
          at={publishedAt}
          lang={lang}
          className={cn("shrink-0", author ? "ms-auto" : "mx-auto")}
        />
      ) : null}
    </div>
  )
}

/** The title screen's meta line under the summary, as in Explore: the topic, length, and level, dot-separated. */
function MetaLine({
  lesson,
  minutes,
  level,
}: {
  lesson: Lesson
  minutes: string
  level: string
}) {
  const facts: React.ReactNode[] = []
  if (lesson.topic)
    facts.push(
      <bdi key="topic" lang={lesson.language} className="min-w-0 truncate">
        {lesson.topic}
      </bdi>
    )
  facts.push(
    <span key="minutes" className="shrink-0">
      {minutes}
    </span>,
    <span key="level" className="shrink-0">
      {level}
    </span>
  )
  return (
    <p className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
      {facts.map((fact, i) => (
        <span key={i} className="contents">
          {i > 0 ? (
            <span aria-hidden="true" className="text-muted-foreground/60">
              ·
            </span>
          ) : null}
          {fact}
        </span>
      ))}
    </p>
  )
}

function ScreenLabel({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <p className={cn("font-mono text-sm text-muted-foreground", className)}>
      {text}
    </p>
  )
}

/** The explanation opens after "Why?", and by itself once a missed answer is revealed (not for the hook's guess). */
function explanationShown(s: QuestionState, role: Role): boolean {
  return s.whyOpen || (s.phase === "revealed" && role !== "hook")
}

/** A scenario's brief while it's being told: `skip` counts presses of Skip, `onTold` ends it. */
interface BriefProps {
  key: string
  skip: number
  onTold: () => void
}

/** How a scenario's question arrives after the brief: each part rises in once the ninja has passed it. */
const rise = (delay: number) => ({
  className:
    "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:fill-mode-both",
  style: { animationDelay: `${delay}ms` },
})

function QuestionScreen({
  item,
  state,
  dispatch,
  label,
  inBubble = false,
  brief = null,
  paths = false,
  lang,
  storyMode = false,
}: {
  item: Extract<Item, { kind: "question" }>
  state: QuestionState
  dispatch: React.Dispatch<Action>
  label?: string
  inBubble?: boolean
  brief?: BriefProps | null
  paths?: boolean
  /** The lesson's language, for splitting the brief into sentences. */
  lang?: string
  /** The player with the ninja on: a scenario is briefed by him, and its question rises in after. */
  storyMode?: boolean
}) {
  const { t } = usePlayer()
  const { brick, role } = item
  if (brief && brick.type === "scenario")
    return (
      <Briefing
        key={brief.key}
        text={brick.situation}
        lang={lang}
        skip={brief.skip}
        onTold={brief.onTold}
        slot={
          <div aria-hidden="true" data-ninja-slot="brief" className="size-16" />
        }
      />
    )
  const locked = state.phase !== "answering"
  // After a second miss, show the solution. Where the marks name options (not positions in the
  // learner's answer), the last pick keeps its mark beside the right one.
  const keepsPick =
    role === "hook" ||
    brick.type === "choice" ||
    brick.type === "compare" ||
    brick.type === "scenario" ||
    brick.type === "hotspot"
  const marks: Record<string, Mark> =
    paths && brick.type === "scenario"
      ? // Every path: each option in its own color, best, okay or poor.
        Object.fromEntries(
          brick.options.map((o) => [
            o.id,
            o.quality === "best"
              ? "correct"
              : o.quality === "okay"
                ? "partial"
                : "wrong",
          ])
        )
      : state.phase !== "revealed"
        ? (state.result?.marks ?? {})
        : keepsPick
          ? { ...solutionMarks(brick), ...state.result?.marks }
          : solutionMarks(brick)
  const explanation =
    !inBubble && explanationShown(state, role) ? brick.explanation : null
  const props = {
    brick,
    answer: state.answer,
    setAnswer: (answer: Answer) => dispatch({ type: "answer", answer }),
    marks,
    locked,
  }
  const helper = helperFor(brick, t)
  const best =
    brick.type === "scenario"
      ? brick.options.filter((o) => o.quality === "best").map((o) => o.id)
      : []
  // In the player the ninja says a pick's outcome, so rows show outcomes only for Every path and
  // the revealed answer. A lone demo shows them under the picked row.
  const showOutcomes =
    brick.type !== "scenario"
      ? []
      : paths
        ? brick.options.map((o) => o.id)
        : !state.result
          ? []
          : [
              ...(!inBubble && state.answer.kind === "select"
                ? state.answer.ids
                : []),
              ...(state.phase === "revealed" ? best : []),
            ]
  // After the brief, the question rises in behind him as he heads back to his corner.
  const arrive = storyMode && brick.type === "scenario"
  const at = (delay: number) =>
    arrive ? rise(delay) : { className: undefined, style: undefined }

  return (
    <>
      {label ? <ScreenLabel text={label} className="-mb-4" /> : null}
      {brick.type === "scenario" ? (
        // The situation, kept in view while choosing. In story mode it's what the ninja just said.
        <Card size="sm" className={at(0).className} style={at(0).style}>
          <CardContent className="flex items-start gap-3 text-muted-foreground [&_code]:text-foreground [&_strong]:text-foreground">
            {storyMode ? (
              <Ninja className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            ) : null}
            <RichText
              text={brick.situation}
              className="min-w-0 flex-1 text-pretty"
            />
            {storyMode && state.phase === "answering" ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.replayBrief}
                className="-my-1 -me-1.5 shrink-0"
                onPress={() => dispatch({ type: "rebrief" })}
              >
                <RotateCcwIcon className="rtl:-scale-x-100" />
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <h2
        className={cn("text-base font-semibold", at(200).className)}
        style={at(200).style}
      >
        <RichText text={brick.prompt} />
      </h2>
      {helper && !brick.prompt.includes(helper) ? (
        <p className="-mt-4.5 font-mono text-sm text-muted-foreground">
          {helper}
        </p>
      ) : null}
      {brick.visual && brick.type !== "hotspot" ? (
        <Visual visual={brick.visual} />
      ) : null}
      {brick.type === "choice" ||
      brick.type === "compare" ||
      brick.type === "scenario" ? (
        <div className={at(380).className} style={at(380).style}>
          <OptionsBrick
            {...props}
            order={state.optionOrder}
            showOutcomes={showOutcomes}
            explanation={explanation}
            tried={state.tried}
          />
        </div>
      ) : brick.type === "hotspot" ? (
        <HotspotBrick {...props} />
      ) : brick.type === "sort" ? (
        <SortBrick {...props} />
      ) : brick.type === "order" ? (
        <OrderBrick {...props} />
      ) : brick.type === "match" ? (
        <MatchBrick {...props} rightOrder={state.rightOrder} />
      ) : brick.type === "blank" ? (
        <BlankBrick {...props} bank={state.bank} />
      ) : null}
      {explanation && !explanationAnchor(brick, marks) ? (
        <Explanation text={explanation} />
      ) : null}
      {!inBubble &&
      state.hintOpen &&
      brick.hint &&
      state.phase !== "revealed" ? (
        <Alert>
          <LightbulbIcon aria-hidden="true" />
          <AlertDescription className="text-base text-foreground">
            <RichText text={brick.hint} />
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}

function WrapUp({
  lesson,
  results,
  ninja = true,
  line,
}: {
  lesson: Lesson
  results: Record<string, Outcome>
  ninja?: boolean
  /** His line for a perfect run, shown as a bubble under his slot. */
  line?: string | null
}) {
  const { t } = usePlayer()
  const s = summarize(lesson, results)
  const pct = Math.round((s.first / s.total) * 100)
  const rows: [string, number, string][] = [
    ["bg-green-600", s.first, t.firstTry],
    ["bg-primary", s.second, t.secondTry],
    ["bg-red-600", s.missed, t.missed],
  ]
  return (
    <div className="flex flex-col gap-6">
      {/* The ninja leaps up from the corner to his send-off here (NinjaStage). */}
      <NinjaSlot show={ninja} gap="-mb-6" />
      {/* Said once he's landed: a speech bubble under him, squared off at the corner nearest him.
          Always in the tree (hidden until then) so the line is announced when it appears. */}
      <p
        aria-live="polite"
        className={
          line
            ? cn(
                TOAST,
                toneClass.good,
                "w-fit max-w-80 text-sm font-semibold motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1",
                ninja && "rounded-ss-sm"
              )
            : "sr-only"
        }
      >
        {line ? <RichText text={line} /> : null}
      </p>
      <Eyebrow>{lesson.title}</Eyebrow>
      <h1 className="-mt-4 text-2xl font-semibold">{t.done}</h1>
      <div className="flex flex-wrap items-center gap-6">
        <div
          className="grid size-32 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--color-green-600) ${pct}%, var(--muted) 0)`,
          }}
        >
          <div className="grid size-24 place-items-center rounded-full bg-card text-center">
            <div className="text-3xl font-extrabold tabular-nums">
              {s.first}/{s.total}
            </div>
          </div>
        </div>
        <ul className="grid gap-1.5 text-base">
          {rows.map(([color, n, label]) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn("size-2.5 rounded-full", color)}
                aria-hidden="true"
              />
              <span className="tabular-nums">{n}</span> {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        <Eyebrow muted>{t.takeaways}</Eyebrow>
        <ul className="grid gap-2.5">
          {lesson.wrapup.takeaways.map((k) => (
            <li key={k}>
              <Card size="sm">
                <CardContent className="text-base">
                  <RichText text={k} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
        {lesson.wrapup.next ? (
          <p className="text-base text-muted-foreground">
            {t.next}:{" "}
            <strong className="text-foreground">{lesson.wrapup.next}</strong>
          </p>
        ) : null}
      </div>
    </div>
  )
}

// ---------- action bar ----------

type Tone = "neutral" | "good" | "warn"

/** The feedback toast's recipe for each tone (the wrap-up's bubble shares it). */
const TOAST = "rounded-xl border px-4 py-3 shadow-xs"
const toneClass: Record<Tone, string> = {
  neutral: "border-border bg-popover text-popover-foreground",
  // The marked rows' colors (markStyles in bricks.tsx), mixed into the page the way the browser blends them (sRGB), so the toast matches yet stays opaque.
  good: "border-green-600 bg-[color-mix(in_srgb,var(--color-green-600)_10%,var(--background))]",
  warn: "border-yellow-500 bg-[color-mix(in_srgb,var(--color-yellow-500)_10%,var(--background))]",
}

/** The screen's main action (Enter runs it; the shortcuts dialog says so), and the feedback after checking. */
export function ActionArea({
  lesson,
  item,
  state,
  dispatch,
  textSize,
  tray,
  ninja = true,
  level = "default",
  pickLine: picker,
  onConceptDone,
  inBubble = false,
  why,
  onBubbleRoom,
  brief = null,
  onRewind,
  rewinding = false,
}: {
  lesson: Lesson
  item: Item
  state: State
  dispatch: React.Dispatch<Action>
  textSize: TextSize
  /** The tray the buttons render into. `el` is null while it's closed: the buttons hide, Enter still works. */
  tray?: { el: HTMLDivElement | null; id: string }
  /** Whether the ninja is in the card's corner, so the feedback toast leaves him room. */
  ninja?: boolean
  /** The ninja's character, which picks the voice of the feedback lines. */
  level?: NinjaLevel
  /** The lesson's line picker, shared across screens so lines don't repeat. A demo of one brick can omit it. */
  pickLine?: LinePicker
  /** "Got it" on a concept: the player animates the card away before moving on. */
  onConceptDone?: () => void
  /**
   * The player's mode: every piece of feedback (the verdict, a miss's hint, the explanation) is said in
   * the ninja's speech bubble. A lone demo keeps the explanation and hint in place.
   */
  inBubble?: boolean
  /** After a right answer, the player's Why?, which adds the explanation to the bubble. */
  why?: { open: boolean; onToggle: () => void } | null
  /** How much taller the bubble stands than the room the screen leaves for it (pb-40), in px. */
  onBubbleRoom?: (px: number) => void
  /** A scenario's brief in the player: Skip while he's telling it, then Got it. */
  brief?: { told: boolean; onSkip: () => void; onDone: () => void } | null
  /** A scenario miss in the player: Rewind (with its effect) instead of Try again. */
  onRewind?: () => void
  /** The rewind is playing: the bubble fades and the buttons wait. */
  rewinding?: boolean
}) {
  const { t, keyScope, lang = "en" } = usePlayer()
  const ownPicker = React.useMemo(
    () => createLinePicker(lesson.title),
    [lesson.title]
  )
  const pickLine = picker ?? ownPicker
  let tone: Tone = "neutral"
  let title: string | null = null
  let message: string | null = null
  let primary: {
    label: string
    onPress: () => void
    isDisabled?: boolean
    variant?: "default" | "warning" | "success" | "outline"
  } = {
    label: t.continue,
    onPress: () => dispatch({ type: "next" }),
  }
  let secondary: React.ReactNode = null
  // "Why?" opens the explanation under the answer, so feedback stays one short line until the learner asks.
  let explanation: string | null = null
  const helpButton = (label: string, onPress: () => void) => (
    <Button
      variant="outline"
      size={tray ? "lg" : "sm"}
      className={cn(tray && TRAY_BUTTON)}
      onPress={onPress}
    >
      {label}
    </Button>
  )

  // One line per piece of feedback, in the character's voice, rationed and without repeats.
  const say = (moment: Moment) =>
    pickLine(
      `${state.index}-${state.question?.attempts ?? 0}-${state.question?.phase ?? ""}-${moment}-${level}`,
      moment,
      voiceLines(lang, level, moment),
      CADENCE[characterFor(level)]
    )
  if (item.kind === "intro")
    primary = { label: t.start, onPress: () => dispatch({ type: "next" }) }
  else if (item.kind === "concept")
    primary = {
      label: t.continue,
      onPress: onConceptDone ?? (() => dispatch({ type: "next" })),
    }
  else if (item.kind === "fix")
    primary = {
      label: t.fixStart,
      onPress: () => dispatch({ type: "startFix" }),
    }
  else if (item.kind === "wrap") {
    // A perfect lesson earns one last line, said from his slot once he's landed (WrapUp), not from
    // the corner he's just left.
    primary = {
      label: t.restart,
      onPress: () => dispatch({ type: "restart", lesson }),
    }
  } else if (item.kind === "question" && state.question && brief) {
    // The ninja's brief: Skip shows the rest at once; once it's told, Continue goes to the question.
    primary = brief.told
      ? { label: t.continue, onPress: brief.onDone }
      : { label: t.skip, onPress: brief.onSkip, variant: "outline" }
  } else if (item.kind === "question" && state.question) {
    const s = state.question
    const { brick, role } = item
    const r = s.result
    const missText = (res: CheckResult) =>
      res.feedback ?? (res.missKey ? missMessage(res, t) : null)
    // In the player a scenario is a story: the ninja says what each pick led to, a miss rewinds.
    const story = inBubble && brick.type === "scenario"
    if (s.phase === "answering") {
      primary = {
        label: t.check,
        onPress: () => dispatch({ type: "check" }),
        isDisabled: !isReady(brick, s.answer),
      }
      // Try again clears the bubble: the miss already said the hint. After a scenario's rewind
      // the miss said its outcome, so the hint comes now.
      if (story && s.tried.length > 0 && brick.hint) {
        title = t.hint
        message = brick.hint
      }
    } else if (role === "hook" && r) {
      // The hook is a guess, so a miss still moves on, but both get the colors a checked answer would.
      // A wrong guess also says what it got wrong: the misconception is what the lesson starts from.
      tone = r.correct ? "good" : "warn"
      title = say(r.correct ? "goodGuess" : "hookMiss")
      // In the player the concept after the warm-up does the explaining, so the bubble says only how it went.
      message = r.correct || inBubble ? null : missText(r)
      if (!inBubble) explanation = brick.explanation
      primary = { ...primary, variant: r.correct ? "success" : "warning" }
    } else if (s.phase === "feedback" && r?.correct) {
      tone = "good"
      title = say(earnedMoment(state, item) ?? "praise")
      explanation = brick.explanation
      // What the pick led to; with Every path open the rows show every outcome, so he says why.
      if (story) message = why?.open ? brick.explanation : (r.feedback ?? null)
      else if (inBubble && why?.open) message = brick.explanation
      primary = { ...primary, variant: "success" }
    } else if (s.phase === "feedback" && r && story) {
      // What the pick led to, then back to the decision.
      tone = "warn"
      title = say(r.partial ? "close" : "nudge")
      message = r.feedback ?? null
      primary = {
        label: t.rewind,
        onPress: onRewind ?? (() => dispatch({ type: "retry" })),
        variant: "warning",
        isDisabled: rewinding,
      }
    } else if (s.phase === "feedback" && r) {
      // A miss gets one short line: the option's own feedback, or a nudge to look again.
      tone = "warn"
      // In the player: the verdict and one line of help, the hint (or the pick's own feedback).
      title = r.partial
        ? say("close")
        : inBubble
          ? say("nudge")
          : (missText(r) ?? say("nudge"))
      message = inBubble
        ? (brick.hint ?? missText(r))
        : r.partial
          ? missText(r)
          : null
      primary = {
        label: t.tryAgain,
        onPress: () => dispatch({ type: "retry" }),
        variant: "warning",
      }
    } else if (s.phase === "revealed") {
      // The answer and why it's right open in the brick, so the toast only points there.
      title = say("answer")
      explanation = brick.explanation
      if (inBubble) message = brick.explanation
    }
    if (!inBubble && explanation && !explanationShown(s, role))
      // The button goes once pressed, so focus moves on to Continue.
      secondary = helpButton(t.why, () => {
        dispatch({ type: "why" })
        primaryRef.current?.focus()
      })
  }
  if (why)
    secondary = (
      <Button
        variant="outline"
        size={tray ? "lg" : "sm"}
        aria-expanded={why.open}
        className={cn(
          tray && TRAY_BUTTON,
          // Open: a shade off the grey tray, as the tray's ghost buttons are when open.
          "aria-expanded:bg-input dark:aria-expanded:bg-input/50"
        )}
        onPress={() => {
          why.onToggle()
          // Enter stays the main action (Continue), not a second press of Why?.
          primaryRef.current?.focus()
        }}
      >
        {item.kind === "question" && item.brick.type === "scenario"
          ? t.everyPath
          : t.why}
      </Button>
    )
  const explanationOpen =
    item.kind === "question" &&
    state.question !== null &&
    explanationShown(state.question, item.role)

  // Enter runs the main action, including while an answer option has focus (Space still toggles it).
  const run = React.useRef(primary)
  run.current = primary
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || e.defaultPrevented) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (keyScope && !keyScope.current?.contains(target)) return
      const onOption = target?.closest("[data-slot=selectable]")
      if (
        !onOption &&
        target?.closest(
          "button, a, input, textarea, select, [role=grid], [role=menu], [role=dialog], [contenteditable=true]"
        )
      )
        return
      if (run.current.isDisabled) return
      e.preventDefault()
      e.stopPropagation()
      run.current.onPress()
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [keyScope])

  // Once feedback appears, focus moves to its button (Continue or Try again). Not on mount: a demo
  // that loads already checked must not pull the page to itself.
  const primaryRef = React.useRef<HTMLButtonElement>(null)
  const hadFeedback = React.useRef(Boolean(title))
  React.useEffect(() => {
    const has = Boolean(title)
    if (has && !hadFeedback.current) primaryRef.current?.focus()
    hadFeedback.current = has
  }, [title])

  // How much taller the bubble stands than the room the screen leaves for it (pb-40, 160px).
  const [bubbleEl, setBubbleEl] = React.useState<HTMLDivElement | null>(null)
  const roomRef = React.useRef(onBubbleRoom)
  roomRef.current = onBubbleRoom
  React.useEffect(() => {
    if (!bubbleEl || !tray) {
      roomRef.current?.(0)
      return
    }
    const measure = () => {
      const bottom = parseFloat(getComputedStyle(bubbleEl).bottom) || 0
      roomRef.current?.(Math.max(0, bubbleEl.offsetHeight + bottom + 16 - 160))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(bubbleEl)
    return () => observer.disconnect()
  }, [bubbleEl, tray])

  const buttons = (
    <>
      <Button
        ref={primaryRef}
        size={tray ? "lg" : "sm"}
        className={cn(tray && TRAY_BUTTON)}
        variant={primary.variant ?? "default"}
        onPress={primary.onPress}
        isDisabled={primary.isDisabled}
      >
        {primary.label}
      </Button>
      {secondary}
    </>
  )

  return (
    <>
      {tray ? (
        tray.el ? (
          createPortal(buttons, tray.el)
        ) : null
      ) : (
        <div className="flex flex-wrap items-center gap-2">{buttons}</div>
      )}
      <p aria-live="polite" className="sr-only">
        {title || message
          ? [title, message, !inBubble && explanationOpen ? explanation : null]
              .filter((x): x is string => Boolean(x))
              .map(plainText)
              .join(" ")
          : ""}
      </p>
      {title || message ? (
        <div
          ref={setBubbleEl}
          key={`${state.index}-${state.question?.attempts ?? 0}-${tone}`}
          aria-hidden="true"
          data-text-size={textSize}
          className={cn(
            TOAST,
            "absolute end-4 z-10 rounded-es-[2px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 sm:end-auto sm:w-fit sm:max-w-80",
            // Rewinding: what he said runs back out.
            rewinding &&
              "motion-safe:animate-out motion-safe:fade-out-0 motion-safe:fill-mode-forwards motion-safe:slide-out-to-bottom-2",
            // In the player the bubble sits above the ninja, behind him, so he jumps in front of it; the
            // corner over his head is squared off. Without him it takes his corner.
            tray && ninja
              ? "start-4 bottom-17 sm:start-6 sm:bottom-19"
              : "start-4 bottom-4 sm:start-6 sm:bottom-6",
            toneClass[tone]
          )}
        >
          {title ? (
            <p className="text-sm font-semibold">
              <RichText text={title} />
            </p>
          ) : null}
          {message ? (
            // Keyed by the text, so a line added later (Why?) fades up into the bubble.
            <div
              key={message}
              className="motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
            >
              {message
                .split("\n")
                .filter((line) => line.trim())
                .map((line, i) => (
                  <RichText
                    key={i}
                    text={line}
                    className={cn("block text-sm", (title || i > 0) && "mt-1")}
                  />
                ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

/** True on touch screens (no hover, no keyboard to speak of). False until mounted. */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = React.useState(false)
  React.useEffect(() => {
    const query = matchMedia("(pointer: coarse)")
    const update = () => setCoarse(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return coarse
}

/** A short bar floating on the content's bottom edge: click, press, or drag it to close or open the tray. */
function TrayNotch({
  open,
  controls,
  onToggle,
  onDrag,
  onDrop,
  t,
}: {
  open: boolean
  controls: string
  onToggle: () => void
  /** How far the pointer has moved down since it grabbed the notch, or null once released. */
  onDrag: (dy: number | null) => void
  /** The pointer let go after a drag: settle the tray open or closed. */
  onDrop: () => void
  t: Strings
}) {
  const SLOP = 4
  const start = React.useRef<number | null>(null)
  const dragged = React.useRef(false)
  const end = (e: React.PointerEvent) => {
    if (start.current === null) return
    start.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    // Pointer capture keeps the pointer's release from reaching the button, so a plain tap toggles here.
    if (dragged.current) onDrop()
    else onToggle()
  }
  return (
    // Capture-phase handlers: the button's own press handling stops pointer events from bubbling.
    // It floats over the content's bottom edge (centred by the auto margins) instead of taking a row.
    <div
      className="absolute inset-x-0 bottom-0 z-10 mx-auto w-fit"
      style={{ touchAction: "none" }}
      onPointerDownCapture={(e) => {
        start.current = e.clientY
        dragged.current = false
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMoveCapture={(e) => {
        if (start.current === null) return
        const dy = e.clientY - start.current
        if (!dragged.current && Math.abs(dy) < SLOP) return
        dragged.current = true
        onDrag(dy)
      }}
      onPointerUpCapture={end}
      onPointerCancelCapture={end}
    >
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={open ? controls : undefined}
        aria-label={open ? t.hideActions : t.showActions}
        onPress={(e) => {
          // Pointer presses are handled above; this is for Enter and Space.
          if (e.pointerType === "keyboard" || e.pointerType === "virtual")
            onToggle()
        }}
        // The hit area stays generous but invisible; only the bar reacts, like a grabber on iOS.
        className="h-7 w-24 cursor-ns-resize px-0 hover:bg-transparent active:translate-y-0 aria-expanded:bg-transparent dark:hover:bg-transparent"
      >
        {/* Frosted glass: a faint tint with a hairline, and content scrolling under it shows through, blurred. */}
        <span
          aria-hidden="true"
          className="h-1.5 w-16 rounded-full bg-foreground/20 shadow-xs ring-1 ring-foreground/10 transition-colors group-hover/button:bg-foreground/35 group-active/button:bg-foreground/50 supports-backdrop-filter:bg-foreground/10 supports-backdrop-filter:backdrop-blur-sm supports-backdrop-filter:group-hover/button:bg-foreground/25 supports-backdrop-filter:group-active/button:bg-foreground/40"
        />
      </Button>
    </div>
  )
}

function missMessage(r: CheckResult, t: Strings): string {
  switch (r.missKey) {
    case "sort":
      return t.miss.sort(r.count ?? 0)
    case "match":
      return t.miss.match(r.count ?? 0)
    case "missOne":
    case "hotspot":
    case "hotspotLine":
    case "order":
    case "blank":
      return t.miss[r.missKey]
    default:
      return ""
  }
}
