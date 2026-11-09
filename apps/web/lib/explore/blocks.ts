import { and, eq } from "drizzle-orm"

import { block, user, type Db } from "@workspace/db"

import type { Reply } from "@/lib/publish/handlers"

import { blockedPeople } from "./queries"

// Blocking someone, for guideline 1.2 of the App Store and the web alike: the blocked person's
// lessons leave the blocker's Explore and the Likes tabs they read, and the blocked person's
// profile shows them nothing (listLessons, lessonsLikedBy, profileFeed). The blocked person isn't
// told. GET /api/blocks lists them for Settings, POST /api/blocks { userId } blocks, DELETE
// /api/blocks/{userId} unblocks. Every route needs a signed-in user; they call these, which are
// independent of Next.js so they're tested directly.

const NO_USER: Reply = {
  status: 404,
  body: { ok: false, error: "not_found", message: "Nobody has this account." },
}

/** GET /api/blocks: everyone the user blocked, most recently first. */
export async function listBlocks(userId: string, db: Db): Promise<Reply> {
  return {
    status: 200,
    body: { ok: true, blocked: await blockedPeople(db, userId) },
  }
}

/** POST /api/blocks { userId }: blocks them. Blocking someone twice is fine; yourself isn't. */
export async function blockUser(
  req: { userId: string; target: unknown },
  db: Db,
  now = Date.now()
): Promise<Reply> {
  const target = typeof req.target === "string" ? req.target : ""
  if (!target)
    return {
      status: 400,
      body: {
        ok: false,
        error: "bad_request",
        message: "Say who to block: { userId }.",
      },
    }
  if (target === req.userId)
    return {
      status: 400,
      body: {
        ok: false,
        error: "bad_request",
        message: "You can't block yourself.",
      },
    }
  const [found] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, target))
  if (!found) return NO_USER
  await db
    .insert(block)
    .values({
      blockerId: req.userId,
      blockedId: found.id,
      createdAt: new Date(now),
    })
    .onConflictDoNothing()
  return { status: 200, body: { ok: true, userId: found.id, blocked: true } }
}

/** DELETE /api/blocks/{userId}: unblocks them. Unblocking someone who isn't blocked is fine too. */
export async function unblockUser(
  req: { userId: string; target: string },
  db: Db
): Promise<Reply> {
  await db
    .delete(block)
    .where(
      and(eq(block.blockerId, req.userId), eq(block.blockedId, req.target))
    )
  return { status: 200, body: { ok: true, userId: req.target, blocked: false } }
}
