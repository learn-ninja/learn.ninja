import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { UserAvatar } from "@/components/account/user-avatar"
import { ActivityGrid } from "@/components/explore/activity-grid"
import { LessonFeed } from "@/components/explore/lesson-feed"
import { ProfileTabs } from "@/components/explore/profile-tabs"
import { buildGrid, localDay } from "@/lib/activity/activity"
import { viewerTimeZone } from "@/lib/activity/server"
import { normalizeHandle } from "@workspace/player-core/handle-rules"
import { currentActor } from "@/lib/auth/session"
import { cachedProfile } from "@/lib/explore/cache"
import {
  activityDays,
  completedAt,
  lessonsInProgress,
  lessonsLikedBy,
  lessonsOwnedBy,
  likedIds,
} from "@/lib/explore/queries"
import { getDb } from "@/lib/publish/store"
import { SITE } from "@/lib/site"

// A person's public lessons at /u/{handle}, with views and likes. Hidden and unlisted lessons
// aren't here, nor is anything from an anonymous publish. On your own profile the tab is My
// lessons and shows every lesson you own instead, with a Private or Hidden badge on the ones visitors don't
// see, and In progress follows it: the lessons you started and haven't finished, with how far you
// got, most recently played first. The Likes tab lists the listed lessons they liked, plus, on your own profile, liked lessons
// that have since gone unlisted. Above the tabs, in one box with them, a year of their learning
// as a grid of days with their streaks (lib/activity/activity.ts), ending on the viewer's today. The
// frame around the page is the (feed) layout's; loading.tsx beside this file stands in until the
// profile arrives.

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
  const [actor, profile, tz] = await Promise.all([
    currentActor(),
    handle ? cachedProfile(handle) : null,
    viewerTimeZone(),
  ])
  if (!profile) notFound()
  const own = actor?.userId === profile.id
  const db = await getDb()
  const [owned, started, likedLessons, days] = await Promise.all([
    own ? lessonsOwnedBy(db, profile.id) : null,
    own ? lessonsInProgress(db, profile.id) : null,
    lessonsLikedBy(db, profile.id, { listedOnly: !own }),
    activityDays(db, profile.id),
  ])
  const grid = buildGrid(days, localDay(new Date(), tz))
  const lessons = owned ?? profile.lessons
  const ids = [...lessons, ...(started ?? []), ...likedLessons].map((l) => l.id)
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
    // Your own progress, on every tab: a lesson you made or liked may be one you're partway through.
    progress: started
      ? new Map(started.map((l) => [l.id, l.progress]))
      : undefined,
    userId: actor?.userId,
  }
  const joined = new Date(profile.joinedAt).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  })
  return (
    // The handle line sits closer to the box than main's gap-8.
    <div className="flex flex-col gap-5">
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
        activity={<ActivityGrid grid={grid} />}
        lessons={{
          label: own ? "My lessons" : "Lessons",
          count: lessons.length,
          panel: lessons.length ? (
            <LessonFeed lessons={lessons} viewer={viewer} />
          ) : (
            <Empty>
              {own
                ? "No lessons yet. Ask your agent for one; logged in, it's saved here."
                : "No listed lessons yet."}
            </Empty>
          ),
        }}
        inProgress={
          started
            ? {
                count: started.length,
                panel: started.length ? (
                  <LessonFeed lessons={started} viewer={viewer} />
                ) : (
                  <Empty>
                    Lessons you start show up here until you finish them.
                  </Empty>
                ),
              }
            : undefined
        }
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
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
