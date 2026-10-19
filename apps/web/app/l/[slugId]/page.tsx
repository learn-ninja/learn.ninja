import type { Metadata } from "next"

import { LessonView } from "@/components/lesson-view"
import { LessonExpired } from "@/components/site/lesson-expired"
import { shareMetadata } from "@/lib/metadata"
import { OG_SIZE } from "@/lib/og"
import { loadPublished } from "@/lib/published"

// A published lesson, at /l/{slug}-{id}. Lessons expire 7 days after they're published.

type Props = {
  params: Promise<{ slugId: string }>
  searchParams: Promise<{ ui?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slugId } = await params
  const record = await loadPublished(slugId)
  const share = shareMetadata(`/l/${slugId}`, record?.lesson.language)
  return {
    ...(record
      ? {
          title: record.lesson.title,
          description: record.lesson.summary,
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
    robots: { index: false },
  }
}

const EXPIRED_DESCRIPTION =
  "Lessons expire 7 days after they're published. Ask whoever shared it for a new link."

export default async function PublishedLessonPage({
  params,
  searchParams,
}: Props) {
  const { slugId } = await params
  const record = await loadPublished(slugId)
  if (!record) return <LessonExpired />
  const { ui } = await searchParams
  return (
    <div className="h-svh">
      <LessonView
        lesson={record.lesson}
        prepared={record.prepared}
        uiLanguage={ui}
        expiresAt={record.expiresAt ?? undefined}
        progressKey={`l/${slugId}`}
      />
    </div>
  )
}
