import { AVATAR_CONTENT_TYPE, readAvatar } from "@/lib/auth/avatar"
import { getDb, StorageNotConfiguredError } from "@/lib/publish/store"

// GET /avatars/{id}: a profile picture. Every upload gets a new id, so a found picture never changes
// and can be cached for a year; browsers and the CDN then ask for it once.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(id)) return new Response(null, { status: 404 })
  let data: Uint8Array | null
  try {
    data = await readAvatar(await getDb(), id)
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      return new Response(null, { status: 503 })
    }
    throw e
  }
  if (!data) {
    return new Response(null, {
      status: 404,
      headers: { "cache-control": "public, max-age=60" },
    })
  }
  return new Response(data as BodyInit, {
    headers: {
      "content-type": AVATAR_CONTENT_TYPE,
      "content-length": String(data.byteLength),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  })
}
