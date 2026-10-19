import { randomBytes } from "node:crypto"

import { eq } from "drizzle-orm"
import sharp from "sharp"

import { avatar, type Db } from "@workspace/db"

import type { Reply } from "@/lib/publish/handlers"

import type { Actor } from "./actor"
import type { Auth } from "./auth"
import {
  AVATAR_MAX_BYTES,
  AVATAR_SIZE,
  AVATAR_TOO_LARGE,
  AVATAR_TYPES,
  AVATAR_WRONG_TYPE,
} from "./avatar-rules"

export * from "./avatar-rules"

// Profile pictures: an upload from the settings page becomes one small square WebP, kept in Postgres
// and served at /avatars/{id}. The picture's URL lands in user.image through Better Auth, so the
// session cookie's copy of the user refreshes too.

/** The largest picture sharp will decode, to keep a tiny file that unpacks to a huge one from exhausting memory. */
const MAX_INPUT_PIXELS = 50_000_000

export const AVATAR_CONTENT_TYPE = "image/webp"

export function avatarUrl(id: string): string {
  return `/avatars/${id}`
}

/** Decodes an upload and makes the square WebP that's kept. Throws for anything that isn't one of AVATAR_TYPES. */
export async function processAvatar(input: Uint8Array): Promise<Uint8Array> {
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
  const { format } = await image.metadata()
  if (!format || !AVATAR_TYPES.includes(`image/${format}`)) {
    throw new UnsupportedImageError()
  }
  // rotate() applies the EXIF orientation phones record; metadata isn't copied to the output.
  return image
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer()
}

export class UnsupportedImageError extends Error {
  constructor() {
    super(AVATAR_WRONG_TYPE)
  }
}

const TOO_LARGE: Reply = {
  status: 413,
  body: { ok: false, error: "file_too_large", message: AVATAR_TOO_LARGE },
}
const WRONG_TYPE: Reply = {
  status: 415,
  body: { ok: false, error: "unsupported_type", message: AVATAR_WRONG_TYPE },
}

/**
 * POST /api/account/avatar with multipart form data, field "file": checks the size and type the
 * browser declared, decodes the picture to be sure, stores the resized copy under a new id, and
 * points user.image at it. The previous picture's row goes.
 */
export async function setAvatar(
  auth: Auth,
  db: Db,
  headers: Headers,
  actor: Actor,
  file: unknown
): Promise<Reply> {
  if (!(file instanceof File) || file.size === 0) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "no_file",
        message: "Send the picture as the form field \"file\".",
      },
    }
  }
  if (file.size > AVATAR_MAX_BYTES) return TOO_LARGE
  if (!AVATAR_TYPES.includes(file.type)) return WRONG_TYPE
  let data: Uint8Array
  try {
    data = await processAvatar(new Uint8Array(await file.arrayBuffer()))
  } catch (e) {
    if (e instanceof UnsupportedImageError) return WRONG_TYPE
    // sharp names a truncated or corrupt file in its message; to the user it's the same thing.
    return {
      status: 422,
      body: {
        ok: false,
        error: "unreadable_image",
        message: "That file couldn't be read as a picture. Try another one.",
      },
    }
  }
  const id = randomBytes(12).toString("base64url")
  const url = avatarUrl(id)
  // Two statements, not a transaction: Neon over HTTP has none. The unique index on user_id
  // keeps a second upload racing the first from leaving two rows.
  await db.delete(avatar).where(eq(avatar.userId, actor.userId))
  await db.insert(avatar).values({ id, userId: actor.userId, data })
  const { headers: refreshed } = await auth.api.updateUser({
    headers,
    body: { image: url },
    returnHeaders: true,
  })
  return { status: 200, body: { ok: true, image: url }, headers: refreshed }
}

/** DELETE /api/account/avatar: back to no picture (GitHub users lose GitHub's too, by choice). */
export async function removeAvatar(
  auth: Auth,
  db: Db,
  headers: Headers,
  actor: Actor
): Promise<Reply> {
  await db.delete(avatar).where(eq(avatar.userId, actor.userId))
  const { headers: refreshed } = await auth.api.updateUser({
    headers,
    body: { image: null },
    returnHeaders: true,
  })
  return { status: 200, body: { ok: true, image: null }, headers: refreshed }
}

/** The stored WebP behind /avatars/{id}, or null. */
export async function readAvatar(
  db: Db,
  id: string
): Promise<Uint8Array | null> {
  const [row] = await db
    .select({ data: avatar.data })
    .from(avatar)
    .where(eq(avatar.id, id))
  return row?.data ?? null
}
