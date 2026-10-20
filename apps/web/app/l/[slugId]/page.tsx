import type { Metadata } from "next"

import { PlayBeacon } from "@/components/explore/play-beacon"
import { LessonView } from "@/components/lesson-view"
import { LessonExpired } from "@/components/site/lesson-expired"
import { shareMetadata } from "@/lib/metadata"
import { OG_SIZE } from "@/lib/og"
import { viewPublished } from "@/lib/published"

// A published lesson, at /l/{slug}-{id}. Anonymous lessons expire 7 days after they're published;
// lessons saved to an account stay, and listed ones are credited to their maker and indexed.

type Props = {
  params: Promise<{ slugId: string }>
  searchParams: Promise<{ ui?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slugId } = await params
  const { record, listed, author } = await viewPublished(slugId)
  const share = shareMetadata(`/l/${slugId}`, record?.lesson.language)
  return {
    ...(record
      ? {
          title: record.lesson.title,
          description: record.lesson.summary,
          ...(author?.handle ? { authors: [{ name: `@${author.handle}`, url: `/u/${author.handle}` }] } : {}),
        }
      : {
          title: "Lesson unavailable",
          description: EXPIRED_DESCRIPTION,
        }),
    ...share,
    openGraph: {
      ...share.openGraph,
      images: {
        url: `/l/${slugId}/card`,
        ...OG_SIZE,
        type: "image/png",
        alt: record?.lesson.title ?? "This lesson has expired",
      },
    },
    // Anyone can publish a lesson, so it isn't credited to the site's maker.
    twitter: { card: "summary_large_image" },
    // Only lessons their makers chose to list are indexed; link-only ones stay out of search.
    robots: { index: listed },
  }
}

const EXPIRED_DESCRIPTION =
  "Lessons expire 7 days after they're published. Ask whoever shared it for a new link."

export default async function PublishedLessonPage({
  params,
  searchParams,
}: Props) {
  const { slugId } = await params
  const view = await viewPublished(slugId)
  if (!view.record) return <LessonExpired reason={view.reason ?? "expired"} />
  const { record, author, isOwner, listed } = view
  const { ui } = await searchParams
  return (
    <div className="h-svh">
      <LessonView
        lesson={record.lesson}
        prepared={record.prepared}
        uiLanguage={ui}
        expiresAt={record.expiresAt ?? undefined}
        progressKey={`l/${slugId}`}
        author={
          author?.handle
            ? { handle: author.handle, href: `/u/${author.handle}`, image: author.image }
            : undefined
        }
        lessonId={record.id}
        canReport={listed && !isOwner}
        owner={
          isOwner
            ? { visibility: record.visibility, hidden: record.hidden }
            : undefined
        }
      />
      <PlayBeacon id={record.id} />
    </div>
  )
}
