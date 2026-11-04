import { countProgress } from "@workspace/player-core/progress"
import type { State } from "@workspace/player-core/state"

// How far the learner gets in a published lesson, and when they finish it, told to the server as
// the web's lesson page tells it (apps/web/components/lesson-view.tsx): PUT /api/lessons/{id}/progress
// with { done, total } each time that changes mid-lesson, and POST /api/lessons/{id}/complete with
// the learner's time zone when the wrap-up shows, once per run, after the last progress has landed.
// Both need a signed-in learner; until the app signs in (phase 4) the server answers 401, and the
// app stops asking for the rest of the session. Bundled test lessons aren't on the server: they
// stay on the device.

export type Send = (
  path: string,
  init: { method: "PUT" | "POST"; body: string }
) => Promise<{ status: number }>

/** Whether the server has said the app isn't signed in: nothing more is sent until it relaunches. */
let signedOut = false

export function createProgressSync(id: string, send: Send) {
  let sentDone: number | undefined
  let completedRun: number | undefined
  let last: Promise<unknown> = Promise.resolve()

  const post = (path: string, method: "PUT" | "POST", body: unknown) => {
    if (signedOut) return Promise.resolve()
    return send(`/api/lessons/${encodeURIComponent(id)}/${path}`, {
      method,
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (res.status === 401) signedOut = true
      })
      .catch(() => {})
  }

  return {
    /** Called with every new state: sends what changed, if anything. */
    update(state: State) {
      const item = state.items[state.index]
      if (!item || item.kind === "intro") return
      if (item.kind === "wrap") {
        if (completedRun === state.run) return
        completedRun = state.run
        // After the last progress lands, or that would mark the lesson in progress again.
        last = last.then(() =>
          post("complete", "POST", {
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
        )
        return
      }
      const progress = countProgress(state.items, state.index)
      // The fix round is past every kata: nothing new to say until the finish does.
      if (progress.done >= progress.total || progress.done === sentDone) return
      sentDone = progress.done
      last = post("progress", "PUT", progress)
    },
  }
}

/** For tests: forget that the server said the app is signed out. */
export function resetSignedOut() {
  signedOut = false
}
