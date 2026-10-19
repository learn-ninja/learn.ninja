// The rules for a profile picture, checked in the browser before an upload and on the server after.
// No Node here, so the settings page can import them.

/** The largest file the browser may send, the usual limit for an avatar. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
/** What the picker offers and the server decodes; everything is re-encoded, so no upload is served as is. */
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
/** The stored picture's width and height. */
export const AVATAR_SIZE = 256

export const AVATAR_TOO_LARGE = "That picture is over 5 MB. Choose a smaller one."
export const AVATAR_WRONG_TYPE = "Choose a PNG, JPEG, WebP, or GIF picture."

/** Why `file` can't be a profile picture, or null when it can. The server answers the same messages. */
export function avatarProblem(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return AVATAR_WRONG_TYPE
  if (file.size > AVATAR_MAX_BYTES) return AVATAR_TOO_LARGE
  return null
}
