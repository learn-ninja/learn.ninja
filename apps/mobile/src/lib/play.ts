import {
  reducer as sharedReducer,
  start as sharedStart,
  type Action,
} from "@workspace/player-core/reducer"
import type { State } from "@workspace/player-core/state"
import type { Lesson } from "@workspace/spec"

// The app's lesson state: player-core's State, moved by the reducer the web runs too
// (packages/player-core/src/reducer.ts): answers, checking, retries, the reveal, the hint and the
// explanation, a scenario's brief, the fix round, and the score. The app binds the lesson once, so
// Restart needs no lesson of its own.

export type { Action }

/** The lesson from its intro. */
export function start(lesson: Lesson, run = 0): State {
  return sharedStart(lesson, undefined, run)
}

export type AppAction = Exclude<Action, { type: "restart" }> | { type: "restart" }

export function reducer(lesson: Lesson) {
  return (state: State, action: AppAction): State =>
    sharedReducer(
      state,
      action.type === "restart" ? { type: "restart", lesson } : action
    )
}
