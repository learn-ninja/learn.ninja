import type { Metadata } from "next"

import { withCharts } from "@workspace/player/charts"

import { ViewBeacon } from "@/components/explore/view-beacon"
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
          ...(author?.handle
            ? {
                authors: [
                  { name: `@${author.handle}`, url: `/u/${author.handle}` },
                ],
              }
            : {}),
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
  const { record, isOwner, listed, signedIn, author, liked } = view
  const { ui } = await searchParams
  return (
    <div className="h-svh">
      <LessonView
        lesson={record.lesson}
        prepared={withCharts(record.lesson, record.prepared)}
        uiLanguage={ui}
        expiresAt={record.expiresAt ?? undefined}
        progressKey={`l/${slugId}`}
        lessonId={record.id}
        canReport={listed && !isOwner}
        recordCompletion={signedIn}
        likes={{ likes: record.likes, liked, signedIn }}
        loginHref={`/login?callback=${encodeURIComponent(`/l/${slugId}?like=1`)}`}
        owner={
          isOwner
            ? {
                visibility: record.visibility,
                hidden: record.hidden,
                handle: author?.handle ?? null,
              }
            : undefined
        }
      />
      <ViewBeacon id={record.id} />
    </div>
  )
}
