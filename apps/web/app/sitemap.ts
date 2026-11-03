import type { MetadataRoute } from "next"

import { docsPages } from "@/lib/docs-nav"
import { sitemapLessons } from "@/lib/explore/queries"
import { LESSON_SLUGS } from "@/lib/lessons"
import { lessonPath } from "@/lib/publish/paths"
import { getDb, StorageNotConfiguredError } from "@/lib/publish/store"
import { SITE } from "@/lib/site"

// The site's pages, every docs page, and what people chose to share: listed lessons and the
// profiles that publish them, so search engines find them without crawling Explore. Lessons
// saved to an account never expire, so a listed URL stays good until its maker unpublishes it.

/** Read again every hour, so new lessons reach the sitemap without a deploy. */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/explore`, changeFrequency: "daily", priority: 0.8 },
    ...docsPages().map((page) => ({
      url: `${SITE.url}${page.url}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...LESSON_SLUGS.map((slug) => ({
      url: `${SITE.url}/lessons/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    { url: `${SITE.url}/mission`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/privacy`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE.url}/terms`, changeFrequency: "yearly", priority: 0.1 },
  ]
  const lessons = await listedLessons()
  const profiles = new Map<string, number>()
  for (const l of lessons) {
    if (!l.handle) continue
    profiles.set(l.handle, Math.max(profiles.get(l.handle) ?? 0, l.updatedAt))
  }
  return [
    ...pages,
    ...lessons.map((l) => ({
      url: `${SITE.url}${lessonPath(l.slug, l.id)}`,
      lastModified: new Date(l.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...[...profiles].map(([handle, updatedAt]) => ({
      url: `${SITE.url}/u/${handle}`,
      lastModified: new Date(updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ]
}

/** The listed lessons, or none when there's no database to read (a build without one). */
async function listedLessons() {
  try {
    return await sitemapLessons(await getDb())
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) return []
    throw e
  }
}
