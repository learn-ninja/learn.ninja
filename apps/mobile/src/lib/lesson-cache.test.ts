import { describe, expect, it } from "vitest"

import type { LoadedLesson } from "./api"
import {
  cachedLesson,
  cachedLessons,
  cacheLesson,
  forgetCachedLesson,
  KEEP,
  LESSON_PREFIX,
  LESSONS_KEY,
  type CacheStorage,
} from "./lesson-cache"

const DAY = 24 * 3.6e6
const NOW = 1_800_000_000_000

function storage(): CacheStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

function loaded(
  title: string,
  expiresAt: number | null = NOW + 3 * DAY
): LoadedLesson {
  return {
    id: title,
    path: `/l/${title}`,
    lesson: { title, language: "en" } as LoadedLesson["lesson"],
    prepared: {} as LoadedLesson["prepared"],
    mathSvg: {},
    baseCss: ".x{}",
    expiresAt,
  }
}

describe("the lessons kept on the phone", () => {
  it("gives back a lesson it kept, marked offline", () => {
    const s = storage()
    cacheLesson(s, "a-1", loaded("a"), NOW)
    const kept = cachedLesson(s, "a-1", NOW + DAY)
    expect(kept?.lesson.title).toBe("a")
    expect(kept?.baseCss).toBe(".x{}")
    expect(kept?.offline).toBe(true)
    expect(cachedLesson(s, "b-2", NOW)).toBeNull()
  })

  it("lists the most recently opened first, once each", () => {
    const s = storage()
    cacheLesson(s, "a-1", loaded("a"), NOW)
    cacheLesson(s, "b-2", loaded("b"), NOW + 1)
    cacheLesson(s, "a-1", loaded("a"), NOW + 2)
    expect(cachedLessons(s, NOW + 3).map((e) => e.param)).toEqual([
      "a-1",
      "b-2",
    ])
  })

  it(`keeps the newest ${KEEP} and removes the rest`, () => {
    const s = storage()
    for (let i = 0; i <= KEEP; i++)
      cacheLesson(s, `l-${i}`, loaded(`l${i}`), NOW + i)
    const list = cachedLessons(s, NOW + KEEP + 1)
    expect(list).toHaveLength(KEEP)
    expect(list.at(-1)?.param).toBe("l-1")
    expect(s.map.has(LESSON_PREFIX + "l-0")).toBe(false)
  })

  it("drops a lesson once its link has expired", () => {
    const s = storage()
    cacheLesson(s, "a-1", loaded("a", NOW + DAY), NOW)
    cacheLesson(s, "kept", loaded("kept", null), NOW)
    expect(cachedLesson(s, "a-1", NOW + 2 * DAY)).toBeNull()
    expect(cachedLessons(s, NOW + 2 * DAY).map((e) => e.param)).toEqual([
      "kept",
    ])
    expect(s.map.has(LESSON_PREFIX + "a-1")).toBe(false)
  })

  it("doesn't keep a lesson that has already expired", () => {
    const s = storage()
    cacheLesson(s, "a-1", loaded("a", NOW - 1), NOW)
    expect(cachedLessons(s, NOW)).toEqual([])
    expect(s.map.has(LESSON_PREFIX + "a-1")).toBe(false)
  })

  it("forgets a lesson that's gone", () => {
    const s = storage()
    cacheLesson(s, "a-1", loaded("a"), NOW)
    forgetCachedLesson(s, "a-1")
    expect(cachedLesson(s, "a-1", NOW)).toBeNull()
    expect(cachedLessons(s, NOW)).toEqual([])
  })

  it("survives an unreadable list or copy", () => {
    const s = storage()
    s.setItem(LESSONS_KEY, "not json")
    expect(cachedLessons(s, NOW)).toEqual([])
    cacheLesson(s, "a-1", loaded("a"), NOW)
    s.setItem(LESSON_PREFIX + "a-1", "{")
    expect(cachedLesson(s, "a-1", NOW)).toBeNull()
  })
})
