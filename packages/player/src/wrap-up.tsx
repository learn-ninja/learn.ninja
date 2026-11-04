"use client"

import * as React from "react"
import {
  CheckIcon,
  CopyIcon,
  PencilIcon,
  RotateCcwIcon,
  SwordsIcon,
  TrophyIcon,
} from "lucide-react"

import type { Lesson } from "@workspace/spec"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { challengeLink, challengeResult } from "./challenge"
import { usePlayer } from "./context"
import { useCreatorControls } from "./creator"
import { scoredQuestions, type Outcome, type Summary } from "@workspace/player-core/flow"
import { RichText } from "./rich-text"
import { directionOf, NEXT_KINDS, type NextKind } from "@workspace/player-core/strings"

// The wrap-up's pieces, laid out by WrapUp (lesson-player.tsx) in one narrow column: the run bar
// and the challenge's result under the score, a row of actions with one filled, then the
// takeaways and Keep learning as grouped lists, the way a settings screen groups its rows.

/** A copied-for-a-moment flag for copy buttons. */
function useCopied<T>(): [T | null, (on: T | null) => void] {
  const [copied, setCopied] = React.useState<T | null>(null)
  React.useEffect(() => {
    if (copied === null) return
    const id = setTimeout(() => setCopied(null), 2000)
    return () => clearTimeout(id)
  }, [copied])
  return [copied, setCopied]
}

/**
 * A titled group of rows: a quiet label (and an optional action at its end) above a card whose
 * rows are split by lines.
 */
export function WrapSection({
  title,
  action,
  children,
}: {
  title: string
  /** A link-style button at the end of the label's line. */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center justify-between gap-3 px-1">
        <h2 id={id} className="text-sm font-medium text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      <div className="divide-y overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        {children}
      </div>
    </section>
  )
}

const SEGMENT: Record<Outcome, string> = {
  first: "bg-green-600",
  second: "bg-yellow-500",
  missed: "bg-foreground/15",
}

/**
 * The run as one bar under the score: a segment for each scored question in play order, green on
 * the first try, yellow after another go, empty when it was missed.
 */
export function RunBar({
  lesson,
  results,
}: {
  lesson: Lesson
  results: Record<string, Outcome>
}) {
  const { t } = usePlayer()
  const outcomes = scoredQuestions(lesson).map((b) => results[b.id] ?? "missed")
  return (
    <ol aria-label={t.howYouDid} className="flex w-full max-w-56 gap-1">
      {outcomes.map((o, i) => (
        <li key={i} className={cn("h-1.5 flex-1 rounded-full", SEGMENT[o])}>
          <span className="sr-only">
            {i + 1}. {t.outcomes[o]}
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * For a logged-out learner, under the score: this finish is kept in the browser, and logging in
 * puts it on their profile. A quiet link, since finishing needs no account.
 */
export function KeepLogIn() {
  const { t, keepLogIn } = usePlayer()
  if (!keepLogIn) return null
  return (
    <a
      href={keepLogIn}
      className="rounded-md text-sm font-medium text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {t.keepLogIn}
    </a>
  )
}

/** For a challenged learner, under the score: whether they beat the score they were sent. */
export function ChallengeVerdict({ summary }: { summary: Summary }) {
  const { t, challenge } = usePlayer()
  if (!challenge) return null
  const verdict = challengeResult(summary.first, challenge)
  return (
    <p className="inline-flex items-center gap-2 text-sm font-medium">
      <TrophyIcon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0",
          verdict === "won" ? "text-yellow-500" : "text-muted-foreground"
        )}
      />
      <WithHandles
        text={
          verdict === "won"
            ? t.challengeWon(summary.first, challenge.first, challenge.by)
            : verdict === "tied"
              ? t.challengeTied(summary.first, challenge.by)
              : t.challengeLost(summary.first, challenge.first, challenge.by)
        }
      />
    </p>
  )
}

/**
 * The wrap-up's actions, in one row: Challenge a friend filled, Restart outlined. The link carries
 * the learner's first tries (and their handle, logged in) and the message dares a friend to beat
 * them, whatever the score. Phones open the share sheet; elsewhere the message and link are copied,
 * and a toast says so.
 */
export function WrapActions({
  lesson,
  summary,
  onRestart,
  extra,
}: {
  lesson: Lesson
  summary: Summary
  onRestart: () => void
  /** One more outlined button at the row's end (the heart, for learners). */
  extra?: React.ReactNode
}) {
  const { t, shareUrl, challenge, challenger } = usePlayer()

  async function send() {
    const page = shareUrl ?? window.location.href
    const url = challengeLink(page, summary.first, summary.total, challenger)
    const text = t.challengeMessage(summary.first, summary.total)
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: lesson.title, text, url })
      } catch {
        // Dismissed by the learner.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      // Says what to do with it next: the copy alone doesn't send anything.
      toast.success(t.messageCopied, { description: t.challengeCopiedHint })
    } catch {
      toast.error(t.copyFailed)
    }
  }

  return (
    // On phones the row stacks, each button the column's width.
    <div className="flex justify-center gap-2 max-sm:flex-col">
      <Button size="lg" onPress={() => void send()}>
        <SwordsIcon data-icon="inline-start" className="rtl:-scale-x-100" />
        {challenge ? t.challengeBack : t.challengeTitle}
      </Button>
      <Button size="lg" variant="outline" onPress={onRestart}>
        <RotateCcwIcon data-icon="inline-start" />
        {t.restart}
      </Button>
      {extra}
    </div>
  )
}

/** The takeaways as a grouped list, a check on each row, with Make changes by the label for the maker. */
export function Takeaways({
  items,
  language,
}: {
  items: string[]
  /** The lesson's language: each takeaway reads in its direction, under the interface's heading. */
  language?: string
}) {
  const { t } = usePlayer()
  const controls = useCreatorControls()
  return (
    <WrapSection
      title={t.takeaways}
      // The maker's way to change what the lesson says, beside what it said.
      action={
        controls ? (
          <Button
            variant="link"
            size="sm"
            className="h-6 px-0 text-foreground"
            onPress={controls.openChanges}
          >
            <PencilIcon data-icon="inline-start" />
            {t.makeChanges}
          </Button>
        ) : null
      }
    >
      {items.map((k) => (
        <div
          key={k}
          dir={language ? directionOf(language) : undefined}
          lang={language}
          className="flex gap-3 px-4 py-3 text-sm font-medium"
        >
          <CheckIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-green-600"
          />
          <RichText text={k} className="min-w-0" />
        </div>
      ))}
    </WrapSection>
  )
}

/**
 * Keep learning: a row for each lesson the learner could ask their agent for next (the lesson's
 * suggested next topic, this topic deeper, this topic harder), each copying its prompt when pressed.
 */
export function KeepLearning({ lesson }: { lesson: Lesson }) {
  const { t, nextPrompt } = usePlayer()
  const [copied, setCopied] = useCopied<NextKind>()
  if (!nextPrompt) return null

  const topics: Partial<Record<NextKind, string>> = {
    next: lesson.wrapup.next,
    deeper: lesson.title,
    harder: lesson.title,
  }
  const rows = NEXT_KINDS.filter((k) => topics[k])

  async function copy(kind: NextKind, topic: string) {
    if (!nextPrompt || !topic.trim()) return
    try {
      await navigator.clipboard.writeText(
        nextPrompt(kind, topic.trim(), lesson.title)
      )
      setCopied(kind)
      // The toast says what the prompt is for, so the list needs no note of its own.
      toast.success(t.promptCopied, { description: t.nextHint })
    } catch {
      toast.error(t.copyFailed)
    }
  }

  // A row's copy icon turns into a check for a moment; the toast says the rest.
  const mark = (kind: NextKind) =>
    copied === kind ? (
      <CheckIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-green-600"
      />
    ) : (
      <CopyIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    )

  return (
    <WrapSection title={t.keepLearning}>
      {rows.map((kind) => (
        // In a wrapper: the button's own transparent border would hide the line between rows.
        <div key={kind}>
          <Button
            variant="ghost"
            aria-label={`${t.keepKinds[kind]}: ${topics[kind]}. ${t.copyPrompt}`}
            className="h-auto min-h-16 w-full justify-between gap-4 rounded-none px-4 py-3 text-start whitespace-normal"
            onPress={() => void copy(kind, topics[kind]!)}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t.keepKinds[kind]}
              </span>
              <span className="text-sm font-medium">{topics[kind]}</span>
            </span>
            {mark(kind)}
          </Button>
        </div>
      ))}
    </WrapSection>
  )
}

/** On a challenge link's title screen: the sender's score to beat. */
export function ChallengeNote() {
  const { t, challenge } = usePlayer()
  if (!challenge) return null
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-medium shadow-xs ring-1 ring-foreground/10">
      <SwordsIcon aria-hidden="true" className="size-4 shrink-0" />
      <WithHandles
        text={t.challengeFrom(challenge.first, challenge.total, challenge.by)}
      />
    </p>
  )
}

/** Text with @handles kept left to right, so they read right in Arabic and Hebrew. */
function WithHandles({ text }: { text: string }) {
  return (
    <span>
      {text.split(/(@[a-z0-9][a-z0-9-]*)/).map((part, i) =>
        i % 2 ? (
          <bdi key={i} dir="ltr">
            {part}
          </bdi>
        ) : (
          part
        )
      )}
    </span>
  )
}
