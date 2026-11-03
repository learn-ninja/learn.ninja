"use client"

import * as React from "react"

import type { Kata, Lesson } from "@workspace/spec"
import { DirectionProvider } from "@workspace/ui/components/direction"
import { cn } from "@workspace/ui/lib/utils"

import type { Answer } from "./check"
import { PlayerProvider } from "./context"
import type { Item } from "./flow"
import {
  ActionArea,
  freshQuestion,
  reducer,
  Screen,
  type Action,
  type State,
} from "./lesson-player"
import { emptyPrepared, type Prepared } from "./prepared"
import { seeded } from "./random"
import {
  ariaLocaleFor,
  directionOf,
  UI_TRANSLATIONS,
  useStrings,
  type TextSize,
} from "./strings"

export interface KataDemoProps {
  lesson: Lesson
  /** Id of the kata to play, from `lesson.katas` (or the hook or challenge). */
  kataId: string
  /** Formulas and code prepared on the server (prepareLesson). */
  prepared?: Prepared
  /** An answer to check on load, e.g. a wrong pick to show its feedback. */
  checked?: Answer
  /** Show the Check and help buttons (and feedback). Off, the kata can be played with but not checked. */
  actions?: boolean
  /** Stylesheet loaded inside the sandbox for HTML visuals. */
  visualsCss?: string
  textSize?: TextSize
  className?: string
}

/** One kata, playable on its own: check, feedback, retry. Continue starts it over; concepts have no action. */
export function KataDemo(props: KataDemoProps) {
  // Suspends until the lesson's language has loaded; hydration keeps the server's HTML meanwhile.
  return (
    <React.Suspense>
      <Demo {...props} />
    </React.Suspense>
  )
}

function Demo({
  lesson,
  kataId,
  prepared = emptyPrepared,
  checked,
  actions = true,
  visualsCss = "/lesson-visuals.css",
  textSize = "md",
  className,
}: KataDemoProps) {
  const kata = findKata(lesson, kataId)
  const ui = UI_TRANSLATIONS ? lesson.language : "en"
  const t = useStrings(ui)
  const dir = directionOf(ui)
  const [state, dispatch] = React.useReducer(
    (s: State, a: Action) =>
      // Continue would move past the only item: start the kata over instead.
      a.type === "next" ? begin(kata) : reducer(s, a),
    undefined,
    () => begin(kata, checked)
  )
  const scope = React.useRef<HTMLDivElement>(null)
  const item = state.items[state.index]!
  return (
    <DirectionProvider locale={ariaLocaleFor(ui)}>
      <PlayerProvider
        value={{
          prepared,
          t,
          lang: ui,
          dir,
          visualsCss,
          keyScope: scope,
        }}
      >
        <div
          ref={scope}
          dir={dir}
          lang={ui}
          className={cn(
            "relative overflow-hidden rounded-xl bg-card text-card-foreground shadow-xs ring-1 ring-foreground/10",
            className
          )}
        >
          <div
            className={cn(
              "flex flex-col gap-8 px-4 py-8 sm:px-8",
              // Room for the feedback toast in the bottom corner.
              item.kind === "question" && actions && "pb-28"
            )}
          >
            <div
              data-text-size={textSize}
              data-player-content
              className="flex flex-col gap-6"
            >
              <Screen
                lesson={lesson}
                item={item}
                state={state}
                dispatch={dispatch}
              />
            </div>
            {item.kind === "question" && actions ? (
              <ActionArea
                lesson={lesson}
                item={item}
                state={state}
                dispatch={dispatch}
                textSize={textSize}
              />
            ) : null}
          </div>
        </div>
      </PlayerProvider>
    </DirectionProvider>
  )
}

function findKata(lesson: Lesson, id: string): Kata {
  const kata = [lesson.hook, ...lesson.katas, lesson.challenge].find(
    (b) => b.id === id
  )
  if (!kata) throw new Error(`No kata "${id}" in "${lesson.title}".`)
  return kata
}

function begin(kata: Kata, checked?: Answer): State {
  const item: Item =
    kata.type === "concept"
      ? { kind: "concept", kata }
      : { kind: "question", kata, role: "practice" }
  let state: State = {
    items: [item],
    index: 0,
    results: {},
    mistakes: [],
    fixed: [],
    inFix: false,
    fixQueued: false,
    run: 0,
    // Seeded by the kata id: the server and the browser must shuffle the same way.
    question: freshQuestion(item, seeded(kata.id)),
  }
  if (checked && state.question) {
    state = reducer(state, { type: "answer", answer: checked })
    state = reducer(state, { type: "check" })
  }
  return state
}
