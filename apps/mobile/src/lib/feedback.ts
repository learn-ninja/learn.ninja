import { isReady, POOL, type CheckResult } from "@workspace/player-core/check"
import type { Item } from "@workspace/player-core/flow"
import {
  earnedMoment,
  hintOffered,
  missMessage,
} from "@workspace/player-core/reducer"
import type { State } from "@workspace/player-core/state"
import type { NinjaLevel, Strings } from "@workspace/player-core/strings"
import {
  CADENCE,
  characterFor,
  voiceLines,
  type LinePicker,
  type Moment,
} from "@workspace/player-core/voices"

import type { AppAction } from "./play"

// What the tray shows for a screen, as the web's ActionArea decides it for the player on a phone
// (packages/player/src/lesson-player.tsx): the main button, Hint or Why? beside it, and after a
// check the ninja's line with a note of help under it, the whole tray taking the feedback's tone.
// Pure, so it's tested without the screen.

export type Tone = "neutral" | "good" | "warn"

export interface TrayAction {
  label: string
  action: AppAction
  variant: "default" | "success" | "warning" | "outline"
  disabled?: boolean
}

export interface Feedback {
  tone: Tone
  /** The ninja's line, heading the feedback. */
  title: string | null
  /** Under his line: a miss's hint, where a scenario pick led, or the explanation. */
  message: string | null
  /** The message's color: green for the explanation or a right pick's outcome, amber otherwise. */
  noteTone: "good" | "warn"
  /** The hint while answering, as a quiet note under the answers. */
  hintNote: string | null
  primary: TrayAction | null
  /** The Hint toggle beside Check, while it's offered. */
  hint: { open: boolean } | null
  /** Why? after a right answer (Every path on a scenario), in the feedback card. */
  why: { open: boolean; everyPath: boolean } | null
  /** A scenario's brief is on screen: Continue goes on to the question. */
  brief: boolean
}

export function feedbackFor({
  item,
  state,
  t,
  lang,
  pickLine,
  whyOpen,
  level = "sensei",
}: {
  item: Item
  state: State
  t: Strings
  lang: string
  pickLine: LinePicker
  whyOpen: boolean
  level?: NinjaLevel
}): Feedback {
  const out: Feedback = {
    tone: "neutral",
    title: null,
    message: null,
    noteTone: "warn",
    hintNote: null,
    primary: {
      label: t.continue,
      action: { type: "next" },
      variant: "default",
    },
    hint: null,
    why: null,
    brief: false,
  }
  // One line per piece of feedback, in the character's voice, rationed and without repeats.
  const say = (moment: Moment) =>
    pickLine(
      `${state.index}-${state.question?.attempts ?? 0}-${state.question?.phase ?? ""}-${moment}-${level}`,
      moment,
      voiceLines(lang, level, moment),
      CADENCE[characterFor(level)]
    )
  if (item.kind === "intro")
    out.primary = {
      label: t.start,
      action: { type: "next" },
      variant: "default",
    }
  else if (item.kind === "concept") return out
  else if (item.kind === "fix")
    out.primary = {
      label: t.fixStart,
      action: { type: "startFix" },
      variant: "default",
    }
  else if (item.kind === "wrap")
    // The wrap-up's own actions come with the ninja in phase 3; until then it offers a replay.
    out.primary = {
      label: t.restart,
      action: { type: "restart" },
      variant: "default",
    }
  else if (item.kind === "question" && state.question) {
    const s = state.question
    const { kata, role } = item
    const r = s.result
    const missText = (res: CheckResult) =>
      res.feedback ?? (res.missKey ? missMessage(res, t) : null)
    // A scenario is a story: what each pick led to is said, and a miss rewinds. With a chat, the
    // pick's outcome is the other person's reply in it, so only the verdict is said.
    const story = kata.type === "scenario"
    const outcome = (res: CheckResult) =>
      story && kata.visual?.kind === "chat" ? null : (res.feedback ?? null)
    if (story && !s.briefed) {
      out.brief = true
      out.primary = {
        label: t.continue,
        action: { type: "briefed" },
        variant: "default",
      }
    } else if (s.phase === "answering") {
      // Until every sort item is in a group, Check says how many are left instead.
      const unsorted =
        s.answer.kind === "zones" ? (s.answer.zones[POOL] ?? []).length : 0
      out.primary = {
        label: unsorted ? t.sortLeft(unsorted) : t.check,
        action: { type: "check" },
        variant: "default",
        disabled: !isReady(kata, s.answer),
      }
      if (kata.hint && s.hintOpen) out.hintNote = kata.hint
      if (hintOffered(item, s)) out.hint = { open: s.hintOpen }
    } else if (role === "hook" && r) {
      // The hook is a guess, so a miss still moves on; the concept after it does the explaining.
      out.tone = r.correct ? "good" : "warn"
      out.title = say(r.correct ? "goodGuess" : "hookMiss")
      out.primary = {
        label: t.continue,
        action: { type: "next" },
        variant: r.correct ? "success" : "warning",
      }
    } else if (s.phase === "feedback" && r?.correct) {
      out.tone = "good"
      out.title = say(earnedMoment(state, item) ?? "praise")
      out.message = whyOpen ? kata.explanation : story ? outcome(r) : null
      out.noteTone = "good"
      out.primary = {
        label: t.continue,
        action: { type: "next" },
        variant: "success",
      }
      out.why = { open: whyOpen, everyPath: story }
    } else if (s.phase === "feedback" && r && story) {
      // What the pick led to, then back to the decision.
      out.tone = "warn"
      out.title = say(r.partial ? "close" : "nudge")
      out.message = outcome(r)
      out.primary = {
        label: t.rewind,
        action: { type: "retry" },
        variant: "warning",
      }
    } else if (s.phase === "feedback" && r) {
      // A miss: the verdict and one line of help, the hint (or the pick's own feedback).
      out.tone = "warn"
      out.title = r.partial ? say("close") : say("nudge")
      out.message = kata.hint ?? missText(r)
      out.primary = {
        label: t.tryAgain,
        action: { type: "retry" },
        variant: "warning",
      }
    } else if (s.phase === "revealed") {
      // The answer and why it's right open in the kata; the note says why.
      out.title = say("answer")
      out.message = kata.explanation
      out.noteTone = "good"
    }
  }
  return out
}
