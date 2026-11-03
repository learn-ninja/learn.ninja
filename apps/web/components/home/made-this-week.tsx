import { ButtonLink } from "@/components/site/button-link"
import { recentLessons } from "@/lib/explore/cache"

import { LessonCards } from "./lesson-cards"
import { SectionDivider } from "./section-divider"

// Proof, from the product itself: the newest lessons people kept and shared on Explore, as the
// link-preview cards their links unfurl into (the same card lib/og.tsx draws), scattered in two
// staggered rows that run past the page's column and fade at the window's edges. Drawn as HTML, not
// the card images, so the words are text and the page doesn't load ten PNGs. The heading keeps
// the column; only the cards leave it.

/** How many cards: two rows of five, so the rows are wider than any window the page is read in. */
const COUNT = 10

export async function MadeThisWeek() {
  const lessons = await recentLessons(COUNT)
  if (lessons.length < 4) return null
  // The section brings its own divider, so there's no stray line when it's left out.
  return (
    <>
      <SectionDivider />
      <section
        aria-labelledby="made-heading"
        className="flex w-full flex-col gap-10 py-20 sm:py-28"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 sm:px-6">
          <h2
            id="made-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Made this week
          </h2>
          <ButtonLink href="/explore" variant="outline" size="sm">
            Explore all
          </ButtonLink>
        </div>
        <LessonCards lessons={lessons} />
      </section>
    </>
  )
}
