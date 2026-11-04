import type { Lesson, QuestionKata } from "@workspace/spec"

import { buildSequence, type Item, type Outcome } from "./flow"
import { freshQuestion, type QuestionState, type State } from "./state"

// Where a learner is in a lesson, kept on the device (localStorage on the web) so reopening the
// lesson carries on from the same screen instead of the intro. One entry per lesson, keyed by the
// page. Only what can't be rebuilt from the lesson is kept: the katas come back from the lesson
// itself, so each save stays small however big the lesson's visuals are.

export const PROGRESS_PREFIX = "learn:progress:"
/** Saved progress older than this is dropped the next time any lesson loads. */
const KEEP_MS = 7 * 24 * 3.6e6
/** Bumped whenever `Kept` changes shape. Version 1 kept the whole State; it still loads. */
export const PROGRESS_VERSION = 2

/** A State without its katas: questions are named by id. */
interface Kept {
  index: number
  results: Record<string, Outcome>
  /** The fix round's questions, in order, once it has started. */
  retries: string[]
  mistakes: string[]
  fixed: string[]
  inFix: boolean
  fixQueued: boolean
  question: QuestionState | null
  run: number
}

/**
 * Where progress is kept: the browser's localStorage on the web, a synchronous key-value store on
 * a phone. The same shape as the Web Storage API, so localStorage fits as it is.
 */
export interface ProgressStorage {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface Saved {
  v: typeof PROGRESS_VERSION
  /** The lesson's content when the progress was saved; a changed lesson starts over. */
  fingerprint: string
  savedAt: number
  /** For a feed that doesn't load the lesson: the katas behind the learner, out of all of them. */
  progress: { done: number; total: number }
  state: Kept
}

/** What version 1 saved: the whole State. */
interface SavedV1 {
  v: 1
  fingerprint: string
  savedAt: number
  state: State
}

/** A short hash (FNV-1a) of the lesson's teaching content: the title and summary may change freely. */
export function fingerprint(lesson: Lesson): string {
  const text = JSON.stringify([lesson.hook, lesson.katas, lesson.challenge])
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

/**
 * The saved state for this lesson, or null when there is none, it's for other content, or it
 * doesn't fit the lesson. Also drops entries for every lesson that haven't been touched in a week.
 * `print` is the lesson's fingerprint when the caller already has it.
 */
export function loadProgress(
  storage: ProgressStorage,
  key: string,
  lesson: Lesson,
  print = fingerprint(lesson)
): State | null {
  try {
    prune(storage)
    const raw = storage.getItem(PROGRESS_PREFIX + key)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<Saved> | Partial<SavedV1>
    if (saved.fingerprint !== print) return null
    if (saved.v === 1) {
      const state = saved.state
      return isObject(state) &&
        Array.isArray(state.items) &&
        typeof state.index === "number" &&
        state.items[state.index]
        ? restore(keep(state), lesson)
        : null
    }
    return saved.v === PROGRESS_VERSION ? restore(saved.state, lesson) : null
  } catch {
    // Storage can be blocked or hold something else; the lesson starts fresh.
    return null
  }
}

/**
 * Keep the state, or forget it once there's nothing to come back to: the intro (untouched) or the
 * wrap-up (finished), so the next visit starts the lesson afresh.
 */
export function saveProgress(
  storage: ProgressStorage,
  key: string,
  lesson: Lesson,
  state: State,
  print = fingerprint(lesson)
) {
  try {
    const item = state.items[state.index]
    if (!item || item.kind === "intro" || item.kind === "wrap") {
      storage.removeItem(PROGRESS_PREFIX + key)
      return
    }
    const saved: Saved = {
      v: PROGRESS_VERSION,
      fingerprint: print,
      savedAt: Date.now(),
      progress: countProgress(state.items, state.index),
      state: keep(state),
    }
    storage.setItem(PROGRESS_PREFIX + key, JSON.stringify(saved))
  } catch {
    // Not saved (blocked or full); the lesson still plays on.
  }
}

function prune(storage: ProgressStorage) {
  const stale: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key?.startsWith(PROGRESS_PREFIX)) continue
    try {
      const saved = JSON.parse(storage.getItem(key) ?? "") as Partial<Saved>
      if (
        typeof saved.savedAt !== "number" ||
        Date.now() - saved.savedAt > KEEP_MS
      )
        stale.push(key)
    } catch {
      stale.push(key)
    }
  }
  for (const key of stale) storage.removeItem(key)
}

/**
 * How far the learner got in a lesson they left midway, for a feed that doesn't hold the lesson
 * itself: the katas behind them (the hook, the lesson's katas, and the challenge; fix-round
 * retries don't count) out of all of them. Null when nothing is saved under the key or it's over
 * a week old. Without the lesson there's no fingerprint check, so an edited lesson still shows its
 * old progress until it's opened.
 */
export function savedProgress(
  storage: ProgressStorage,
  key: string
): { done: number; total: number } | null {
  try {
    const raw = storage.getItem(PROGRESS_PREFIX + key)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<Saved> | Partial<SavedV1>
    if (
      typeof saved.savedAt !== "number" ||
      Date.now() - saved.savedAt > KEEP_MS
    )
      return null
    let progress: unknown = null
    if (saved.v === PROGRESS_VERSION) progress = saved.progress
    else if (
      saved.v === 1 &&
      isObject(saved.state) &&
      Array.isArray(saved.state.items) &&
      typeof saved.state.index === "number"
    )
      progress = countProgress(saved.state.items, saved.state.index)
    if (
      !isObject(progress) ||
      typeof progress.done !== "number" ||
      typeof progress.total !== "number"
    )
      return null
    return progress.total > 0
      ? { done: progress.done, total: progress.total }
      : null
  } catch {
    return null
  }
}

/** The katas behind the learner at `index` (fix-round retries don't count), out of all of them. */
export function countProgress(
  items: Item[],
  index: number
): { done: number; total: number } {
  let done = 0
  let total = 0
  items.forEach((item, i) => {
    if (!("kata" in item) || (item.kind === "question" && item.role === "fix"))
      return
    total++
    if (i < index) done++
  })
  return { done, total }
}

/** The state without its katas. */
function keep(state: State): Kept {
  return {
    index: state.index,
    results: state.results,
    retries: state.items.flatMap((item) =>
      item.kind === "question" && item.role === "fix" ? [item.kata.id] : []
    ),
    mistakes: (state.mistakes ?? []).map((kata) => kata.id),
    fixed: state.fixed,
    inFix: state.inFix,
    fixQueued: state.fixQueued,
    question: state.question,
    run: state.run,
  }
}

const OUTCOMES = new Set<unknown>(["first", "second", "missed"])
const PHASES = new Set<unknown>(["answering", "feedback", "revealed"])

/**
 * The State a kept one stands for, with the katas taken from the lesson. Anything it holds that
 * doesn't fit (a field from an older player, a question the lesson no longer has) is replaced by
 * its default or, where nothing sensible can stand in, makes the whole thing null, so a stale save
 * starts the lesson over instead of breaking it.
 */
function restore(kept: unknown, lesson: Lesson): State | null {
  if (!isObject(kept)) return null
  const questions = new Map<string, QuestionKata>(
    [
      lesson.hook,
      ...lesson.katas.filter((b): b is QuestionKata => b.type !== "concept"),
      lesson.challenge,
    ].map((kata) => [kata.id, kata])
  )
  const katas = (ids: unknown) => {
    if (!Array.isArray(ids)) return []
    const found = ids.map((id) => questions.get(id as string))
    return found.every(Boolean) ? (found as QuestionKata[]) : null
  }
  const retries = katas(kept.retries)
  const mistakes = katas(kept.mistakes)
  if (!retries || !mistakes) return null

  const items = buildSequence(lesson)
  const fixAt = items.findIndex((i) => i.kind === "fix")
  items.splice(
    fixAt + 1,
    0,
    ...retries.map((kata): Item => ({ kind: "question", kata, role: "fix" }))
  )
  const index = kept.index
  if (!Number.isInteger(index) || !items[index as number]) return null
  const item = items[index as number]!

  const results: Record<string, Outcome> = {}
  if (isObject(kept.results))
    for (const [id, outcome] of Object.entries(kept.results))
      if (questions.has(id) && OUTCOMES.has(outcome))
        results[id] = outcome as Outcome

  return {
    items,
    index: index as number,
    results,
    mistakes,
    fixed: strings(kept.fixed),
    inFix: kept.inFix === true,
    fixQueued: kept.fixQueued === true,
    question: restoreQuestion(kept.question, item),
    run: typeof kept.run === "number" ? kept.run : 0,
  }
}

/** The question in progress, over a fresh one's defaults; a fresh one when the saved doesn't fit. */
function restoreQuestion(saved: unknown, item: Item): QuestionState | null {
  const base = freshQuestion(item)
  if (!base || !isObject(saved)) return base
  const question = { ...base, ...saved } as QuestionState
  const fits =
    isObject(question.answer) &&
    question.answer.kind === base.answer.kind &&
    typeof question.attempts === "number" &&
    PHASES.has(question.phase) &&
    Array.isArray(question.optionOrder) &&
    Array.isArray(question.rightOrder) &&
    Array.isArray(question.bank) &&
    Array.isArray(question.tried)
  return fits ? question : base
}

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : []

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
