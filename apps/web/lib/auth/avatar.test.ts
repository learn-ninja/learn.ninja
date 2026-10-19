import sharp from "sharp"
import { beforeAll, describe, expect, it } from "vitest"

import { avatar, connectPglite, type Db } from "@workspace/db"

import { MemoryRateLimiter } from "@/lib/publish/rate-limit"

import { getActor } from "./actor"
import { createAuth, type Auth } from "./auth"
import {
  AVATAR_MAX_BYTES,
  AVATAR_SIZE,
  avatarProblem,
  processAvatar,
  readAvatar,
  removeAvatar,
  setAvatar,
  UnsupportedImageError,
} from "./avatar"

// Profile pictures: the resize, the checks an upload goes through, and what's kept and served.

let db: Db
let auth: Auth
const codes = new Map<string, string>()

beforeAll(async () => {
  db = await connectPglite()
  auth = createAuth({
    db,
    env: { NODE_ENV: "test" } as NodeJS.ProcessEnv,
    sendCode: async (email, code) => {
      codes.set(email, code)
    },
    codeLimiter: new MemoryRateLimiter(100),
  })
}, 30_000)

async function signIn(email: string): Promise<Headers> {
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: codes.get(email)! },
    asResponse: true,
  })
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
  return new Headers({ cookie })
}

/** A solid picture of the given size, in the given format. */
async function picture(
  width: number,
  height: number,
  format: "png" | "jpeg" | "tiff" = "png"
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#d02020" },
  })
    .toFormat(format)
    .toBuffer()
}

function upload(bytes: Uint8Array, type = "image/png", name = "me.png") {
  return new File([bytes as BlobPart], name, { type })
}

/** Follows the refreshed session cookie a reply sets, as the browser would. */
function follow(headers: Headers, reply: { headers?: Headers }) {
  const refreshed = reply.headers?.getSetCookie().map((c) => c.split(";")[0])
  if (refreshed?.length) headers.set("cookie", refreshed.join("; "))
}

describe("processAvatar", () => {
  it("makes a square WebP of the stored size from any picture", async () => {
    const out = await processAvatar(await picture(600, 400, "jpeg"))
    const meta = await sharp(out).metadata()
    expect(meta).toMatchObject({
      format: "webp",
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
    })
  })

  it("refuses formats the picker doesn't offer, whatever the file claims", async () => {
    await expect(processAvatar(await picture(64, 64, "tiff"))).rejects.toThrow(
      UnsupportedImageError
    )
  })
})

describe("the browser's checks", () => {
  it("name the problem, or none", () => {
    expect(avatarProblem(upload(new Uint8Array(10)))).toBeNull()
    expect(avatarProblem(upload(new Uint8Array(10), "text/plain"))).toMatch(
      /PNG, JPEG, WebP, or GIF/
    )
    expect(
      avatarProblem(upload(new Uint8Array(AVATAR_MAX_BYTES + 1)))
    ).toMatch(/over 5 MB/)
  })
})

describe("setAvatar and removeAvatar", () => {
  it("stores the picture, points the user at it, and replaces it on the next upload", async () => {
    const headers = await signIn("ada@example.com")
    const actor = (await getActor(auth, headers))!
    expect(actor.image).toBeNull()

    const first = await setAvatar(auth, db, headers, actor, upload(await picture(300, 500)))
    expect(first.status).toBe(200)
    const image = first.body.image as string
    expect(image).toMatch(/^\/avatars\/[A-Za-z0-9_-]{16}$/)
    follow(headers, first)
    expect((await getActor(auth, headers))!.image).toBe(image)

    const stored = await readAvatar(db, image.slice("/avatars/".length))
    expect(await sharp(stored!).metadata()).toMatchObject({
      format: "webp",
      width: AVATAR_SIZE,
    })

    const second = await setAvatar(
      auth,
      db,
      headers,
      actor,
      upload(await picture(100, 100, "jpeg"), "image/jpeg", "me.jpg")
    )
    expect(second.status).toBe(200)
    expect(second.body.image).not.toBe(image)
    // The old URL is gone, and only one row is kept per user.
    expect(await readAvatar(db, image.slice("/avatars/".length))).toBeNull()
    expect(await db.select({ id: avatar.id }).from(avatar)).toHaveLength(1)

    follow(headers, second)
    const removed = await removeAvatar(auth, db, headers, actor)
    expect(removed.status).toBe(200)
    follow(headers, removed)
    expect((await getActor(auth, headers))!.image).toBeNull()
    expect(await db.select({ id: avatar.id }).from(avatar)).toHaveLength(0)
  })

  it("refuses what isn't a small picture of an offered type", async () => {
    const headers = await signIn("bob@example.com")
    const actor = (await getActor(auth, headers))!
    const png = await picture(50, 50)

    expect((await setAvatar(auth, db, headers, actor, undefined)).status).toBe(400)
    expect((await setAvatar(auth, db, headers, actor, "me.png")).status).toBe(400)
    expect(
      (await setAvatar(auth, db, headers, actor, upload(new Uint8Array(0)))).status
    ).toBe(400)
    expect(
      (await setAvatar(auth, db, headers, actor, upload(png, "image/svg+xml"))).status
    ).toBe(415)
    expect(
      (
        await setAvatar(
          auth,
          db,
          headers,
          actor,
          upload(new Uint8Array(AVATAR_MAX_BYTES + 1))
        )
      ).status
    ).toBe(413)
    // Declared as PNG, but not a picture at all.
    const garbage = await setAvatar(
      auth,
      db,
      headers,
      actor,
      upload(new TextEncoder().encode("hello"))
    )
    expect(garbage.status).toBe(422)
    // A TIFF renamed to .png: the content decides.
    const tiff = await setAvatar(
      auth,
      db,
      headers,
      actor,
      upload(await picture(50, 50, "tiff"))
    )
    expect(tiff.status).toBe(415)
    expect((await getActor(auth, headers))!.image).toBeNull()
  })
})
