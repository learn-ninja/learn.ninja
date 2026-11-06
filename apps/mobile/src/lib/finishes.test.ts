import { beforeEach, describe, expect, it, vi } from "vitest"

import { keptFinishes, sendFinishes, type FinishStorage } from "./finishes"
import type { State } from "@workspace/player-core/state"

import { createProgressSync, resetSignedOut, type Send } from "./progress-sync"

beforeEach(() => resetSignedOut())

/** A state at the wrap-up, for a progress sync to send the finish. */
const atWrap = {
  items: [{ kind: "intro" }, { kind: "wrap" }],
  index: 1,
  results: {},
  mistakes: [],
  fixed: [],
  inFix: false,
  fixQueued: false,
  question: null,
  run: 0,
} as unknown as State

const DAY = 24 * 3.6e6

function storage(entries: Record<string, string>): FinishStorage & {
  map: Map<string, string>
} {
  const map = new Map(Object.entries(entries))
  return {
    map,
    get length() {
      return map.size
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    removeItem: (k) => void map.delete(k),
  }
}

describe("finishes kept while logged out", () => {
  it("reads them oldest first, and drops any over a week old or unreadable", () => {
    const now = 100 * DAY
    const s = storage({
      "learn:finished:b": JSON.stringify({ at: now - DAY }),
      "learn:finished:a": JSON.stringify({ at: now - 2 * DAY }),
      "learn:finished:old": JSON.stringify({ at: now - 8 * DAY }),
      "learn:finished:bad": "{",
      "learn:days": "[]",
    })
    expect(keptFinishes(s, now)).toEqual([
      { id: "a", at: now - 2 * DAY },
      { id: "b", at: now - DAY },
    ])
    expect([...s.map.keys()].sort()).toEqual([
      "learn:days",
      "learn:finished:a",
      "learn:finished:b",
    ])
  })

  it("sends each to /complete once with its time, and forgets the ones the server took", async () => {
    const at = Date.now() - DAY
    const s = storage({
      "learn:finished:a": JSON.stringify({ at }),
      "learn:finished:busy": JSON.stringify({ at: at + 1 }),
    })
    const sent: { path: string; body: unknown }[] = []
    const send: Send = vi.fn(async (path, init) => {
      sent.push({ path, body: JSON.parse(init.body) })
      return { status: path.includes("busy") ? 429 : 200 }
    })
    await Promise.all([
      sendFinishes(s, send, "Europe/Rome"),
      sendFinishes(s, send, "Europe/Rome"),
    ])
    expect(sent).toEqual([
      { path: "/api/lessons/a/complete", body: { tz: "Europe/Rome", at } },
      {
        path: "/api/lessons/busy/complete",
        body: { tz: "Europe/Rome", at: at + 1 },
      },
    ])
    // Rate-limited: kept for next time. Sent: forgotten, so a second sign-in sends nothing again.
    expect([...s.map.keys()]).toEqual(["learn:finished:busy"])
  })

  it("skips a finish the progress sync already sent, or still holds to send itself", async () => {
    const at = Date.now() - DAY
    const s = storage({
      "learn:finished:sent": JSON.stringify({ at }),
      "learn:finished:held": JSON.stringify({ at }),
    })
    const sent: string[] = []
    // The sync for "sent" delivers its finish; the one for "held" is refused (logged out).
    const send: Send = vi.fn(async (path) => {
      sent.push(path)
      return { status: path.includes("held") ? 401 : 200 }
    })
    createProgressSync("sent", send).update(atWrap)
    await vi.waitFor(() => expect(sent).toHaveLength(1))
    createProgressSync("held", vi.fn(async () => ({ status: 401 }))).update(atWrap)
    await new Promise((r) => setTimeout(r, 10))
    await sendFinishes(s, send, "Europe/Rome")
    // Neither goes out again: "sent" is forgotten, "held" waits for its own sync.
    expect(sent).toEqual(["/api/lessons/sent/complete"])
    expect([...s.map.keys()]).toEqual(["learn:finished:held"])
  })

  it("keeps them all when the server says the app isn't signed in", async () => {
    const at = Date.now()
    const s = storage({
      "learn:finished:a": JSON.stringify({ at }),
      "learn:finished:b": JSON.stringify({ at }),
    })
    const send: Send = vi.fn(async () => ({ status: 401 }))
    await sendFinishes(s, send)
    expect(send).toHaveBeenCalledTimes(1)
    expect(s.map.size).toBe(2)
  })
})
