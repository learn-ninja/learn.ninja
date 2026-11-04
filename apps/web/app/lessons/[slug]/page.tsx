import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { LessonView } from "@/components/lesson-view"
import { JsonLd } from "@/components/site/json-ld"
import { preparedBundled } from "@/lib/bundled-lessons"
import { lessonJsonLd } from "@/lib/json-ld"
import { getLesson, LESSON_SLUGS } from "@/lib/lessons"
import { shareMetadata } from "@/lib/metadata"

// Prerendered at build time. Nothing here reads the request, so the Tailwind compile in
// prepareLesson() runs once per lesson, not per visit.
type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return LESSON_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const lesson = getLesson(slug)
  return lesson
    ? {
        title: lesson.title,
        description: lesson.summary,
        ...shareMetadata(`/lessons/${slug}`, lesson.language),
      }
    : {}
}

export default async function LessonPage({ params }: Props) {
  const { slug } = await params
  const bundled = await preparedBundled(slug)
  if (!bundled) notFound()
  const { lesson, prepared } = bundled
  return (
    <div className="h-svh">
      <JsonLd data={lessonJsonLd({ lesson, path: `/lessons/${slug}` })} />
      <LessonView
        lesson={lesson}
        prepared={prepared}
        progressKey={`lessons/${slug}`}
      />
    </div>
  )
}
