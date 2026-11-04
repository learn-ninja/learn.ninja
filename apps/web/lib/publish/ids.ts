import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto"

// Lesson ids, readable links, and edit tokens. The link helpers live in paths.ts (no Node there,
// so the browser can use them) and are re-exported here.

export { idFromParam, lessonPath, slugify } from "./paths"

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"

/** A short random id, e.g. "k3x9a2mq". No hyphens, so it can follow the slug in a link. */
export function newLessonId(length = 8): string {
  // randomInt rejection-samples, so every character is equally likely (a byte modulo 36 isn't).
  return Array.from(
    { length },
    () => ALPHABET[randomInt(ALPHABET.length)]
  ).join("")
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
