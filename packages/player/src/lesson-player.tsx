"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  CheckIcon,
  CircleCheckIcon,
  CopyIcon,
  HeartIcon,
  LightbulbIcon,
  PanelRightIcon,
  RotateCcwIcon,
} from "lucide-react"

import {
  matchesBlank,
  type ConceptKata as ConceptKataData,
  type Lesson,
  type QuestionKata,
} from "@workspace/spec"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { DirectionProvider } from "@workspace/ui/components/direction"
import { toast, Toaster } from "@workspace/ui/components/sonner"
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import {
  checkAnswer,
  initialAnswer,
  isReady,
  POOL,
  retryAnswer,
  shuffle,
  solution,
  solutionMarks,
  type Answer,
  type CheckResult,
  type Mark,
} from "./check"
import { Briefing } from "./briefing"
import {
  PlayerProvider,
  useIsDark,
  usePlayer,
  type LessonCreator,
  type LessonLike,
  type NextPrompt,
} from "./context"
import { challengeFor, type Challenge } from "./challenge"
import { CreatorProvider } from "./creator"
import {
  hasOptionCards,
  BlankKata,
  ConceptKata,
  HotspotKata,
  MatchKata,
  Explanation,
  explanationAnchor,
  Note,
  OptionsKata,
} from "./katas"
import { enterTarget, shortcutBlocked } from "./keys"
import { BRAND } from "./logo"
import { OrderKata } from "./order"
import { SortKata } from "./sort"
import {
  buildSequence,
  outcomeFor,
  progressAt,
  questionAt,
  runFor,
  scoredQuestions,
  summarize,
  type Item,
  type Outcome,
  type Role,
  type Run,
} from "./flow"
import {
  Aura,
  hueFor,
  SmokeWords,
  Ninja,
  NinjaStage,
  reducedMotion,
  type CueKind,
  type NinjaCue,
} from "./ninja"
import { emptyPrepared, type Prepared } from "./prepared"
import {
  browserStorage,
  countProgress,
  fingerprint,
  loadProgress,
  resumeScript,
  saveProgress,
} from "./progress"
import { seeded } from "./random"
import { plainText, RichText } from "./rich-text"
import {
  AppSettings,
  AppSettingsItems,
  LessonFooter,
  LessonHeader,
  PanelRightFilledIcon,
  PlayerSettings,
  PlayerSettingsItems,
  TheoryPanel,
  TRAY_BUTTON,
  TRAY_GHOST,
  usePreferences,
  useShare,
  type Preferences,
} from "./shell"
import { playSound, preloadSounds } from "./sound"
import { StreakScreen, type DayStreak } from "./streak"
import {
  ariaLocaleFor,
  UI_TRANSLATIONS,
  useStrings,
  type NinjaLevel,
  type Strings,
  type TextSize,
  type Theme,
} from "./strings"
import { Visual } from "./visuals"
import {
  ChallengeNote,
  ChallengeVerdict,
  KeepLogIn,
  KeepLearning,
  RunBar,
  Takeaways,
  WrapActions,
} from "./wrap-up"
import {
  CADENCE,
  characterFor,
  clipFor,
  createLinePicker,
  hasVoice,
  nextClips,
  voiceLines,
  type LinePicker,
  type Moment,
} from "./voices"

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
  /** The app's own entries for the lesson menu (the chevron by the title), after the player's. */
  menuItems?: React.ReactNode
  /** The app's color theme. Pass both to show the theme setting in the footer. */
  theme?: Theme
  onThemeChange?: (theme: Theme) => void
  /** Called when the learner renames the lesson in the header. The player shows the new name either way. */
  onRename?: (title: string) => void
  /** For demos: open on this kata instead of the intro, shuffled the same way on the server and in the browser. */
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
  /** Called when the learner reaches the wrap-up (not in demos), once per run through the lesson. */
  onComplete?: () => void
  /**
   * Called as the learner moves on from a kata (not in demos), with the katas behind them out of all
   * of them: what Explore's pie shows. Not on the intro or the wrap-up, and not twice for the same count.
   */
  onProgress?: (progress: { done: number; total: number }) => void
  /**
   * The prompt the wrap-up's Keep learning box copies for the learner's agent: the kind of lesson
   * they picked, the topic in its field, and this lesson's title. Omit it to leave the box out.
   */
  nextPrompt?: NextPrompt
  /** The score this learner was challenged to beat, read from the link (?c=, ?by=). Ignored once the lesson's question count no longer matches. */
  challenge?: Challenge
  /** The logged-in learner's handle, named in the challenges they send. */
  challenger?: string
  /** The heart on the wrap-up, for a published lesson. Omit it to show no heart. */
  like?: LessonLike
  /** When the lesson's maker is playing: their card on the wrap-up (publish it, ask for changes) instead of the heart. */
  creator?: LessonCreator
  /**
   * For a logged-out learner: where to log in so their finish counts on their profile, offered on
   * the wrap-up. Omit it when they're logged in, or when a finish can't be kept for them.
   */
  keepLogIn?: string
  /**
   * The streak finishing this lesson lights, for the screen before the wrap-up: pass it only when
   * finishing will light today's lantern (logged in, nothing finished yet today, and this lesson not
   * finished before, which doesn't count again). Leave it out otherwise.
   */
  streak?: DayStreak
}

/**
 * A whole lesson. It suspends until its language has loaded (useStrings): while the page hydrates,
 * React keeps the server's HTML in place meanwhile, so nothing flashes.
 */
export function LessonPlayer(props: LessonPlayerProps) {
  return (
    <React.Suspense>
      <LessonInLanguage {...props} />
    </React.Suspense>
  )
}

function LessonInLanguage({
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
  menuItems,
  theme,
  onThemeChange,
  onRename,
  startAt,
  scopeKeys = false,
  chrome = true,
  progressKey,
  onComplete,
  onProgress,
  nextPrompt,
  challenge,
  challenger,
  like,
  keepLogIn,
  creator,
  streak,
}: LessonPlayerProps) {
  const root = React.useRef<HTMLDivElement>(null)
  // The title as shown, which a rename in the header changes.
  const [title, setTitle] = React.useState(lesson.title)
  React.useEffect(() => setTitle(lesson.title), [lesson.title])
  const shown = React.useMemo(() => ({ ...lesson, title }), [lesson, title])
  const [prefs, setPrefs, prefsLoaded] = usePreferences()
  const fixedTray = useFixedTray()
  // The keyboard shortcuts dialog lives in the footer; "?" (handled in the player) opens it too.
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
  // A choice made in the footer wins over the page's default for this session.
  const [chosen, setChosen] = React.useState<string>()
  // With translations off (UI_TRANSLATIONS), only ?ui= (uiLanguage) picks another than English.
  const ui =
    chosen ??
    uiLanguage ??
    (UI_TRANSLATIONS ? (prefs.uiLanguage ?? lesson.language) : "en")
  // Suspends until the language's chunk is in; a change of language waits in a transition.
  const t = useStrings(ui)
  // Reveal the player once what the before-paint script hid it for is in: the saved preferences,
  // in their language (they commit together, after it loads), and ?ui='s language, which a
  // prerendered page applies after mounting (progress is resumed earlier, before the first paint).
  // A few seconds at most, whatever happens.
  React.useEffect(() => {
    const reveal = () => root.current?.removeAttribute("data-resuming")
    const timer = window.setTimeout(reveal, 3000)
    const wanted = new URLSearchParams(window.location.search).get("ui")
    if (prefsLoaded && (!wanted || wanted.toLowerCase() === ui.toLowerCase()))
      reveal()
    return () => window.clearTimeout(timer)
  }, [prefsLoaded, ui])
  const locale = ariaLocaleFor(ui)
  const dir = /^(ar|he|fa|ur)\b/i.test(ui) ? "rtl" : "ltr"
  const dark = useIsDark()
  const appSettings = {
    theme,
    onThemeChange,
    uiLanguage: ui,
    onPrefs: (patch: Partial<Preferences>) => {
      // In a transition: the current language stays up until the new one has loaded.
      React.startTransition(() => {
        if (patch.uiLanguage) setChosen(patch.uiLanguage)
        setPrefs(patch)
      })
    },
    t,
  }
  // The footer's links, which phones find in the header's menu instead.
  const footerLinks = [
    [docsHref, t.docs],
    [privacyHref, t.privacy],
    [termsHref, t.terms],
  ].filter((l): l is [string, string] => Boolean(l[0]))
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
          nextPrompt,
          shareUrl,
          challenge: challengeFor(challenge, scoredQuestions(lesson).length),
          challenger,
          like,
          creator,
          keepLogIn,
          streak,
        }}
      >
        <CreatorProvider level={lesson.level}>
          <div
            ref={root}
            dir={dir}
            lang={ui}
            // Hidden while the resume script (in Player) has marked it before hydration: see
            // progress.ts. React must not report that mark as a mismatch.
            suppressHydrationWarning
            // The site's own D (the theme, while developing) stays off while a lesson is on the page,
            // unless it's a demo that only takes keys from inside itself.
            data-lesson-player={scopeKeys ? undefined : ""}
            className="flex h-full min-h-0 flex-col bg-background text-foreground data-resuming:invisible"
          >
            <Player
              lesson={shown}
              startAt={startAt}
              progressKey={progressKey}
              onComplete={onComplete}
              onProgress={onProgress}
              onRename={(next) => {
                setTitle(next)
                onRename?.(next)
              }}
              prefs={prefs}
              onPrefs={setPrefs}
              soundOn={prefsLoaded && prefs.sound !== "off"}
              onShortcuts={() => setShortcutsOpen((open) => !open)}
              headerSettings={<AppSettings {...appSettings} />}
              phoneMenu={
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup aria-label={t.settings}>
                    <PlayerSettingsItems
                      prefs={prefs}
                      onPrefs={setPrefs}
                      t={t}
                    />
                    <AppSettingsItems {...appSettings} />
                  </DropdownMenuGroup>
                  {footerLinks.length ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup aria-label={BRAND.name}>
                        {footerLinks.map(([href, label]) => (
                          <DropdownMenuItem key={href} href={href}>
                            {label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </>
                  ) : null}
                </>
              }
              // Touch screens have no hotkeys to fall back on, and phones need the main action, so the
              // tray stays open there.
              trayOpen={fixedTray || prefs.tray !== "closed"}
              onTrayToggle={() =>
                setPrefs({ tray: prefs.tray === "closed" ? "open" : "closed" })
              }
              expiresAt={expiresAt}
              homeHref={homeHref}
              shareUrl={shareUrl}
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
          {/* Confirmations (copied, published), at the top: the tray and the ninja's bubble hold the bottom. */}
          <Toaster
            position="top-center"
            // Just under the header (h-16, h-14 on phones), so the title and Share stay visible.
            offset={{ top: 72 }}
            mobileOffset={{ top: 64 }}
            theme={dark ? "dark" : "light"}
            dir={dir}
          />
        </CreatorProvider>
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
  /** A scenario opens with the ninja's brief: false until he's told it (true for other katas). */
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
  mistakes: QuestionKata[]
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
  const kata = item.kata
  const optionIds =
    "options" in kata ? (kata.options as { id: string }[]).map((o) => o.id) : []
  return {
    answer: initialAnswer(kata, random),
    attempts: 0,
    hintOpen: false,
    whyOpen: false,
    result: null,
    phase: "answering",
    optionOrder:
      kata.type === "compare" ? optionIds : shuffle(optionIds, random),
    rightOrder:
      kata.type === "match"
        ? shuffle(
            kata.pairs.map((_, i) => i),
            random
          )
        : [],
    bank: kata.type === "blank" ? shuffle(wordBank(kata), random) : [],
    briefed: kata.type !== "scenario",
    briefs: 0,
    tried: [],
  }
}

/**
 * The word chips for a blank kata: every choice once, except a word that more than one gap accepts,
 * which gets a chip per such gap (otherwise the second gap could never be filled).
 */
export function wordBank(kata: Extract<QuestionKata, { type: "blank" }>) {
  const words = [...new Set(kata.blanks.flatMap((b) => b.choices ?? []))]
  return words.flatMap((word) => {
    const needed = kata.blanks.filter((b) =>
      b.accept.some((a) =>
        matchesBlank(a, word, { ...b, caseSensitive: kata.caseSensitive })
      )
    ).length
    return Array<string>(Math.max(1, needed)).fill(word)
  })
}

function start(lesson: Lesson, startAt?: string, run = 0): State {
  const items = buildSequence(lesson)
  // A demo opens on one kata; its shuffle is seeded so the server and the browser agree.
  const at = startAt
    ? items.findIndex((i) => "kata" in i && i.kata.id === startAt)
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
        ? [state.results[i.kata.id]]
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

/** Whether two states show the same piece of feedback: the same screen, attempt, and phase. */
function sameFeedback(a: State, b: State): boolean {
  return (
    a.index === b.index &&
    a.question?.attempts === b.question?.attempts &&
    a.question?.phase === b.question?.phase
  )
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
  /** A wrong pair in a match: it isn't kept, but the kata no longer counts as right first time. */
  | { type: "slip" }
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
      const retries: Item[] = state.mistakes.map((kata) => ({
        kind: "question",
        kata,
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
      const rewind = item.kata.type === "scenario"
      return {
        ...state,
        question: {
          ...s,
          phase: "answering",
          answer: retryAnswer(item.kata, s.answer),
          // There's no help button: a miss earns the hint on the second try.
          hintOpen: Boolean(item.kata.hint),
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
    case "slip":
      return state.question?.phase === "answering" &&
        state.question.attempts === 0
        ? { ...state, question: { ...state.question, attempts: 1 } }
        : state
    case "check": {
      if (!state.question || item?.kind !== "question") return state
      const { kata, role } = item
      const s = state.question
      const result = checkAnswer(kata, s.answer)
      if (role === "hook")
        return { ...state, question: { ...s, result, phase: "revealed" } }
      if (result.correct) {
        const results =
          role === "fix" || kata.id in state.results
            ? state.results
            : {
                ...state.results,
                [kata.id]: outcomeFor(s.attempts),
              }
        return {
          ...state,
          results,
          fixed: role === "fix" ? [...state.fixed, kata.id] : state.fixed,
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
          : { ...state.results, [kata.id]: "missed" as const }
      const mistakes =
        role === "fix" ? state.mistakes : [...state.mistakes, kata]
      return {
        ...state,
        results,
        mistakes,
        question: {
          ...s,
          attempts,
          result,
          phase: "revealed",
          answer: solution(kata),
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
  soundOn,
  onShortcuts,
  headerSettings,
  phoneMenu,
  trayOpen,
  onTrayToggle,
  onRename,
  startAt,
  chrome = true,
  expiresAt,
  homeHref,
  shareUrl,
  menuItems,
  progressKey,
  onComplete,
  onProgress,
}: {
  lesson: Lesson
  prefs: Preferences
  onPrefs: (patch: Partial<Preferences>) => void
  /** Sound is on, by the saved setting: off until it has loaded, so nothing is fetched for a muted player. */
  soundOn: boolean
  /** "?" was pressed: show (or hide) the keyboard shortcuts. */
  onShortcuts: () => void
  /** The app's settings, shown in the header. */
  headerSettings?: React.ReactNode
  /** The end of the header's menu on phones: the settings and links that have no room there. */
  phoneMenu?: React.ReactNode
  trayOpen: boolean
  onTrayToggle: () => void
  onRename: (title: string) => void
  startAt?: string
  chrome?: boolean
  expiresAt?: number
  homeHref: string
  shareUrl?: string
  menuItems?: React.ReactNode
  progressKey?: string
  onComplete?: () => void
  onProgress?: (progress: { done: number; total: number }) => void
}) {
  const { t, keyScope, lang = "en", streak } = usePlayer()
  const { textSize } = prefs
  const ninja: NinjaLevel = prefs.ninja ?? "sensei"
  const [state, dispatch] = React.useReducer(reducer, lesson, (l) =>
    start(l, startAt)
  )
  // Saved progress comes back before the first paint after hydration, so a reload lands on the same
  // screen. The server's HTML still shows the intro until then; the inline script below (parsed
  // before the rest of the player) marks its parent, the player's root, to hide it when there's
  // progress to resume or preferences to apply, and LessonInLanguage clears the mark once they're
  // in. A demo (startAt) never saves. The fingerprint, not the lesson, keys the effects: a rename
  // changes the lesson object but not what was saved.
  const print = React.useMemo(() => fingerprint(lesson), [lesson])
  const remember = progressKey && !startAt ? progressKey : null
  const loaded = React.useRef(false)
  // The feedback on the screen progress resumed to was already said: he stays quiet until the
  // learner moves on from it (a new screen, attempt, or phase).
  const [resumed, setResumed] = React.useState<State>()
  React.useLayoutEffect(() => {
    if (!remember) return
    const storage = browserStorage()
    const saved = storage && loadProgress(storage, remember, lesson, print)
    if (saved) {
      dispatch({ type: "resume", state: saved })
      setResumed(saved)
    }
    loaded.current = true
    // The lesson is covered by its fingerprint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remember, print])
  React.useEffect(() => {
    if (resumed && !sameFeedback(state, resumed)) setResumed(undefined)
  }, [resumed, state])
  React.useEffect(() => {
    if (!remember || !loaded.current) return
    const storage = browserStorage()
    if (storage) saveProgress(storage, remember, lesson, state, print)
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
  const focusLesson = React.useCallback(
    () => scrollRef.current?.focus({ preventScroll: true }),
    []
  )
  // The clock starts when the learner leaves the title screen and stops at the wrap-up.
  const [clock, setClock] = React.useState<{ start?: number; end?: number }>({})
  React.useEffect(() => {
    if (item.kind === "intro") setClock({})
    else if (item.kind === "wrap")
      setClock((c) => (c.end ? c : { ...c, end: Date.now() }))
    else setClock((c) => (c.start ? c : { start: Date.now() }))
  }, [item.kind])
  // Tell the page the lesson was finished: once per run (a retry is a new run), never in a demo.
  const completeRef = React.useRef(onComplete)
  React.useEffect(() => {
    completeRef.current = onComplete
  })
  React.useEffect(() => {
    if (item.kind === "wrap" && !startAt) completeRef.current?.()
  }, [item.kind, state.run, startAt])
  // And how far they've got, each time that changes mid-lesson.
  const progressRef = React.useRef(onProgress)
  React.useEffect(() => {
    progressRef.current = onProgress
  })
  const sentDone = React.useRef<number>(undefined)
  React.useEffect(() => {
    if (startAt || item.kind === "intro" || item.kind === "wrap") return
    const progress = countProgress(state.items, state.index)
    // The fix round is past every kata: nothing new to say until the finish does.
    if (progress.done >= progress.total || progress.done === sentDone.current)
      return
    sentDone.current = progress.done
    progressRef.current?.(progress)
    // The items only change along with the index or the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, state.run, item.kind, startAt])
  // The streak screen comes first on the wrap-up when finishing lit today's lantern: once, since a
  // retry finishes on a day that's already lit.
  const [streakSeen, setStreakSeen] = React.useState(false)
  const onStreak = item.kind === "wrap" && !!streak && !streakSeen
  const leaveStreak = () => {
    setStreakSeen(true)
    scrollRef.current?.scrollTo({ top: 0 })
    scrollRef.current?.focus({ preventScroll: true })
  }
  const fixedTray = useFixedTray()
  // The tray holds the screen's buttons in the middle and the player's settings at the end. The notch
  // opens and closes it (Enter keeps working either way); the buttons render into `actionsEl`.
  const [trayEl, setTrayEl] = React.useState<HTMLDivElement | null>(null)
  const [actionsEl, setActionsEl] = React.useState<HTMLDivElement | null>(null)
  // On phones the feedback sits in the tray above the buttons instead of floating over the answers.
  const [feedbackEl, setFeedbackEl] = React.useState<HTMLDivElement | null>(
    null
  )
  const trayId = React.useId()
  // The tray's natural height (null until measured), and its height while the notch is being dragged.
  const [trayHeight, setTrayHeight] = React.useState<number | null>(null)
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
  // Until it's measured the open tray takes its natural height, so it doesn't slide open as the page
  // loads; it only animates for a change after that.
  const shownHeight = dragHeight ?? (trayOpen ? (trayHeight ?? "auto") : 0)
  // "?" shows the keyboard shortcuts, as it does on most of the web. D opens and closes the tray and
  // W the theory card (Why?), matched by key position so they work on any keyboard layout; touch
  // screens have no notch to toggle.
  const keys = React.useRef({ onShortcuts, onTrayToggle, fixedTray })
  keys.current = { onShortcuts, onTrayToggle, fixedTray }
  const toggleWhy = React.useRef<(() => void) | null>(null)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const help = e.key === "?"
      const tray = e.code === "KeyD" && !e.shiftKey && !keys.current.fixedTray
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
      if (shortcutBlocked(e)) return
      e.preventDefault()
      if (help) keys.current.onShortcuts()
      else if (tray) keys.current.onTrayToggle()
      else toggleWhy.current?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [keyScope])
  // The ninja's line is in his speech bubble, the rest in a note under the answers. After a right
  // answer, Why? (or W) adds the explanation note; each new screen starts with it closed.
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
    item.kata.type === "scenario"
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
    if (goStraightOn()) {
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
  // "Start lesson" makes the intro vanish in a puff of smoke before the first kata arrives.
  const [vanishing, setVanishing] = React.useState(false)
  const vanishingRef = React.useRef(false)
  // A whoosh of wind as he goes, loaded ahead so it starts with the press. It follows the Sound
  // setting, which shows only in a language he speaks.
  const whooshOn = soundOn && hasVoice(lang)
  React.useEffect(() => {
    if (whooshOn) preloadSounds([VANISH_SOUND])
  }, [whooshOn])
  const vanishIntro = React.useCallback(() => {
    if (vanishingRef.current) return
    if (goStraightOn()) {
      dispatch({ type: "next" })
      return
    }
    vanishingRef.current = true
    setVanishing(true)
    if (whooshOn) playSound(VANISH_SOUND)
    window.setTimeout(() => {
      vanishingRef.current = false
      setVanishing(false)
      dispatch({ type: "next" })
    }, 650)
  }, [whooshOn])
  const seenConcepts = state.items
    .slice(0, state.index + 1)
    .flatMap((i) => (i.kind === "concept" ? [i.kata] : []))
  // The ninja lives on the card and reacts to each check: pleased when it's right, sorry when it's not.
  const cardRef = React.useRef<HTMLDivElement>(null)
  const q = state.question
  // Feedback can land on the answers. On phones the tray grows to show it, which can push the marked
  // answers below the fold: once it has settled, bring the last of them back into view. Wider, the
  // toast floats in the card's corner, over the answers when they reach that far down (a tall
  // question on a short screen): scroll them up clear of it, into the room the screen leaves below.
  // The note under the answers always clears it, which also brings it up from below the fold, and
  // Why? adding the explanation note runs this again.
  React.useEffect(() => {
    if (!q?.result || q.phase === "answering") return
    const id = window.setTimeout(() => {
      const scroller = scrollRef.current
      if (!scroller) return
      const behavior = reducedMotion() ? "auto" : "smooth"
      if (matchMedia("(width < 40rem)").matches) {
        const marked = scroller.querySelectorAll("[data-status]")
        marked[marked.length - 1]?.scrollIntoView({
          block: "nearest",
          behavior,
        })
        return
      }
      const toast = cardRef.current
        ?.querySelector("[data-feedback-toast]")
        ?.getBoundingClientRect()
      if (!toast) return
      let lowest = -Infinity
      for (const el of scroller.querySelectorAll(
        "[data-slot=selectable], [data-status], [data-feedback-note]"
      )) {
        const r = el.getBoundingClientRect()
        // Within a gap of the toast counts: a row it touches looks covered too.
        if (
          el.hasAttribute("data-feedback-note") ||
          (r.right > toast.left - 12 && r.left < toast.right + 12)
        )
          lowest = Math.max(lowest, r.bottom)
      }
      const overlap = lowest + 12 - toast.top
      if (overlap > 0) scroller.scrollBy({ top: overlap, behavior })
    }, 250)
    return () => window.clearTimeout(id)
  }, [q?.result, q?.phase, whyOpen])
  // A scenario opens with his brief (story mode): he steps up to tell it, then goes back to his
  // corner for the question. Each telling has its own key, so a replay starts fresh. With him off
  // there's no brief: the situation is on the question screen.
  const briefKey =
    item.kind === "question" &&
    item.kata.type === "scenario" &&
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
  // The wrap-up's send-off: he leaps up to his slot there, with more for a perfect run.
  const run = React.useMemo(
    () =>
      item.kind === "wrap"
        ? runFor(summarize(lesson, state.results))
        : undefined,
    [item.kind, lesson, state.results]
  )
  // He waits in his corner through the streak screen, then leaps up for the wrap-up.
  const celebrate = run && !onStreak ? run : undefined
  const hydrated = useHydrated()

  return (
    <>
      {/* Only the server's HTML runs it: React never runs a script it adds in the browser (a
          client-side visit, a remount), and warns that it won't. */}
      {startAt || hydrated ? null : (
        <script
          dangerouslySetInnerHTML={{ __html: resumeScript(remember, lesson) }}
        />
      )}
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
          // Not on the title screen, where nothing has started, or the wrap-up, whose run bar says how it went.
          showProgress={item.kind !== "intro" && item.kind !== "wrap"}
          expiresAt={expiresAt}
          homeHref={homeHref}
          shareUrl={shareUrl}
          settings={headerSettings}
          menuItems={menuItems}
          phoneMenu={phoneMenu}
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
            // On phones the tray is as dark as the card: one surface, with the actions at its foot.
            "relative flex min-w-0 flex-1 overflow-clip border-y bg-muted max-sm:bg-background sm:rounded-4xl sm:border",
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
                  hue={hueFor(lesson.subject)}
                  // Half of the slot (88px) and its gap (20px): the content moves up this far without the ninja.
                  shift={ninja === "off" ? -54 : 0}
                  vanishing={vanishing}
                />
              ) : null}
              <main
                ref={scrollRef}
                tabIndex={-1}
                className="min-h-0 flex-1 overflow-y-auto outline-none"
              >
                <div
                  key={onStreak ? "streak" : state.index}
                  className={cn(
                    "mx-auto flex min-h-full w-full flex-col gap-8 px-4 py-16",
                    // A lesson screen starts at the top, so nothing moves when feedback or the
                    // tray appears and each kata's prompt lands in the same place; the intro and
                    // wrap-up stay centered. On larger windows the offset follows the height, so
                    // short content still sits near the optical center.
                    item.kind === "concept" || item.kind === "question"
                      ? "justify-start max-sm:py-6 sm:pt-[clamp(4rem,12vh,8rem)]"
                      : "justify-center-safe",
                    vanishing && "vanish",
                    leaving
                      ? "motion-safe:animate-out motion-safe:duration-200 motion-safe:fade-out-0 motion-safe:fill-mode-forwards motion-safe:slide-out-to-end-24"
                      : item.kind === "concept"
                        ? // A concept arrives as a card from the side, so it doesn't read as the last answer's feedback.
                          "motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:slide-in-from-end-24"
                        : "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
                    columnWidth(item),
                    // Room under the content for the feedback toast (on phones it's in the tray).
                    item.kind === "question" && "sm:pb-40"
                  )}
                >
                  <div
                    data-text-size={textSize}
                    // The screen's own controls, which keep their Enter (enterTarget in keys.ts).
                    data-player-content
                    className="flex flex-col gap-6"
                  >
                    {onStreak ? (
                      <StreakScreen streak={streak!} />
                    ) : (
                      <Screen
                        lesson={lesson}
                        item={item}
                        state={state}
                        dispatch={dispatch}
                        label={screenLabel(state, t)}
                        inBubble
                        ninja={ninja !== "off"}
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
                    )}
                  </div>
                  <ActionArea
                    lesson={lesson}
                    item={item}
                    state={state}
                    dispatch={dispatch}
                    textSize={textSize}
                    tray={{ el: actionsEl, id: trayId, feedbackEl }}
                    ninja={ninja !== "off"}
                    level={ninja}
                    pickLine={pickLine}
                    speak={
                      ninja !== "off" &&
                      soundOn &&
                      !(resumed && sameFeedback(state, resumed))
                    }
                    onConceptDone={leaveConcept}
                    onStart={vanishIntro}
                    onStreakDone={onStreak ? leaveStreak : undefined}
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
                    onFocusLost={focusLesson}
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
              <VisualsAhead item={state.items[state.index + 1]} />
              {ninja !== "off" ? (
                <NinjaStage
                  area={cardRef}
                  // The streak screen is a screen of its own, so he leaps up when the wrap-up follows it.
                  screen={onStreak ? "streak" : (briefKey ?? state.index)}
                  cue={cue}
                  celebrate={celebrate}
                  level={ninja}
                  vanishing={vanishing}
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
              {fixedTray ? null : (
                <TrayNotch
                  open={trayOpen}
                  controls={trayId}
                  onToggle={onTrayToggle}
                  onDrag={(dy) => {
                    const full = trayHeight ?? 0
                    const from = trayOpen ? full : 0
                    dragRef.current =
                      dy === null
                        ? null
                        : Math.min(full, Math.max(0, from - dy))
                    setDragHeight(dragRef.current)
                  }}
                  onDrop={() => {
                    const open = (dragRef.current ?? 0) > (trayHeight ?? 0) / 2
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
                // On phones the tray holds only the screen's actions, and the wrap-up has none there.
                item.kind === "wrap" && !onStreak && "max-sm:hidden",
                dragHeight === null &&
                  trayHeight !== null &&
                  "transition-[height] duration-200 ease-out motion-reduce:transition-none"
              )}
              style={{ height: shownHeight }}
              inert={!trayOpen && dragHeight === null}
            >
              <div
                id={trayId}
                ref={setTrayEl}
                // Phones: the feedback, then the actions across the width, clear of the home bar.
                className={cn(
                  "flex flex-col gap-3 p-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
                  PHONE_TRAY_TONE
                )}
              >
                <div ref={setFeedbackEl} className="empty:hidden sm:hidden" />
                <div className="flex items-center gap-2">
                  {/* Equal sides keep the actions in the middle. On phones the settings are in the header's menu. */}
                  <div className="flex flex-1 items-center gap-1 max-sm:hidden">
                    <PlayerSettings
                      side="start"
                      prefs={prefs}
                      onPrefs={onPrefs}
                      t={t}
                    />
                  </div>
                  <div
                    ref={setActionsEl}
                    className="flex flex-wrap items-center justify-center gap-2 max-sm:flex-1 max-sm:flex-nowrap"
                  />
                  <div className="flex flex-1 items-center justify-end gap-1 max-sm:hidden">
                    <PlayerSettings
                      side="end"
                      prefs={prefs}
                      onPrefs={onPrefs}
                      t={t}
                    />
                    {/* Then help. Theory stays hidden while it's redesigned. */}
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

const noSubscribe = () => () => {}

/** False while rendering on the server and hydrating its HTML; true for every render after, and for a component first drawn in the browser. */
function useHydrated() {
  return React.useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
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

/** Questions and short screens read best narrow; visuals and side-by-side katas need room. */
/**
 * The next screen's HTML visual, drawn out of sight in a column as wide as that screen's, so its
 * frame has loaded and measured its height (knownHeights in visuals.tsx) before the screen arrives,
 * and starts at that height instead of growing into it. A hotspot's stage is laid out differently
 * and takes keys, so it isn't drawn ahead.
 */
function VisualsAhead({ item }: { item: Item | undefined }) {
  const visual =
    (item?.kind === "concept" ||
      (item?.kind === "question" && item.kata.type !== "hotspot")) &&
    item.kata.visual?.kind === "html"
      ? item.kata.visual
      : null
  if (!visual) return null
  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
    >
      <div className={cn("mx-auto w-full px-4", columnWidth(item!))}>
        <Visual visual={visual} />
      </div>
    </div>
  )
}

function columnWidth(item: Item): string {
  if (item.kind === "intro") return "max-w-md"
  // The wrap-up's row of actions needs a step more than a question.
  if (item.kind === "wrap") return "max-w-xl"
  if (item.kind === "concept")
    return item.kata.visual ? "max-w-2xl" : "max-w-lg"
  if (item.kind !== "question") return "max-w-lg"
  const { kata } = item
  const wide =
    Boolean(kata.visual) ||
    hasOptionCards(kata) ||
    kata.type === "sort" ||
    kata.type === "match" ||
    kata.type === "hotspot"
  return wide ? "max-w-2xl" : "max-w-lg"
}

/** Instructions above the prompt, only where the interaction isn't obvious (a single pick needs none). */
function helperFor(kata: QuestionKata, t: Strings): string {
  switch (kata.type) {
    case "choice":
      return kata.multiple ? t.helper.choiceMany : ""
    case "compare":
    case "scenario":
    case "number":
      return ""
    case "hotspot":
      return kata.multiple ? t.helper.choiceMany : ""
    default:
      return t.helper[kata.type]
  }
}

export function Screen({
  lesson,
  item,
  state,
  dispatch,
  ninja = true,
  label,
  inBubble = false,
  brief = null,
  paths = false,
}: {
  lesson: Lesson
  item: Item
  state: State
  dispatch: React.Dispatch<Action>
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
}) {
  const { t } = usePlayer()
  switch (item.kind) {
    case "intro":
      return (
        // The ninja stands in the slot above the title (NinjaStage puts him there), in the lesson's light.
        <div className="flex flex-col items-center gap-5 text-center">
          <NinjaSlot show={ninja} gap="-mb-5" />
          <div className="flex w-full flex-col gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              <SmokeWords text={lesson.title} step={50} />
            </h1>
            <p className="vanish-fade text-base font-medium text-pretty text-muted-foreground">
              {lesson.summary}
            </p>
          </div>
          <div className="vanish-fade">
            <MetaLine
              minutes={t.minutes(lesson.estimatedMinutes)}
              level={t.levels[lesson.level]}
            />
          </div>
          <div className="vanish-fade empty:hidden">
            <ChallengeNote />
          </div>
        </div>
      )
    case "concept":
      return (
        // Styled like a question (no card of its own), so the screens read as one lesson.
        <>
          {label ? <ScreenLabel text={label} className="-mb-4" /> : null}
          <ConceptKata kata={item.kata} />
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
          onRestart={() => dispatch({ type: "restart", lesson })}
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
 * The title screen's meta line under the summary, as in Explore: the length and level in the
 * player's language, dot-separated. Neither the subject nor the tags are shown; tags stay hidden
 * until they're governed well enough to read as labels.
 */
function MetaLine({ minutes, level }: { minutes: string; level: string }) {
  const facts: React.ReactNode[] = [
    <span key="minutes" className="shrink-0">
      {minutes}
    </span>,
    <span key="level" className="shrink-0">
      {level}
    </span>,
  ]
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
  const { kata, role } = item
  if (brief && kata.type === "scenario")
    return (
      <Briefing
        key={brief.key}
        text={kata.situation}
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
    kata.type === "choice" ||
    kata.type === "compare" ||
    kata.type === "scenario" ||
    kata.type === "hotspot"
  const marks: Record<string, Mark> =
    paths && kata.type === "scenario"
      ? // Every path: each option in its own color, best, okay or poor.
        Object.fromEntries(
          kata.options.map((o) => [
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
          ? { ...solutionMarks(kata), ...state.result?.marks }
          : solutionMarks(kata)
  const explanation =
    !inBubble && explanationShown(state, role) ? kata.explanation : null
  const props = {
    kata,
    answer: state.answer,
    setAnswer: (answer: Answer) => dispatch({ type: "answer", answer }),
    marks,
    locked,
  }
  // How to answer, when the interaction isn't obvious: above the prompt, beside the screen's label.
  const helper = helperFor(kata, t)
  const eyebrow = [label, helper && !kata.prompt.includes(helper) ? helper : ""]
    .filter(Boolean)
    .join(" · ")
  const best =
    kata.type === "scenario"
      ? kata.options.filter((o) => o.quality === "best").map((o) => o.id)
      : []
  // In the player a pick's outcome is in the note under the answers, so rows show outcomes only
  // for Every path. A lone demo shows them under the picked row and, once revealed, the best one.
  const showOutcomes =
    kata.type !== "scenario"
      ? []
      : paths
        ? kata.options.map((o) => o.id)
        : !state.result
          ? []
          : [
              ...(!inBubble && state.answer.kind === "select"
                ? state.answer.ids
                : []),
              ...(!inBubble && state.phase === "revealed" ? best : []),
            ]
  // After the brief, the question rises in behind him as he heads back to his corner.
  const arrive = storyMode && kata.type === "scenario"
  const at = (delay: number) =>
    arrive ? rise(delay) : { className: undefined, style: undefined }

  return (
    <>
      {eyebrow ? <ScreenLabel text={eyebrow} className="-mb-4" /> : null}
      {kata.type === "scenario" ? (
        // The situation, kept in view while choosing. In story mode it's what the ninja just said.
        <Card size="sm" className={at(0).className} style={at(0).style}>
          <CardContent className="flex items-start gap-3 text-muted-foreground [&_code]:text-foreground [&_strong]:text-foreground">
            {storyMode ? (
              <Ninja className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            ) : null}
            <RichText
              text={kata.situation}
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
        className={cn("text-lg font-semibold", at(200).className)}
        style={at(200).style}
      >
        <RichText text={kata.prompt} />
      </h2>
      {kata.visual && kata.type !== "hotspot" ? (
        <Visual visual={kata.visual} />
      ) : null}
      {kata.type === "choice" ||
      kata.type === "compare" ||
      kata.type === "scenario" ? (
        <div className={at(380).className} style={at(380).style}>
          <OptionsKata
            {...props}
            order={state.optionOrder}
            showOutcomes={showOutcomes}
            explanation={explanation}
            tried={state.tried}
          />
        </div>
      ) : kata.type === "hotspot" ? (
        <HotspotKata {...props} />
      ) : kata.type === "sort" ? (
        <SortKata {...props} />
      ) : kata.type === "order" ? (
        <OrderKata {...props} />
      ) : kata.type === "match" ? (
        <MatchKata
          {...props}
          rightOrder={state.rightOrder}
          onSlip={() => dispatch({ type: "slip" })}
          onDone={() => dispatch({ type: "check" })}
        />
      ) : kata.type === "blank" ? (
        <BlankKata {...props} bank={state.bank} />
      ) : null}
      {explanation && !explanationAnchor(kata, marks) ? (
        <Explanation text={explanation} />
      ) : null}
      {!inBubble &&
      state.hintOpen &&
      kata.hint &&
      state.phase !== "revealed" ? (
        <Alert>
          <LightbulbIcon aria-hidden="true" />
          <AlertDescription className="text-base text-foreground">
            <RichText text={kata.hint} />
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
  onRestart,
}: {
  lesson: Lesson
  results: Record<string, Outcome>
  ninja?: boolean
  onRestart: () => void
}) {
  const { t, creator } = usePlayer()
  const s = summarize(lesson, results)
  const run = runFor(s)
  // The celebration leads; the score is one quiet line of first tries.
  const score =
    run === "perfect"
      ? t.allFirstTry(s.total)
      : t.firstTryCount(s.first, s.total)
  return (
    // Two groups, further apart than anything inside them: how it went with what to do about it,
    // then what the lesson said and what to learn next.
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* The ninja leaps up from the corner to his send-off here (NinjaStage). */}
          <NinjaSlot show={ninja} gap="-mb-4" />
          {/* The heading and its line as on the fix screen, then the run as one bar. */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">{t.done}</h1>
            <p className="text-sm font-medium text-muted-foreground">{score}</p>
          </div>
          <RunBar lesson={lesson} results={results} />
          <ChallengeVerdict summary={s} />
          <KeepLogIn />
        </div>
        <WrapActions
          lesson={lesson}
          summary={s}
          onRestart={onRestart}
          // The maker's own lesson has no heart; its status is on Share.
          extra={creator ? null : <LikeLesson />}
        />
      </div>
      <div className="flex flex-col gap-8">
        <Takeaways items={lesson.wrapup.takeaways} />
        <KeepLearning lesson={lesson} />
      </div>
    </div>
  )
}

/**
 * The heart, beside the wrap-up's other actions while finishing is fresh. Logged in, it likes the
 * lesson at once and settles on the server's count; the lesson then waits in the learner's likes.
 * Logged out, pressing it says so in a toast with a Log in button: asked for, never pushed.
 */
function LikeLesson() {
  const { t, lang = "en", like } = usePlayer()
  const [state, setState] = React.useState(() => ({
    liked: like?.liked ?? false,
    likes: like?.likes ?? 0,
  }))
  const [busy, setBusy] = React.useState(false)
  if (!like) return null

  async function toggle() {
    if (!like) return
    if (!like.onChange) {
      const href = like.loginHref
      toast(t.likeLogIn, {
        action: href
          ? { label: t.logIn, onClick: () => window.location.assign(href) }
          : undefined,
      })
      return
    }
    if (busy) return
    const was = state
    const next = {
      liked: !was.liked,
      likes: Math.max(0, was.likes + (was.liked ? -1 : 1)),
    }
    setState(next)
    setBusy(true)
    const result = await like.onChange(next.liked).catch(() => ({
      error: "network",
      likes: undefined,
    }))
    setBusy(false)
    if (result.error) {
      setState(was)
      toast.error(t.likeFailed)
      return
    }
    if (typeof result.likes === "number")
      setState({ liked: next.liked, likes: result.likes })
  }

  return (
    <Button
      variant="outline"
      size="lg"
      aria-pressed={state.liked}
      onPress={() => void toggle()}
    >
      <HeartIcon
        data-icon="inline-start"
        className={cn(state.liked && "fill-current text-destructive")}
      />
      {state.liked ? t.liked : t.like}
      {state.likes > 0 ? (
        <span className="text-muted-foreground tabular-nums">
          {new Intl.NumberFormat(lang, { notation: "compact" }).format(
            state.likes
          )}
        </span>
      ) : null}
    </Button>
  )
}

// ---------- action bar ----------

type Tone = "neutral" | "good" | "warn"

/**
 * Plays the ninja's line: `src` is its clip (null when he stays quiet), `key` names the piece of
 * feedback, so the same line said again later plays again. A new line, a muted player, or leaving
 * the screen stops the one playing.
 */
function useSpokenLine(src: string | null, key: string | undefined) {
  // The browser may refuse before the learner has pressed anything, or the clip may not load: then
  // he just doesn't speak.
  React.useEffect(() => (src ? playSound(src) : undefined), [src, key])
}

/**
 * The feedback toast: in the player it's the ninja's speech bubble, a chat message with a soft tint
 * of the tone and no border or shadow, so it stays out of the way.
 */
const TOAST = "rounded-[18px] px-3.5 py-2 text-foreground"
/**
 * On phones the whole tray takes the feedback's tone, the toast's recipe spread across it, with a line
 * of the tone's color along its top edge. It reads from the feedback card inside (`data-tone`).
 */
const PHONE_TRAY_TONE = cn(
  "max-sm:border-t max-sm:border-transparent max-sm:transition-colors",
  "max-sm:has-[[data-tone=good]]:border-green-600 max-sm:has-[[data-tone=good]]:bg-[color-mix(in_srgb,var(--color-green-600)_10%,var(--background))]",
  "max-sm:has-[[data-tone=warn]]:border-yellow-500 max-sm:has-[[data-tone=warn]]:bg-[color-mix(in_srgb,var(--color-yellow-500)_10%,var(--background))]",
  "max-sm:has-[[data-tone=neutral]]:border-border max-sm:has-[[data-tone=neutral]]:bg-popover"
)
/** On phones the tray's buttons share its width at a thumb-sized height. */
const PHONE_BAR = "max-sm:h-12 max-sm:flex-1 max-sm:text-base"
const toneClass: Record<Tone, string> = {
  neutral: "bg-muted",
  // A light tint mixed into the page (in sRGB), so it stays opaque over content scrolling under it.
  good: "bg-[color-mix(in_srgb,var(--color-green-500)_18%,var(--background))]",
  warn: "bg-[color-mix(in_srgb,var(--color-yellow-500)_22%,var(--background))]",
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
  level = "sensei",
  pickLine: picker,
  speak = false,
  onConceptDone,
  onStart,
  onStreakDone,
  inBubble = false,
  why,
  onBubbleRoom,
  brief = null,
  onRewind,
  rewinding = false,
  onFocusLost,
}: {
  lesson: Lesson
  item: Item
  state: State
  dispatch: React.Dispatch<Action>
  textSize: TextSize
  /** The tray the buttons render into. `el` is null while it's closed: the buttons hide, Enter still works. */
  /** The tray's slots: the buttons go in `el`, and on phones the feedback goes in `feedbackEl`. */
  tray?: {
    el: HTMLDivElement | null
    id: string
    feedbackEl?: HTMLDivElement | null
  }
  /** Whether the ninja is in the card's corner, so the feedback toast leaves him room. */
  ninja?: boolean
  /** The ninja's character, which picks the voice of the feedback lines. */
  level?: NinjaLevel
  /** The lesson's line picker, shared across screens so lines don't repeat. A demo of one kata can omit it. */
  pickLine?: LinePicker
  /** The ninja says his line out loud (the player, with sound on and the ninja not Off). */
  speak?: boolean
  /** "Got it" on a concept: the player animates the card away before moving on. */
  onConceptDone?: () => void
  /** Starts the lesson from the intro (the player makes the intro vanish first). */
  onStart?: () => void
  /** The streak screen is up on the wrap-up: Continue goes on to the wrap-up itself. */
  onStreakDone?: () => void
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
  /** Feedback appeared with no main button to focus (the tray is hidden): put focus somewhere useful. */
  onFocusLost?: () => void
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
  let actionless = false
  // "Why?" opens the explanation under the answer, so feedback stays one short line until the learner asks.
  let explanation: string | null = null
  // In the player the bubble says only the ninja's line; the message is a note under the answers,
  // amber for a hint, a miss, or where a wrong pick led, green for the explanation or a right pick's outcome.
  let noteTone: "good" | "warn" = "warn"
  const helpButton = (label: string, onPress: () => void) => (
    <Button
      variant="outline"
      size={tray ? "lg" : "sm"}
      className={cn(tray && [TRAY_BUTTON, PHONE_BAR])}
      onPress={onPress}
    >
      {label}
    </Button>
  )

  // One line per piece of feedback, in the character's voice, rationed and without repeats.
  const said: { key?: string; line?: string } = {}
  const say = (moment: Moment) => {
    said.key = `${state.index}-${state.question?.attempts ?? 0}-${state.question?.phase ?? ""}-${moment}-${level}`
    said.line = pickLine(
      said.key,
      moment,
      voiceLines(lang, level, moment),
      CADENCE[characterFor(level)]
    )
    return said.line
  }
  if (item.kind === "intro")
    primary = {
      label: t.start,
      onPress: onStart ?? (() => dispatch({ type: "next" })),
    }
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
  // The wrap-up's actions are in its boxes, so a closed tray hides nothing.
  else if (item.kind === "wrap" && onStreakDone)
    primary = { label: t.continue, onPress: onStreakDone }
  else if (item.kind === "wrap") actionless = true
  else if (item.kind === "question" && state.question && brief) {
    // The ninja's brief: Skip shows the rest at once; once it's told, Continue goes to the question.
    primary = brief.told
      ? { label: t.continue, onPress: brief.onDone }
      : { label: t.skip, onPress: brief.onSkip, variant: "outline" }
  } else if (item.kind === "question" && state.question) {
    const s = state.question
    const { kata, role } = item
    const r = s.result
    const missText = (res: CheckResult) =>
      res.feedback ?? (res.missKey ? missMessage(res, t) : null)
    // In the player a scenario is a story: the ninja says what each pick led to, a miss rewinds.
    const story = inBubble && kata.type === "scenario"
    if (s.phase === "answering") {
      // Until every sort item is in a group, Check says how many are left instead.
      const unsorted =
        s.answer.kind === "zones" ? (s.answer.zones[POOL] ?? []).length : 0
      primary = {
        label: unsorted ? t.sortLeft(unsorted) : t.check,
        onPress: () => dispatch({ type: "check" }),
        isDisabled: !isReady(kata, s.answer),
      }
      // Try again clears the bubble: the miss already said the hint. After a scenario's rewind
      // the miss said its outcome, so the hint comes now.
      if (story && s.tried.length > 0 && kata.hint) {
        title = t.hint
        message = kata.hint
      }
    } else if (role === "hook" && r) {
      // The hook is a guess, so a miss still moves on, but both get the colors a checked answer would.
      // A wrong guess also says what it got wrong: the misconception is what the lesson starts from.
      tone = r.correct ? "good" : "warn"
      title = say(r.correct ? "goodGuess" : "hookMiss")
      // In the player the concept after the warm-up does the explaining, so the bubble says only how it went.
      message = r.correct || inBubble ? null : missText(r)
      if (!inBubble) explanation = kata.explanation
      primary = { ...primary, variant: r.correct ? "success" : "warning" }
    } else if (s.phase === "feedback" && r?.correct) {
      tone = "good"
      title = say(earnedMoment(state, item) ?? "praise")
      explanation = kata.explanation
      // What the pick led to; with Every path open the rows show every outcome, so he says why.
      if (story) message = why?.open ? kata.explanation : (r.feedback ?? null)
      else if (inBubble && why?.open) message = kata.explanation
      noteTone = "good"
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
        ? (kata.hint ?? missText(r))
        : r.partial
          ? missText(r)
          : null
      primary = {
        label: t.tryAgain,
        onPress: () => dispatch({ type: "retry" }),
        variant: "warning",
      }
    } else if (s.phase === "revealed") {
      // The answer and why it's right open in the kata, so the toast only points there.
      title = say("answer")
      explanation = kata.explanation
      if (inBubble) message = kata.explanation
      noteTone = "good"
    }
    if (!inBubble && explanation && !explanationShown(s, role))
      // The button goes once pressed, so focus moves on to Continue.
      secondary = helpButton(t.why, () => {
        dispatch({ type: "why" })
        primaryRef.current?.focus()
      })
  }
  // He says the line that heads the feedback, once per piece of feedback.
  useSpokenLine(
    speak && said.line && title === said.line ? clipFor(lang, said.line) : null,
    said.key
  )
  // Whatever he says next is loaded while the learner answers, so it comes with the feedback.
  const upcoming = speak ? nextClips(lang, level, pickLine).join(" ") : ""
  React.useEffect(() => {
    if (upcoming) preloadSounds(upcoming.split(" "))
  }, [upcoming])

  // On phones the feedback is a card in the tray, and Why? sits in it so Continue keeps the width.
  const phoneCard = Boolean(tray?.feedbackEl && (title || message))
  const whyButton = (inCard: boolean) =>
    why ? (
      <Button
        variant={inCard ? "ghost" : "outline"}
        size={tray && !inCard ? "lg" : "sm"}
        aria-expanded={why.open}
        className={cn(
          tray && !inCard && [TRAY_BUTTON, phoneCard && "max-sm:hidden"],
          inCard && "-my-1 -me-2 shrink-0 hover:bg-foreground/5",
          // Open: a shade off the grey tray, as the tray's ghost buttons are when open.
          !inCard && "aria-expanded:bg-input dark:aria-expanded:bg-input/50"
        )}
        onPress={() => {
          why.onToggle()
          // Enter stays the main action (Continue), not a second press of Why?.
          primaryRef.current?.focus()
        }}
      >
        {item.kind === "question" && item.kata.type === "scenario"
          ? t.everyPath
          : t.why}
      </Button>
    ) : null
  if (why) secondary = whyButton(false)
  const explanationOpen =
    item.kind === "question" &&
    state.question !== null &&
    explanationShown(state.question, item.role)

  // Enter runs the main action wherever focus is, so a click on Sound, the notch, or a menu doesn't
  // leave Enter pressing that control again (see enterTarget). Space still presses the focused one.
  const run = React.useRef<typeof primary | null>(primary)
  run.current = actionless ? null : primary
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || e.defaultPrevented) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (keyScope && !keyScope.current?.contains(target)) return
      const to = enterTarget(e, primaryRef.current)
      if (to === "own") return
      // Before the main action is ready, a control that would undo (data-enter=main) still keeps it.
      if (!run.current || run.current.isDisabled) {
        if (to === "hold") {
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }
      // In the capture phase, so React Aria's own press on the focused control never fires too.
      e.preventDefault()
      e.stopPropagation()
      run.current.onPress()
    }
    window.addEventListener("keydown", onKey, { capture: true })
    return () => window.removeEventListener("keydown", onKey, { capture: true })
  }, [keyScope])

  // Once feedback appears, focus moves to its button (Continue or Try again), or to the lesson itself
  // when the tray is hidden (D), so it doesn't fall to the page. Not on mount: a demo that loads
  // already checked must not pull the page to itself.
  const primaryRef = React.useRef<HTMLButtonElement>(null)
  const hadFeedback = React.useRef(Boolean(title))
  React.useEffect(() => {
    const has = Boolean(title)
    if (has && !hadFeedback.current) {
      const button = primaryRef.current
      if (button && button.closest("[inert]") === null) button.focus()
      else onFocusLost?.()
    }
    hadFeedback.current = has
  }, [title, onFocusLost])

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

  const buttons = actionless ? null : (
    <>
      <Button
        ref={primaryRef}
        size={tray ? "lg" : "sm"}
        className={cn(tray && [TRAY_BUTTON, PHONE_BAR])}
        variant={primary.variant ?? "default"}
        onPress={primary.onPress}
        isDisabled={primary.isDisabled}
      >
        {primary.label}
      </Button>
      {secondary}
    </>
  )

  // In the player the note says the message, so the bubble keeps only his line.
  // The player scrolls it clear of the bubble (data-feedback-note).
  const note = inBubble ? message : null
  const feedback = (withMessage: boolean) => (
    <>
      {title ? (
        <p className="text-sm font-semibold">
          <RichText text={title} />
        </p>
      ) : null}
      {withMessage && message ? (
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
      {note ? (
        // Under the answers, a step closer than the column's gap. Keyed by the text, so Why? fades it in.
        // The text size goes on a wrapper: on the same element as text-sm, the scaled size doesn't resolve.
        <div
          key={note}
          data-feedback-note
          aria-hidden="true"
          data-text-size={textSize}
          className={cn(
            "-mt-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
            rewinding &&
              "motion-safe:animate-out motion-safe:fade-out-0 motion-safe:fill-mode-forwards",
            // On phones it's in the tray's card instead.
            tray?.feedbackEl && "max-sm:hidden"
          )}
        >
          <Note tone={noteTone} text={note} />
        </div>
      ) : null}
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
          data-feedback-toast
          data-text-size={textSize}
          className={cn(
            TOAST,
            "absolute end-4 z-10 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 sm:end-auto sm:w-fit sm:max-w-80",
            // On phones it's a card in the tray instead (below).
            tray?.feedbackEl && "max-sm:hidden",
            // Rewinding: what he said runs back out.
            rewinding &&
              "motion-safe:animate-out motion-safe:fade-out-0 motion-safe:fill-mode-forwards motion-safe:slide-out-to-bottom-2",
            // In the player the bubble sits above the ninja, behind him, so he jumps in front of it.
            // Without him it takes his corner.
            tray && ninja
              ? "start-4 bottom-17 sm:start-6 sm:bottom-19"
              : "start-4 bottom-4 sm:start-6 sm:bottom-6",
            toneClass[tone]
          )}
        >
          {feedback(!inBubble)}
        </div>
      ) : null}
      {phoneCard && tray?.feedbackEl
        ? createPortal(
            <div
              key={`${state.index}-${state.question?.attempts ?? 0}-${tone}`}
              aria-hidden="true"
              data-text-size={textSize}
              // The tray takes the tone's color around it (PHONE_TRAY_TONE), so the card itself is bare.
              data-tone={tone}
              className={cn(
                "flex items-start gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
                rewinding &&
                  "motion-safe:animate-out motion-safe:fade-out-0 motion-safe:fill-mode-forwards"
              )}
            >
              <div className="min-w-0 flex-1">{feedback(true)}</div>
              {whyButton(true)}
            </div>,
            tray.feedbackEl
          )
        : null}
    </>
  )
}

/**
 * Whether a screen change skips its leaving animation (the intro's smoke, a concept sliding out) and
 * moves on at once: with reduced motion, and on phones, where a learner taps through quickly and the
 * wait reads as lag. The next screen still fades in.
 */
const goStraightOn = () =>
  matchMedia("(prefers-reduced-motion: reduce), (width < 40rem)").matches

/** The wind as the intro vanishes (ElevenLabs Sound Effects, "an extended whoosh of wind sweeping past"). */
const VANISH_SOUND = "/sfx/vanish.mp3"

/** Whether a media query matches, following changes. False until mounted. */
function useMedia(query: string): boolean {
  const [matches, setMatches] = React.useState(false)
  React.useEffect(() => {
    const list = matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener("change", update)
    return () => list.removeEventListener("change", update)
  }, [query])
  return matches
}

/**
 * True where the tray stays open, with no notch to close it: on touch screens (no keys to fall back
 * on) and phone widths (it holds the main action).
 */
const useFixedTray = () => useMedia("(pointer: coarse), (width < 40rem)")

/**
 * A short bar floating on the content's bottom edge: click, press, or drag it to close or open the tray.
 * It stays hidden until the pointer is over it, it has keyboard focus, or it's being dragged.
 */
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
  // Pointer capture moves the hover off the button mid-drag, so the bar keeps itself shown here.
  const [grabbed, setGrabbed] = React.useState(false)
  const end = (e: React.PointerEvent) => {
    if (start.current === null) return
    start.current = null
    setGrabbed(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
    // Pointer capture keeps the pointer's release from reaching the button, so a plain tap toggles here.
    if (dragged.current) onDrop()
    else onToggle()
  }
  return (
    // Capture-phase handlers: the button's own press handling stops pointer events from bubbling.
    // It floats over the content's bottom edge (centred by the auto margins) instead of taking a row.
    // Hidden by CSS where useFixedTray will drop it (touch screens, phones), so the server's HTML
    // doesn't show it there until hydration.
    <div
      className="absolute inset-x-0 bottom-0 z-10 mx-auto w-fit max-sm:hidden pointer-coarse:hidden"
      style={{ touchAction: "none" }}
      onPointerDownCapture={(e) => {
        start.current = e.clientY
        dragged.current = false
        setGrabbed(true)
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
          className={cn(
            "h-1.5 w-16 rounded-full bg-foreground/20 opacity-0 shadow-xs ring-1 ring-foreground/10 transition-colors group-hover/button:bg-foreground/35 group-hover/button:opacity-100 group-focus-visible/button:opacity-100 group-active/button:bg-foreground/50 supports-backdrop-filter:bg-foreground/10 supports-backdrop-filter:backdrop-blur-sm supports-backdrop-filter:group-hover/button:bg-foreground/25 supports-backdrop-filter:group-active/button:bg-foreground/40 motion-safe:transition-[opacity,background-color] motion-safe:duration-200",
            grabbed && "opacity-100"
          )}
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
