import { getAuth } from "@/lib/auth/auth"
import {
  AVATAR_MAX_BYTES,
  AVATAR_TOO_LARGE,
  removeAvatar,
  setAvatar,
} from "@/lib/auth/avatar"
import { revalidateExplore } from "@/lib/explore/cache"
import { getRateLimiter } from "@/lib/publish/rate-limit"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"
import { getDb } from "@/lib/publish/store"

// POST /api/account/avatar: multipart form data with the picture in "file" (PNG, JPEG, WebP, or
// GIF, up to 5 MB). Answers { "ok": true, "image": "/avatars/…" }.
// DELETE /api/account/avatar: removes the picture.

export async function POST(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    // The declared length refuses an oversized upload before its body is read; the handler checks
    // the file's real size after.
    const declared = Number(req.headers.get("content-length"))
    if (declared > AVATAR_MAX_BYTES + 4096) {
      return {
        status: 413,
        body: {
          ok: false,
          error: "file_too_large",
          message: AVATAR_TOO_LARGE,
        },
      }
    }
    if (!(await getRateLimiter("avatar").allow(actor.userId))) {
      return {
        status: 429,
        body: {
          ok: false,
          error: "rate_limited",
          message: "Too many uploads. Try again later.",
        },
      }
    }
    const form = await req.formData().catch(() => null)
    const reply = await setAvatar(
      await getAuth(),
      await getDb(),
      req.headers,
      actor,
      form?.get("file")
    )
    if (reply.status === 200) revalidateExplore()
    return reply
  })
}

export async function DELETE(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    const reply = await removeAvatar(
      await getAuth(),
      await getDb(),
      req.headers,
      actor
    )
    revalidateExplore()
    return reply
  })
}
