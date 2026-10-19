// Lesson links, with nothing from Node in them, so client components can build them too. The
// server-side helpers (ids, tokens) are in ids.ts, which re-exports these.

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
