import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Item } from "@workspace/player-core/flow"
import type { State } from "@workspace/player-core/state"

import { createProgressSync, resetSignedOut, type Send } from "./progress-sync"

const kata = (id: string) => ({ id }) as never
const items: Item[] = [
  { kind: "intro" },
  { kind: "question", kata: kata("hook"), role: "hook" },
  { kind: "concept", kata: kata("c1") },
  { kind: "question", kata: kata("q1"), role: "practice" },
  { kind: "question", kata: kata("end"), role: "challenge" },
  { kind: "fix" },
  { kind: "wrap" },
]
const at = (index: number, run = 0): State => ({
  items,
  index,
  results: {},
  mistakes: [],
  fixed: [],
  inFix: false,
  fixQueued: false,
  question: null,
  run,
})

let sent: { path: string; method: string; body: unknown }[]
let status: number
const send: Send = vi.fn(async (path, init) => {
  sent.push({ path, method: init.method, body: JSON.parse(init.body) })
  return { status }
})

beforeEach(() => {
  sent = []
  status = 200
  resetSignedOut()
})

describe("syncing progress to the server", () => {
  it("sends how far the learner got each time it changes, as the web does", async () => {
    const sync = createProgressSync("abc", send)
    sync.update(at(0))
    sync.update(at(1))
    sync.update(at(2))
    sync.update(at(2))
    sync.update(at(3))
    await Promise.resolve()
    expect(sent).toEqual([
      {
        path: "/api/lessons/abc/progress",
        method: "PUT",
        body: { done: 0, total: 4 },
      },
      {
        path: "/api/lessons/abc/progress",
        method: "PUT",
        body: { done: 1, total: 4 },
      },
      {
        path: "/api/lessons/abc/progress",
        method: "PUT",
        body: { done: 2, total: 4 },
      },
    ])
  })

  it("records the finish once per run, after the progress before it", async () => {
    const sync = createProgressSync("abc", send)
    sync.update(at(4))
    sync.update(at(6))
    sync.update(at(6))
    await vi.waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]).toMatchObject({
      path: "/api/lessons/abc/complete",
      method: "POST",
      body: { tz: expect.any(String) },
    })
    sync.update(at(6, 1))
    await vi.waitFor(() => expect(sent).toHaveLength(3))
  })

  it("stops asking once the server says the app isn't signed in", async () => {
    status = 401
    const sync = createProgressSync("abc", send)
    sync.update(at(1))
    await vi.waitFor(() => expect(sent).toHaveLength(1))
    sync.update(at(2))
    sync.update(at(6))
    await new Promise((r) => setTimeout(r, 10))
    expect(sent).toHaveLength(1)
  })
})
