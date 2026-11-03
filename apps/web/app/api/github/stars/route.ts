import { SITE } from "@/lib/site"

// GET /api/github/stars: the repository's star count for the header, refreshed hourly so
// visitors never spend GitHub's unauthenticated rate limit.

export const revalidate = 3600

export async function GET() {
  const repo = new URL(SITE.repo).pathname
  const reply = await fetch(`https://api.github.com/repos${repo}`, {
    headers: { accept: "application/vnd.github+json" },
    next: { revalidate },
  }).catch(() => null)
  const stars = reply?.ok
    ? ((await reply.json()) as { stargazers_count?: number }).stargazers_count
    : undefined
  return Response.json({ stars: typeof stars === "number" ? stars : null })
}
