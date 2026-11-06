import { describe, expect, it } from "vitest"

import type { LessonRowData } from "./feed"
import { mergeFirstPage } from "./feed-merge"

const row = (id: string, createdAt: number, likes = 0): LessonRowData => ({
  id,
  slug: id,
  title: id,
  summary: "",
  level: "beginner",
  minutes: 5,
  language: "en",
  author: null,
  views: 0,
  likes,
  visibility: "public",
  hidden: false,
  createdAt,
  expiresAt: null,
})

describe("Explore coming back into view", () => {
  it("updates the first page's rows and keeps the pages scrolled through", () => {
    const feed = {
      lessons: [row("c", 30), row("b", 20), row("a", 10)],
      next: "cursor-2",
      viewer: { signedIn: true, liked: ["b", "a"], completed: { a: 1 } },
    }
    const page = {
      lessons: [row("d", 40), row("c", 30, 5), row("b", 20)],
      next: "cursor-1",
      viewer: { signedIn: true, liked: ["c"], completed: { c: 2 } },
    }
    const merged = mergeFirstPage(feed, page)
    expect(merged.lessons.map((l) => l.id)).toEqual(["d", "c", "b", "a"])
    expect(merged.lessons[1]!.likes).toBe(5)
    expect(merged.next).toBe("cursor-2")
    // b was unliked on the web; a is beyond the page, so it keeps what it had.
    expect(merged.viewer!.liked.sort()).toEqual(["a", "c"])
    expect(merged.viewer!.completed).toEqual({ a: 1, c: 2 })
  })

  it("takes the page as it is when nothing was shown yet", () => {
    const page = {
      lessons: [row("a", 10)],
      next: null,
      viewer: { signedIn: true, liked: [], completed: {} },
    }
    expect(mergeFirstPage({ lessons: [], next: null }, page)).toBe(page)
  })
})
