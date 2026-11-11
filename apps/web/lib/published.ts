import { cache } from "react"

import type { DayStreak } from "@workspace/player"
import { upgradeLesson, type Lesson } from "@workspace/spec"

import { lessonStreaks } from "./activity/server"
import { accountOf, type AccountInfo } from "./auth/account-info"
import { currentActor } from "./auth/session"
import { authorOf, likedIds } from "./explore/queries"
import { idFromParam } from "./publish/ids"
import { getDb, getLessonStore, type StoredLesson } from "./publish/store"

/**
 * A published lesson from its /l/{slug}-{id} path segment, or null once it has expired.
 * Cached per request, so the page and its metadata share one read.
 */
export const loadPublished = cache(
  async (param: string): Promise<StoredLesson | null> => {
    const id = idFromParam(param)
    const record = id ? await (await getLessonStore()).get(id) : null
    // Lessons published before spec 0.3 may still be live.
    return record
      ? { ...record, lesson: upgradeLesson(record.lesson) as Lesson }
      : null
  }
)

export interface PublishedView {
  /** The lesson, or null when there's nothing to show this visitor. */
  record: StoredLesson | null
  /** Why `record` is null: the link is dead, or the lesson was hidden after a report and the visitor isn't its owner. */
  reason: "expired" | "hidden" | null
  /** Whether the visitor is logged in, and whether they own the lesson. */
  signedIn: boolean
  isOwner: boolean
  /** In Explore and on the owner's profile: owned, public, and not hidden. */
  listed: boolean
  /** The owner's public name and picture, for the title screen; null for anonymous lessons. */
  author: { handle: string | null; name: string; image: string | null } | null
  /** Whether the logged-in visitor has liked the lesson. */
  liked: boolean
  /** The logged-in visitor's handle, which the challenges they send name. */
  viewerHandle: string | null
  /** What the header shows about the visitor; null when nobody is logged in. */
  account: AccountInfo | null
  /** The streak finishing it will light, for the streak screen; null when it won't light today. */
  streak: DayStreak | null
}

/**
 * What the lesson page shows the current visitor: the lesson with who made it, unless it's gone
 * or hidden. A hidden lesson still opens for its owner, so they can fix it or take it down.
 */
export const viewPublished = cache(
  async (param: string): Promise<PublishedView> => {
    const [record, actor] = await Promise.all([
      loadPublished(param),
      currentActor(),
    ])
    const signedIn = actor !== null
    if (!record)
      return {
        record: null,
        reason: "expired",
        signedIn,
        isOwner: false,
        listed: false,
        author: null,
        liked: false,
        viewerHandle: actor?.handle ?? null,
        account: accountOf(actor),
        streak: null,
      }
    const isOwner = actor !== null && record.ownerId === actor.userId
    if (record.hidden && !isOwner)
      return {
        record: null,
        reason: "hidden",
        signedIn,
        isOwner,
        listed: false,
        author: null,
        liked: false,
        viewerHandle: actor?.handle ?? null,
        account: accountOf(actor),
        streak: null,
      }
    const db = await getDb()
    const [author, liked, streaks] = await Promise.all([
      record.ownerId ? authorOf(db, record.ownerId) : null,
      actor ? likedIds(db, actor.userId, [record.id]) : new Set<string>(),
      actor ? lessonStreaks(actor.userId) : null,
    ])
    return {
      record,
      reason: null,
      signedIn,
      isOwner,
      listed:
        record.ownerId !== null &&
        record.visibility === "public" &&
        !record.hidden,
      author,
      liked: liked.has(record.id),
      viewerHandle: actor?.handle ?? null,
      account: accountOf(actor),
      streak: streaks?.coming ?? null,
    }
  }
)
