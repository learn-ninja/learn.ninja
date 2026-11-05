import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Item } from "@workspace/player-core/flow"
import type { State } from "@workspace/player-core/state"

import {
  createProgressSync,
  resetSignedOut,
  signedIn,
  type Send,
} from "./progress-sync"

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
    await vi.waitFor(() => expect(sent).toHaveLength(3))
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

  it("sends what the server missed once the app signs in: the latest progress, then the finish", async () => {
    status = 401
    const sync = createProgressSync("abc", send)
    sync.update(at(1))
    await vi.waitFor(() => expect(sent).toHaveLength(1))
    sync.update(at(3))
    await new Promise((r) => setTimeout(r, 10))
    expect(sent).toHaveLength(1)
    status = 200
    signedIn()
    await vi.waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]).toEqual({
      path: "/api/lessons/abc/progress",
      method: "PUT",
      body: { done: 2, total: 4 },
    })
    // Sent now: signing in again sends nothing more.
    signedIn()
    await new Promise((r) => setTimeout(r, 10))
    expect(sent).toHaveLength(2)
  })

  it("resends only the finish when the lesson ended logged out, and nothing for a closed lesson", async () => {
    status = 401
    const finished = createProgressSync("done", send)
    finished.update(at(1))
    await vi.waitFor(() => expect(sent).toHaveLength(1))
    // The 401 has landed: nothing more goes out.
    await new Promise((r) => setTimeout(r, 10))
    finished.update(at(6))
    const closed = createProgressSync("gone", send)
    closed.update(at(2))
    closed.close()
    // Both were held back while logged out.
    await new Promise((r) => setTimeout(r, 10))
    expect(sent).toHaveLength(1)
    status = 200
    signedIn()
    await new Promise((r) => setTimeout(r, 20))
    expect(sent.map((r) => `${r.path} ${r.method}`)).toEqual([
      "/api/lessons/done/progress PUT",
      "/api/lessons/done/complete POST",
    ])
  })

  it("sends each request only after the one before it lands, so a slow one can't overtake", async () => {
    const started: string[] = []
    const pending: (() => void)[] = []
    // Every request hangs until the test lets it land.
    const slow: Send = (path, init) => {
      started.push(`${init.method} ${path} ${init.body}`)
      return new Promise((resolve) =>
        pending.push(() => resolve({ status: 200 }))
      )
    }
    const sync = createProgressSync("abc", slow)
    sync.update(at(1))
    sync.update(at(2))
    sync.update(at(6))
    await vi.waitFor(() => expect(started).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 10))
    // The second progress and the finish wait for the first.
    expect(started).toHaveLength(1)
    pending.shift()!()
    await vi.waitFor(() => expect(started).toHaveLength(2))
    expect(started[1]).toContain('"done":1')
    pending.shift()!()
    await vi.waitFor(() => expect(started).toHaveLength(3))
    expect(started[2]).toMatch(/^POST \/api\/lessons\/abc\/complete/)
  })
})
