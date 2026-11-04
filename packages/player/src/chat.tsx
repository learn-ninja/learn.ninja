"use client"

import * as React from "react"

import type { Answer } from "./check"
import type { ChatVisual, QuestionKata } from "@workspace/spec"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"

import { usePlayer } from "./context"
import { calm } from "./motion"
import { Ninja } from "./ninja"
import { RichText } from "./rich-text"

// A conversation as chat bubbles: the other people on the start side, each named above their run
// of bubbles with their initials beside it, and the learner's own lines on the end side in the
// accent color with the ninja beside them (the learner is the ninja in training), as every
// messaging app lays it out. A scenario adds two turns once the learner has picked: what they
// said, then the other person's reply (the pick's outcome). The reply takes its time: the pick
// settles, the other person types a while, and the reply takes the dots' place.

export interface ChatTurn {
  /** Who says it; left out, it's the learner's own line. */
  who?: string
  text: string
  /** A turn added after checking: it slides in, and a reply waits behind typing dots first. */
  added?: "pick" | "reply"
}

/**
 * The turns a scenario's pick adds to its chat: the learner's line, then the other person's reply
 * (the option's outcome). Nothing until the answer has been checked; once revealed, the best path.
 */
export function scenarioTurns(
  kata: QuestionKata,
  answer: Answer,
  phase: "answering" | "feedback" | "revealed"
): ChatTurn[] {
  if (kata.type !== "scenario" || kata.visual?.kind !== "chat") return []
  if (phase === "answering") return []
  const picked =
    phase === "revealed"
      ? kata.options.find((o) => o.quality === "best")
      : kata.options.find(
          (o) => answer.kind === "select" && answer.ids[0] === o.id
        )
  if (!picked) return []
  const last = kata.visual.turns[kata.visual.turns.length - 1]!
  return [
    { text: picked.text, added: "pick" },
    { who: last.who, text: picked.outcome, added: "reply" },
  ]
}

/** The initials on a speaker's avatar: the first letter of their first two words. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0]!.toUpperCase())
    .join("")
}

// The reply's timing, in ms: the pick lands, a beat, the other person starts typing, types for a
// while, then the reply takes the dots' place. The bubbles ease in over ENTER each.
const PICK = 100
const DOTS = 800
const REPLY = 2300
const ENTER = 450

/** The bubble's entrance: it fades up from just below over ENTER ms, after `delay`. */
const enter = (delay: number) => ({
  className:
    "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:ease-out",
  style: { animationDelay: `${delay}ms`, animationDuration: `${ENTER}ms` },
})

export function ChatBlock({
  chat,
  extra = [],
  label,
  plain = false,
}: {
  chat: ChatVisual
  /** Turns added after the lesson's own, like a scenario's pick and its reply. */
  extra?: ChatTurn[]
  label?: string
  plain?: boolean
}) {
  const { t } = usePlayer()
  const reply = extra.find((x) => x.added === "reply")
  // The reply waits behind typing dots: the dots are their own bubble until REPLY, then the reply
  // takes their place (same spot, same side), so nothing else on the screen moves.
  const [typing, setTyping] = React.useState(false)
  const replyKey = reply ? `${reply.who}:${reply.text}` : null
  React.useEffect(() => {
    if (!replyKey || calm()) return
    setTyping(true)
    const timer = window.setTimeout(() => setTyping(false), REPLY)
    return () => window.clearTimeout(timer)
  }, [replyKey])
  const turns: ChatTurn[] = [...chat.turns, ...extra]

  return (
    <div
      className={cn(
        "flex justify-center",
        !plain && "rounded-xl border bg-background px-4 py-4"
      )}
    >
      {/* A transcript to a screen reader: each line read with who said it. */}
      <ol
        aria-label={chat.alt ?? label ?? t.visual}
        className="flex w-full flex-col gap-1"
      >
        {turns.map((turn, i) => {
          const mine = !turn.who
          const prev = turns[i - 1]
          // A name heads a run of one person's bubbles; the next person's run starts a new group.
          const newRun = !prev || prev.who !== turn.who
          const waiting = turn.added === "reply" && typing
          const motion =
            turn.added === "pick"
              ? enter(PICK)
              : turn.added === "reply"
                ? // The dots ease in once the pick has landed; the reply, as it takes their place.
                  enter(waiting ? DOTS : 0)
                : null
          return (
            <li
              // The dots and the reply are different bubbles in the same place, each with its entrance.
              key={waiting ? `${i}-typing` : i}
              className={cn(
                "flex max-w-[85%] flex-col gap-1",
                mine ? "items-end self-end" : "items-start self-start",
                newRun && i > 0 && "mt-2",
                motion?.className
              )}
              style={motion?.style}
            >
              {!mine && newRun ? (
                <span className="ms-9 text-xs text-muted-foreground">
                  {turn.who}
                </span>
              ) : (
                <span className="sr-only">{turn.who ?? t.you}: </span>
              )}
              <div className="flex items-end gap-2">
                {!mine ? (
                  <Avatar
                    size="sm"
                    aria-hidden="true"
                    // Only the last bubble of a run has the avatar; the rest leave its space.
                    className={cn(
                      turns[i + 1]?.who === turn.who && "invisible"
                    )}
                  >
                    <AvatarFallback className="text-[10px] font-medium">
                      {initials(turn.who!)}
                    </AvatarFallback>
                  </Avatar>
                ) : null}
                <div
                  className={cn(
                    "rounded-[18px] px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-ee-md bg-primary text-primary-foreground"
                      : "rounded-es-md bg-muted text-foreground"
                  )}
                >
                  {waiting ? (
                    <TypingDots />
                  ) : (
                    <RichText text={turn.text} className="text-pretty" />
                  )}
                </div>
                {mine ? (
                  <Ninja
                    aria-hidden="true"
                    className={cn(
                      "size-6 shrink-0 text-foreground",
                      turns[i + 1] && !turns[i + 1]!.who && "invisible"
                    )}
                  />
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Three dots that rise in turn, while a reply is "being typed". The text follows, so they say nothing. */
function TypingDots() {
  return (
    <span aria-hidden="true" className="flex h-5 items-center gap-1 px-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="chat-dot size-1.5 rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  )
}
