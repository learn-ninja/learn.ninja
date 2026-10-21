import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { HeartIcon, PlayIcon } from "lucide-react"

import { UserAvatar } from "@/components/account/user-avatar"
import { LessonFeed } from "@/components/explore/lesson-feed"
import { normalizeHandle } from "@/lib/auth/handle-rules"
import { currentActor } from "@/lib/auth/session"
import { compact } from "@/lib/explore/browser"
import { cachedProfile } from "@/lib/explore/cache"
import { completedAt, likedIds } from "@/lib/explore/queries"
import { getDb } from "@/lib/publish/store"
import { SITE } from "@/lib/site"

// A person's public lessons at /u/{handle}, with plays and likes. Hidden and unlisted lessons
// aren't here, nor is anything from an anonymous publish. The frame around the page is the (feed)
// layout's; loading.tsx beside this file stands in until the profile arrives.

type Props = { params: Promise<{ handle: string }> }

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = normalizeHandle((await params).handle)
  const profile = handle ? await cachedProfile(handle) : null
  if (!profile) return { title: "Profile" }
  const n = profile.lessons.length
  return {
    title: profile.name.trim()
      ? `${profile.name} (@${profile.handle})`
      : `@${profile.handle}`,
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
  const ids = profile.lessons.map((l) => l.id)
  const [liked, completed] = actor
    ? await getDb().then((db) =>
        Promise.all([
          likedIds(db, actor.userId, ids),
          completedAt(db, actor.userId, ids),
        ])
      )
    : [new Set<string>(), new Map<string, number>()]
  const own = actor?.userId === profile.id
  // Email-code accounts have no name until GitHub or a later setting gives them one.
  const name = profile.name.trim()
  const joined = new Date(profile.joinedAt).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  })
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4 sm:gap-5">
          <UserAvatar
            image={profile.image}
            handle={profile.handle}
            size="profile"
          />
          <h1 className="min-w-0 text-3xl font-semibold tracking-tight sm:text-4xl">
            {name || <bdi dir="ltr">@{profile.handle}</bdi>}
          </h1>
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-muted-foreground">
          {name ? <bdi dir="ltr">@{profile.handle}</bdi> : null}
          <span>
            {profile.lessons.length}{" "}
            {profile.lessons.length === 1 ? "lesson" : "lessons"}
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <PlayIcon className="size-4" aria-hidden="true" />
            {compact(profile.plays)}
            <span className="sr-only">plays</span>
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <HeartIcon className="size-4" aria-hidden="true" />
            {compact(profile.likes)}
            <span className="sr-only">likes</span>
          </span>
          <span>Joined {joined}</span>
        </p>
        {profile.bio ? (
          <p className="max-w-xl text-base text-pretty">{profile.bio}</p>
        ) : null}
      </div>
      {profile.lessons.length ? (
        <LessonFeed
          lessons={profile.lessons}
          viewer={{
            signedIn: actor !== null,
            liked,
            completed,
            userId: actor?.userId,
          }}
          showAuthor={false}
        />
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {own
            ? "None of your lessons are listed yet. Switch one on in your settings."
            : "No listed lessons yet."}
        </p>
      )}
    </>
  )
}
