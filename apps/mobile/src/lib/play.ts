import { buildSequence } from "@workspace/player-core/flow"
import { freshQuestion, type State } from "@workspace/player-core/state"
import type { Lesson } from "@workspace/spec"

// The app's lesson state: player-core's State, moved by the same rules as the web's reducer
// (packages/player/src/lesson-player.tsx). Phase 1 plays concepts only, so question katas are
// stepped past without an answer; checking, the fix round, and the score come with phase 2.

export type Action =
  | { type: "next" }
  | { type: "restart" }
  /** Progress kept on the device, loaded as the lesson opens. */
  | { type: "resume"; state: State }

/** The lesson from its intro. */
export function start(lesson: Lesson, run = 0): State {
  return {
    items: buildSequence(lesson),
    index: 0,
    results: {},
    mistakes: [],
    fixed: [],
    inFix: false,
    fixQueued: false,
    question: null,
    run,
  }
}

export function reducer(lesson: Lesson) {
  return (state: State, action: Action): State => {
    switch (action.type) {
      case "restart":
        return start(lesson, state.run + 1)
      case "resume":
        return action.state
      case "next": {
        if (state.index >= state.items.length - 1) return state
        let index = state.index + 1
        // As on the web: with nothing to fix, the fix round's screen is skipped.
        if (
          state.items[index]?.kind === "fix" &&
          state.mistakes.length === 0 &&
          !state.fixQueued
        )
          index++
        const item = state.items[index]
        return {
          ...state,
          index,
          inFix: state.inFix || item?.kind === "fix",
          question: freshQuestion(item),
        }
      }
    }
  }
}
