import { countProgress } from "@workspace/player-core/progress"
import type { State } from "@workspace/player-core/state"

// How far the learner gets in a published lesson, and when they finish it, told to the server as
// the web's lesson page tells it (apps/web/components/lesson-view.tsx): PUT /api/lessons/{id}/progress
// with { done, total } each time that changes mid-lesson, and POST /api/lessons/{id}/complete with
// the learner's time zone when the wrap-up shows, once per run, after the last progress has landed.
// Both need a signed-in learner. Logged out, the server answers 401 and the app stops asking until
// it signs in (`signedIn`): then every open lesson sends what the server missed, its latest
// progress and its finish. Bundled test lessons aren't on the server: they stay on the device.

export type Send = (
  path: string,
  init: { method: "PUT" | "POST"; body: string }
) => Promise<{ status: number }>

/** Whether the server has said the app isn't signed in: nothing more is sent until it signs in. */
let signedOut = false

/** The lessons open now, so signing in can send what each one missed. */
const open = new Set<{ resend: () => void }>()

export function createProgressSync(id: string, send: Send) {
  let sentDone: number | undefined
  let completedRun: number | undefined
  /** The latest progress and finish, and whether the server has them (a 401, any other failure, or no connection: not yet). */
  let progress: { body: unknown; landed: boolean } | null = null
  let finish: { body: unknown; landed: boolean } | null = null
  // Every request waits for the one before it, so they land in the order they were made: a slow
  // progress can't arrive after a higher one, or after the finish and mark the lesson in progress.
  let last: Promise<unknown> = Promise.resolve()
  const queue = (request: () => Promise<unknown>) => {
    last = last.then(request)
  }

  const post = (
    path: string,
    method: "PUT" | "POST",
    entry: { body: unknown; landed: boolean }
  ) => {
    if (signedOut) return Promise.resolve()
    return send(`/api/lessons/${encodeURIComponent(id)}/${path}`, {
      method,
      body: JSON.stringify(entry.body),
    })
      .then((res) => {
        if (res.status === 401) signedOut = true
        // Only a success has it: a 429 or a server error is sent again after the next sign-in,
        // as a lost connection is.
        else if (res.status >= 200 && res.status < 300) entry.landed = true
      })
      .catch(() => {})
  }

  const sync = {
    /** Called with every new state: sends what changed, if anything. */
    update(state: State) {
      const item = state.items[state.index]
      if (!item || item.kind === "intro") return
      if (item.kind === "wrap") {
        if (completedRun === state.run) return
        completedRun = state.run
        const entry = (finish = {
          body: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
          landed: false,
        })
        queue(() => post("complete", "POST", entry))
        return
      }
      const counted = countProgress(state.items, state.index)
      // The fix round is past every kata: nothing new to say until the finish does.
      if (counted.done >= counted.total || counted.done === sentDone) return
      sentDone = counted.done
      const entry = (progress = { body: counted, landed: false })
      queue(() => post("progress", "PUT", entry))
    },
    /** After signing in: sends the progress and the finish the server didn't take, in that order. */
    resend() {
      if (progress && !progress.landed && !finish) {
        const entry = progress
        queue(() => post("progress", "PUT", entry))
      }
      if (finish && !finish.landed) {
        const entry = finish
        queue(() => post("complete", "POST", entry))
      }
    },
    /** The lesson closed: signing in no longer resends for it. */
    close() {
      open.delete(sync)
    },
  }
  open.add(sync)
  return sync
}

/** The app signed in: requests go out again, and every open lesson sends what the server missed. */
export function signedIn() {
  signedOut = false
  for (const sync of open) sync.resend()
}

/** For tests: forget that the server said the app is signed out, and every open lesson. */
export function resetSignedOut() {
  signedOut = false
  open.clear()
}
