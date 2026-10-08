"use client"

import * as React from "react"
import { LightbulbIcon, PanelRightIcon } from "lucide-react"

import type { Lesson, QuestionBrick } from "@workspace/spec"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Kbd } from "@workspace/ui/components/kbd"
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
import { PlayerProvider, usePlayer } from "./context"
import {
  hasOptionCards,
  BlankBrick,
  ConceptBrick,
  HotspotBrick,
  MatchBrick,
  OptionsBrick,
  OrderBrick,
  SortBrick,
} from "./bricks"
import {
  buildSequence,
  outcomeFor,
  partAt,
  summarize,
  type Item,
  type Outcome,
  type Role,
} from "./flow"
import { Mascot } from "./mascot"
import { emptyPrepared, type Prepared } from "./prepared"
import { RichText } from "./rich-text"
import {
  LessonFooter,
  LessonHeader,
  PanelRightFilledIcon,
  TheoryPanel,
  usePreferences,
} from "./shell"
import {
  ariaLocaleFor,
  stringsFor,
  type Strings,
  type TextSize,
  type Theme,
} from "./strings"
import { Visual } from "./visuals"

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
  /** Header links to the docs and to making a lesson. Omit either to hide its button. */
  docsHref?: string
  createHref?: string
  /** The link Share copies. Defaults to the current page. */
  shareUrl?: string
  /** The app's color theme. Pass both to show the theme setting in the footer. */
  theme?: Theme
  onThemeChange?: (theme: Theme) => void
}

export function LessonPlayer({
  lesson,
  prepared = emptyPrepared,
  uiLanguage,
  expiresAt,
  visualsCss = "/lesson-visuals.css",
  homeHref = "/",
  docsHref,
  createHref,
  shareUrl,
  theme,
  onThemeChange,
}: LessonPlayerProps) {
  const [prefs, setPrefs] = usePreferences()
  // A choice made in the footer wins over the page's default for this session.
  const [chosen, setChosen] = React.useState<string>()
  const ui = chosen ?? uiLanguage ?? prefs.uiLanguage ?? lesson.language
  const t = stringsFor(ui)
  const locale = ariaLocaleFor(ui)
  const dir = /^(ar|he|fa|ur)\b/i.test(ui) ? "rtl" : "ltr"
  return (
    <DirectionProvider locale={locale}>
      <PlayerProvider value={{ prepared, t, dir, visualsCss }}>
        <div
          dir={dir}
          lang={ui}
          className="flex h-full min-h-0 flex-col bg-background text-foreground"
        >
          <Player
            lesson={lesson}
            textSize={prefs.textSize}
            expiresAt={expiresAt}
            homeHref={homeHref}
            docsHref={docsHref}
            createHref={createHref}
            shareUrl={shareUrl}
          />
          <LessonFooter
            t={t}
            prefs={prefs}
            onPrefs={(patch) => {
              if (patch.uiLanguage) setChosen(patch.uiLanguage)
              setPrefs(patch)
            }}
            uiLanguage={ui}
            theme={theme}
            onThemeChange={onThemeChange}
          />
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
  usedHint: boolean
  hintOpen: boolean
  result: CheckResult | null
  phase: Phase
  /** Display order for options and match columns, fixed for the life of the question. */
  optionOrder: string[]
  rightOrder: number[]
  bank: string[]
}

export interface State {
  items: Item[]
  index: number
  results: Record<string, Outcome>
  mistakes: QuestionBrick[]
  inFix: boolean
  fixQueued: boolean
  question: QuestionState | null
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
    usedHint: false,
    hintOpen: false,
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
    bank:
      brick.type === "blank"
        ? shuffle(
            [...new Set(brick.blanks.flatMap((b) => b.choices ?? []))],
            random
          )
        : [],
  }
}

function start(lesson: Lesson): State {
  const items = buildSequence(lesson)
  return {
    items,
    index: 0,
    results: {},
    mistakes: [],
    inFix: false,
    fixQueued: false,
    question: null,
  }
}

export type Action =
  | { type: "next" }
  | { type: "restart"; lesson: Lesson }
  | { type: "answer"; answer: Answer }
  | { type: "hint" }
  | { type: "check" }
  | { type: "retry" }
  | { type: "startFix" }

export function reducer(state: State, action: Action): State {
  const item = state.items[state.index]
  switch (action.type) {
    case "restart":
      return start(action.lesson)
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
      return state.question
        ? { ...state, question: { ...state.question, answer: action.answer } }
        : state
    case "hint":
      return state.question
        ? {
            ...state,
            question: { ...state.question, usedHint: true, hintOpen: true },
          }
        : state
    case "retry": {
      if (!state.question || item?.kind !== "question") return state
      return {
        ...state,
        question: {
          ...state.question,
          phase: "answering",
          result: null,
          answer: retryAnswer(item.brick, state.question.answer),
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
                [brick.id]: outcomeFor(s.attempts, s.usedHint),
              }
        return {
          ...state,
          results,
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
  textSize,
  expiresAt,
  homeHref,
  docsHref,
  createHref,
  shareUrl,
}: {
  lesson: Lesson
  textSize: TextSize
  expiresAt?: number
  homeHref: string
  docsHref?: string
  createHref?: string
  shareUrl?: string
}) {
  const { t } = usePlayer()
  const [state, dispatch] = React.useReducer(reducer, lesson, start)
  const [theoryOpen, setTheoryOpen] = React.useState(false)
  // Theory starts open where there's room for it beside the lesson.
  React.useEffect(() => {
    if (SHOW_THEORY && matchMedia("(min-width: 64rem)").matches)
      setTheoryOpen(true)
  }, [])
  const theoryId = React.useId()
  const item = state.items[state.index]!
  const scrollRef = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [state.index])
  const parts = partAt(state.items, state.index, state.inFix)
  const seenConcepts = state.items
    .slice(0, state.index + 1)
    .flatMap((i) => (i.kind === "concept" ? [i.brick] : []))

  return (
    <>
      <LessonHeader
        title={lesson.title}
        parts={parts}
        expiresAt={expiresAt}
        homeHref={homeHref}
        docsHref={docsHref}
        createHref={createHref}
        shareUrl={shareUrl}
        onRestart={() => {
          setTheoryOpen(false)
          dispatch({ type: "restart", lesson })
        }}
        t={t}
      />
      <div className="relative flex min-h-0 flex-1 gap-4 sm:px-8">
        <div className="relative flex min-w-0 flex-1 overflow-hidden border-y bg-card sm:rounded-xl sm:border-0 sm:shadow-xs sm:ring-1 sm:ring-foreground/10">
          <div className="relative flex min-w-0 flex-1 flex-col">
            {SHOW_THEORY ? (
              <div className="absolute end-4 top-4 z-10 sm:end-6 sm:top-6">
                <Button
                  variant="outline"
                  size="sm"
                  aria-expanded={theoryOpen}
                  aria-controls={theoryOpen ? theoryId : undefined}
                  onPress={() => setTheoryOpen((open) => !open)}
                >
                  {t.theory}
                  {theoryOpen ? (
                    <PanelRightFilledIcon className="rtl:-scale-x-100" />
                  ) : (
                    <PanelRightIcon className="rtl:-scale-x-100" />
                  )}
                </Button>
              </div>
            ) : null}
            <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <div
                key={state.index}
                className={cn(
                  "mx-auto flex min-h-full w-full flex-col justify-center gap-8 px-4 py-16 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
                  columnWidth(item),
                  item.kind === "question" && "pb-40"
                )}
              >
                <div data-text-size={textSize} className="flex flex-col gap-6">
                  <Screen
                    lesson={lesson}
                    item={item}
                    state={state}
                    dispatch={dispatch}
                  />
                </div>
                <ActionArea
                  lesson={lesson}
                  item={item}
                  state={state}
                  dispatch={dispatch}
                  textSize={textSize}
                />
              </div>
            </main>
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

/** Questions and short screens read best narrow; visuals and side-by-side bricks need room. */
function columnWidth(item: Item): string {
  if (item.kind === "intro") return "max-w-sm"
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
}: {
  lesson: Lesson
  item: Item
  state: State
  dispatch: React.Dispatch<Action>
}) {
  const { t } = usePlayer()
  switch (item.kind) {
    case "intro":
      return (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold text-balance">
                {lesson.title}
              </h1>
              <p className="text-sm font-medium text-muted-foreground">
                {lesson.summary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {lesson.topic ? (
                <Badge variant="outline">{lesson.topic}</Badge>
              ) : null}
              <Badge variant="outline">
                {t.minutes(lesson.estimatedMinutes)}
              </Badge>
              <Badge variant="outline">{t.levels[lesson.level]}</Badge>
            </div>
          </div>
        </>
      )
    case "concept":
      return <ConceptBrick brick={item.brick} />
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
      return <WrapUp lesson={lesson} results={state.results} />
    case "question":
      return (
        <QuestionScreen
          item={item}
          state={state.question!}
          dispatch={dispatch}
        />
      )
  }
}

function QuestionScreen({
  item,
  state,
  dispatch,
}: {
  item: Extract<Item, { kind: "question" }>
  state: QuestionState
  dispatch: React.Dispatch<Action>
}) {
  const { t } = usePlayer()
  const { brick, role } = item
  const locked = state.phase !== "answering"
  // After a second miss, show the solution. The hook shows the learner's pick and the right answer.
  const marks: Record<string, Mark> =
    state.phase !== "revealed"
      ? (state.result?.marks ?? {})
      : role === "hook"
        ? { ...solutionMarks(brick), ...state.result?.marks }
        : solutionMarks(brick)
  const props = {
    brick,
    answer: state.answer,
    setAnswer: (answer: Answer) => dispatch({ type: "answer", answer }),
    marks,
    locked,
  }
  const helper = helperFor(brick, t)
  const showOutcomes =
    brick.type === "scenario" && state.result
      ? [
          ...(state.answer.kind === "select" ? state.answer.ids : []),
          ...(state.phase === "revealed"
            ? brick.options.filter((o) => o.quality === "best").map((o) => o.id)
            : []),
        ]
      : []

  return (
    <>
      <h2 className="text-2xl font-semibold">
        <RichText text={brick.prompt} />
      </h2>
      {helper && helper !== brick.prompt ? (
        <p className="-mt-4 text-sm text-muted-foreground">{helper}</p>
      ) : null}
      {brick.type === "scenario" ? (
        <div className="rounded-e-lg border-s-2 border-primary bg-muted px-4 py-3 text-base">
          <RichText text={brick.situation} />
        </div>
      ) : null}
      {brick.visual && brick.type !== "hotspot" ? (
        <Visual visual={brick.visual} />
      ) : null}
      {brick.type === "choice" ||
      brick.type === "compare" ||
      brick.type === "scenario" ? (
        <OptionsBrick
          {...props}
          order={state.optionOrder}
          showOutcomes={showOutcomes}
        />
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
      {state.hintOpen && brick.hint ? (
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
}: {
  lesson: Lesson
  results: Record<string, Outcome>
}) {
  const { t } = usePlayer()
  const s = summarize(lesson, results)
  const pct = Math.round((s.first / s.total) * 100)
  const rows: [string, number, string][] = [
    ["bg-green-600", s.first, t.firstTry],
    ["bg-amber-500", s.hint, t.withHint],
    ["bg-primary", s.second, t.secondTry],
    ["bg-red-600", s.missed, t.missed],
  ]
  return (
    <div className="flex flex-col gap-6">
      <Mascot mood="cheer" size="lg" />
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

type Tone = "neutral" | "good" | "bad" | "warn" | "info"

/** The screen's main action (with Enter as its shortcut), and the feedback after checking. */
export function ActionArea({
  lesson,
  item,
  state,
  dispatch,
  textSize,
  keyScope,
}: {
  lesson: Lesson
  item: Item
  state: State
  dispatch: React.Dispatch<Action>
  textSize: TextSize
  /** Only take Enter from inside this element (for several demos on one page). Omit to listen page-wide. */
  keyScope?: React.RefObject<HTMLElement | null>
}) {
  const { t } = usePlayer()
  let tone: Tone = "neutral"
  let title: string | null = null
  let message: string | null = null
  let primary: {
    label: string
    onPress: () => void
    isDisabled?: boolean
    variant?: "default" | "warning" | "success"
  } = {
    label: t.continue,
    onPress: () => dispatch({ type: "next" }),
  }
  let secondary: React.ReactNode = null
  // "Why?" reveals the explanation, so feedback stays one short line until the learner asks.
  const [why, setWhy] = React.useState(false)
  React.useEffect(() => setWhy(false), [state.index, state.question?.attempts])
  let explanation: string | null = null
  const helpButton = (label: string, onPress: () => void) => (
    <Button variant="outline" size="sm" onPress={onPress}>
      {label}
    </Button>
  )

  if (item.kind === "intro")
    primary = { label: t.start, onPress: () => dispatch({ type: "next" }) }
  else if (item.kind === "fix")
    primary = {
      label: t.fixStart,
      onPress: () => dispatch({ type: "startFix" }),
    }
  else if (item.kind === "wrap") {
    primary = {
      label: t.restart,
      onPress: () => dispatch({ type: "restart", lesson }),
    }
  } else if (item.kind === "question" && state.question) {
    const s = state.question
    const { brick, role } = item
    const r = s.result
    const canHelp = Boolean(brick.hint) && role !== "hook" && !s.usedHint
    const missText = (res: CheckResult) =>
      res.feedback ?? (res.missKey ? missMessage(res, t) : null)
    if (s.phase === "answering") {
      primary = {
        label: t.check,
        onPress: () => dispatch({ type: "check" }),
        isDisabled: !isReady(brick, s.answer),
      }
      if (canHelp)
        secondary = helpButton(t.getHelp, () => dispatch({ type: "hint" }))
    } else if (role === "hook" && r) {
      tone = "info"
      title = r.correct ? t.goodGuess : t.hookMiss
      explanation = brick.explanation
    } else if (s.phase === "feedback" && r?.correct) {
      tone = "good"
      title =
        s.usedHint && s.attempts === 0
          ? t.correctWithHint
          : t.praise[praiseIndex(brick.id, t.praise.length)]!
      explanation = brick.explanation
      primary = { ...primary, variant: "success" }
    } else if (s.phase === "feedback" && r) {
      // A miss gets one short line: the option's own feedback, or a nudge to look again.
      tone = "warn"
      title = (r.partial ? t.close : missText(r)) ?? t.nudge
      message = r.partial ? missText(r) : null
      primary = {
        label: t.tryAgain,
        onPress: () => dispatch({ type: "retry" }),
        variant: "warning",
      }
      if (canHelp)
        secondary = helpButton(t.getHelp, () => {
          dispatch({ type: "retry" })
          dispatch({ type: "hint" })
        })
    } else if (s.phase === "revealed") {
      tone = "bad"
      title = t.answer
      message = brick.explanation
    }
  }

  if (explanation) {
    if (why) message = explanation
    else secondary = helpButton(t.why, () => setWhy(true))
  }

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

  const toneClass: Record<Tone, string> = {
    neutral: "",
    good: "border-green-500 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200",
    bad: "border-red-400 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
    warn: "border-yellow-500 bg-yellow-100 text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-100",
    info: "border-border bg-popover text-popover-foreground",
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={primary.variant ?? "default"}
          onPress={primary.onPress}
          isDisabled={primary.isDisabled}
          autoFocus={Boolean(title)}
        >
          {primary.label}
          <Kbd
            className={cn(
              "pointer-coarse:hidden",
              primary.variant === "warning" &&
                "bg-yellow-950/10 text-yellow-950",
              primary.variant === "success" && "bg-green-950/10 text-green-950"
            )}
          >
            Enter
          </Kbd>
        </Button>
        {secondary}
      </div>
      <p aria-live="polite" className="sr-only">
        {title ? [title, message].filter(Boolean).join(" ") : ""}
      </p>
      {title ? (
        <div
          key={`${state.index}-${state.question?.attempts ?? 0}-${tone}-${why}`}
          aria-hidden="true"
          data-text-size={textSize}
          className={cn(
            "absolute inset-x-4 bottom-4 z-10 rounded-xl border px-5 py-4 shadow-xs motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 sm:inset-x-auto sm:start-6 sm:bottom-6 sm:w-fit sm:max-w-80",
            toneClass[tone]
          )}
        >
          <p className="font-semibold">{title}</p>
          {message ? (
            <RichText text={message} className="mt-1 block text-sm" />
          ) : null}
        </div>
      ) : null}
    </>
  )
}

/** A stable pick from the praise lines for a question, so it doesn't change on re-render. */
function praiseIndex(id: string, count: number): number {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % count
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
