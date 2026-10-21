import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { UserAvatar } from "@/components/account/user-avatar"
import { YourLessons } from "@/components/account/your-lessons"
import { LessonFeed } from "@/components/explore/lesson-feed"
import { ProfileTabs } from "@/components/explore/profile-tabs"
import { normalizeHandle } from "@/lib/auth/handle-rules"
import { currentActor } from "@/lib/auth/session"
import { cachedProfile } from "@/lib/explore/cache"
import {
  completedAt,
  lessonsLikedBy,
  lessonsOwnedBy,
  likedIds,
} from "@/lib/explore/queries"
import { getDb } from "@/lib/publish/store"
import { SITE } from "@/lib/site"

// A person's public lessons at /u/{handle}, with views and likes. Hidden and unlisted lessons
// aren't here, nor is anything from an anonymous publish. On your own profile the Lessons tab adds
// every lesson you own, each with its listed switch. The Likes tab lists the listed lessons they
// liked, plus, on your own profile, liked lessons that have since gone unlisted. The frame around the page is the (feed)
// layout's; loading.tsx beside this file stands in until the profile arrives.

type Props = { params: Promise<{ handle: string }> }

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = normalizeHandle((await params).handle)
  const profile = handle ? await cachedProfile(handle) : null
  if (!profile) return { title: "Profile" }
  const n = profile.lessons.length
  return {
    title: profile.handle,
    description: `${n} ${n === 1 ? "lesson" : "lessons"} on ${SITE.name}.`,
    alternates: { canonical: `/u/${profile.handle}` },
  }
}

export default async function ProfilePage({ params }: Props) {
  const handle = normalizeHandle((await params).handle)
  const [actor, profile] = await Promise.all([
    currentActor(),
    handle ? cachedProfile(handle) : null,
  ])
  if (!profile) notFound()
  const own = actor?.userId === profile.id
  const db = await getDb()
  const [owned, likedLessons] = await Promise.all([
    own ? lessonsOwnedBy(db, profile.id) : null,
    lessonsLikedBy(db, profile.id, { listedOnly: !own }),
  ])
  const ids = [...profile.lessons, ...likedLessons].map((l) => l.id)
  const [liked, completed] = actor
    ? await Promise.all([
        likedIds(db, actor!.userId, ids),
        completedAt(db, actor!.userId, ids),
      ])
    : [new Set<string>(), new Map<string, number>()]
  const viewer = {
    signedIn: actor !== null,
    liked,
    completed,
    userId: actor?.userId,
  }
  const joined = new Date(profile.joinedAt).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  })
  return (
    <>
      {/* A profile goes by its handle alone: no display name, no @. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <h1 className="flex min-w-0 items-center gap-2 font-medium text-foreground">
            <UserAvatar
              image={profile.image}
              handle={profile.handle}
              size="profile"
            />
            <bdi dir="ltr" className="min-w-0 truncate">
              {profile.handle}
            </bdi>
          </h1>
          <span aria-hidden="true">·</span>
          <span>Joined {joined}</span>
        </div>
        {profile.bio ? (
          <p className="max-w-xl text-base text-pretty">{profile.bio}</p>
        ) : null}
      </div>
      <ProfileTabs
        lessons={{
          count: profile.lessons.length,
          panel: (
            <>
              {profile.lessons.length ? (
                <LessonFeed lessons={profile.lessons} viewer={viewer} />
              ) : (
                <Empty>
                  {own
                    ? "None of your lessons are listed yet. Switch one on below."
                    : "No listed lessons yet."}
                </Empty>
              )}
              {owned ? (
                <section
                  id="lessons"
                  className="flex scroll-mt-20 flex-col gap-4"
                >
                  <h2 className="text-xl font-semibold tracking-tight">
                    Your lessons
                  </h2>
                  <YourLessons initial={owned} />
                </section>
              ) : null}
            </>
          ),
        }}
        likes={{
          count: likedLessons.length,
          panel: likedLessons.length ? (
            <LessonFeed lessons={likedLessons} viewer={viewer} />
          ) : (
            <Empty>
              {own ? "Lessons you like show up here." : "No liked lessons yet."}
            </Empty>
          ),
        }}
      />
    </>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
