"use client"

import * as React from "react"

import type { Brick, Lesson } from "@workspace/spec"
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
import { ariaLocaleFor, stringsFor, type TextSize } from "./strings"

export interface BrickDemoProps {
  lesson: Lesson
  /** Id of the brick to play, from `lesson.bricks` (or the hook or challenge). */
  brickId: string
  /** Formulas and code prepared on the server (prepareLesson). */
  prepared?: Prepared
  /** An answer to check on load, e.g. a wrong pick to show its feedback. */
  checked?: Answer
  /** Show the Check and help buttons (and feedback). Off, the brick can be played with but not checked. */
  actions?: boolean
  /** Stylesheet loaded inside the sandbox for HTML visuals. */
  visualsCss?: string
  textSize?: TextSize
  className?: string
}

/** One brick, playable on its own: check, feedback, retry. Continue starts it over; concepts have no action. */
export function BrickDemo({
  lesson,
  brickId,
  prepared = emptyPrepared,
  checked,
  actions = true,
  visualsCss = "/lesson-visuals.css",
  textSize = "md",
  className,
}: BrickDemoProps) {
  const brick = findBrick(lesson, brickId)
  const ui = lesson.language
  const dir = /^(ar|he|fa|ur)\b/i.test(ui) ? "rtl" : "ltr"
  const [state, dispatch] = React.useReducer(
    (s: State, a: Action) =>
      // Continue would move past the only item: start the brick over instead.
      a.type === "next" ? begin(brick) : reducer(s, a),
    undefined,
    () => begin(brick, checked)
  )
  const scope = React.useRef<HTMLDivElement>(null)
  const item = state.items[state.index]!
  return (
    <DirectionProvider locale={ariaLocaleFor(ui)}>
      <PlayerProvider
        value={{
          prepared,
          t: stringsFor(ui),
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
            <div data-text-size={textSize} className="flex flex-col gap-6">
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

function findBrick(lesson: Lesson, id: string): Brick {
  const brick = [lesson.hook, ...lesson.bricks, lesson.challenge].find(
    (b) => b.id === id
  )
  if (!brick) throw new Error(`No brick "${id}" in "${lesson.title}".`)
  return brick
}

function begin(brick: Brick, checked?: Answer): State {
  const item: Item =
    brick.type === "concept"
      ? { kind: "concept", brick }
      : { kind: "question", brick, role: "practice" }
  let state: State = {
    items: [item],
    index: 0,
    results: {},
    mistakes: [],
    fixed: [],
    inFix: false,
    fixQueued: false,
    run: 0,
    // Seeded by the brick id: the server and the browser must shuffle the same way.
    question: freshQuestion(item, seeded(brick.id)),
  }
  if (checked && state.question) {
    state = reducer(state, { type: "answer", answer: checked })
    state = reducer(state, { type: "check" })
  }
  return state
}
