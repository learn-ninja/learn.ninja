import type { FeedPage, LessonRowData, Viewer } from "./feed"

// Explore when it comes back into view (after a lesson, a profile, or the web): the first page is
// asked for again and merged into what's on screen, so a lesson just finished shows Done and new
// counts and likes show, without collapsing the pages already scrolled through or the scroll.

export interface FeedState {
  lessons: LessonRowData[]
  viewer?: Viewer
  next: string | null
}

export function mergeFirstPage(feed: FeedState, page: FeedPage): FeedState {
  if (!feed.lessons.length) return page
  const fresh = new Map(page.lessons.map((l) => [l.id, l]))
  const shown = new Set(feed.lessons.map((l) => l.id))
  // Lessons published since: newer than the first row on screen.
  const newest = feed.lessons[0]!.createdAt
  const added = page.lessons.filter(
    (l) => !shown.has(l.id) && l.createdAt >= newest
  )
  const lessons = [...added, ...feed.lessons.map((l) => fresh.get(l.id) ?? l)]
  // What the viewer liked: the page's word for its rows, the earlier pages' for the rest.
  const liked = new Set(feed.viewer?.liked ?? [])
  for (const l of page.lessons) liked.delete(l.id)
  for (const id of page.viewer.liked) liked.add(id)
  return {
    lessons,
    next: feed.next,
    viewer: {
      signedIn: page.viewer.signedIn,
      liked: [...liked],
      completed: { ...feed.viewer?.completed, ...page.viewer.completed },
    },
  }
}
