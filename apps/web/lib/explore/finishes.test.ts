import { describe, expect, it } from "vitest"

import { keepFinish, keptFinishes, sendFinishes } from "./finishes"

/** A Storage over a Map, as localStorage behaves. */
function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  }
}

const DAY = 24 * 3.6e6

/** A fetch that answers each lesson with its status, recording what was sent. */
function server(statuses: Record<string, number>) {
  const sent: { id: string; body: unknown }[] = []
  const post = (async (url: string, init?: RequestInit) => {
    const id = decodeURIComponent(url.split("/")[3]!)
    sent.push({ id, body: JSON.parse(String(init?.body)) })
    return new Response("{}", { status: statuses[id] ?? 200 })
  }) as typeof fetch
  return { sent, post }
}

describe("finishes kept while logged out", () => {
  it("keeps one per lesson, oldest first, and drops week-old ones", () => {
    const storage = memoryStorage()
    const now = Date.UTC(2026, 9, 29, 12)
    keepFinish("b", now - DAY, storage)
    keepFinish("a", now - 2 * DAY, storage)
    keepFinish("a", now - 3 * DAY, storage)
    keepFinish("old", now - 8 * DAY, storage)
    storage.setItem("learn:finished:junk", "{")
    storage.setItem("learn:progress:l/x", "{}")
    expect(keptFinishes(storage, now)).toEqual([
      { id: "a", at: now - 3 * DAY },
      { id: "b", at: now - DAY },
    ])
    expect(storage.getItem("learn:finished:old")).toBeNull()
    expect(storage.getItem("learn:finished:junk")).toBeNull()
    expect(storage.getItem("learn:progress:l/x")).toBe("{}")
  })

  it("sends each with when it happened, and forgets what the server took", async () => {
    const storage = memoryStorage()
    const at = Date.now() - DAY
    keepFinish("done1234", at, storage)
    keepFinish("gone1234", at + 1, storage)
    keepFinish("busy1234", at + 2, storage)
    const { sent, post } = server({ gone1234: 404, busy1234: 503 })
    await sendFinishes(storage, post)
    expect(sent.map((s) => s.id)).toEqual(["done1234", "gone1234", "busy1234"])
    expect(sent[0]!.body).toMatchObject({ at })
    // Only the one the server couldn't take waits for the next page.
    expect(keptFinishes(storage).map((f) => f.id)).toEqual(["busy1234"])
  })

  it("keeps them all when the browser turns out to be logged out", async () => {
    const storage = memoryStorage()
    keepFinish("a", Date.now(), storage)
    keepFinish("b", Date.now(), storage)
    const { sent, post } = server({ a: 401 })
    await sendFinishes(storage, post)
    expect(sent).toHaveLength(1)
    expect(keptFinishes(storage)).toHaveLength(2)
  })
})
