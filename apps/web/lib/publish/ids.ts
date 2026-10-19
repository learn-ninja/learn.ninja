import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

// Lesson ids, readable links, and edit tokens.

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"

/** A short random id, e.g. "k3x9a2mq". No hyphens, so it can follow the slug in a link. */
export function newLessonId(length = 8): string {
  const bytes = randomBytes(length)
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("")
}

/** "How compound interest works!" → "how-compound-interest-works" */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "")
  return slug || "lesson"
}

/** The path a lesson is shared at: /l/{slug}-{id}. */
export const lessonPath = (slug: string, id: string) => `/l/${slug}-${id}`

/** The id from the last part of a lesson path ("writing-a-prd-k3x9a2mq" → "k3x9a2mq"). */
export function idFromParam(param: string): string | null {
  const id = param.slice(param.lastIndexOf("-") + 1)
  return /^[0-9a-z]{6,16}$/.test(id) ? id : null
}

/** A secret that lets whoever published a lesson update it (edit token) or keep it (claim token). Only its hash is stored. */
export function newToken(): string {
  return randomBytes(24).toString("base64url")
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function tokenMatches(token: string, hash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex")
  const b = Buffer.from(hash, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}
