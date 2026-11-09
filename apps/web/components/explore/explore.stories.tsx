import type { Meta, StoryObj } from "@storybook/react-vite"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import * as React from "react"

import { Button } from "@workspace/ui/components/button"

import type { ExploreApi } from "@/lib/explore/browser"
import type { LessonSummary } from "@/lib/explore/queries"

import { buildGrid } from "@/lib/activity/activity"
import { greetingFor } from "@/lib/explore/greeting"

import { ActivityGrid } from "./activity-grid"
import { ExploreGreeting, ExploreGreetingSkeleton } from "./explore-greeting"
import { FeedSkeleton } from "./feed-skeleton"
import { LessonFeed } from "./lesson-feed"
import { LessonMenuView } from "./lesson-menu"
import { LessonRow } from "./lesson-row"
import { LikeButton } from "./like-button"
import { ProfileTabs } from "./profile-tabs"
import { BlockedPeople } from "@/components/account/blocked-people"

import { BlockDialog } from "./block-dialog"
import { ReportDialog } from "./report-dialog"

// Explore's rows and controls with a fake server: likes go through, a report with "fail" in it
// fails, listing a lesson whose title has "fail" in it is refused, and so is renaming one to a
// title with "fail" in it.

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms))

const fakeApi: ExploreApi = {
  async like() {
    await wait()
    return { likes: 13 }
  },
  async unlike() {
    await wait()
    return { likes: 12 }
  },
  async report(_id, reason) {
    await wait()
    return reason.includes("fail")
      ? { error: "Too many reports from here recently. Try again later." }
      : {}
  },
  async setVisibility(id) {
    await wait()
    return id.includes("fail")
      ? { error: "Only the lesson's owner can change who sees it." }
      : {}
  },
  async rename(_id, title) {
    await wait()
    return title.includes("fail")
      ? { error: "Give the lesson a title of up to 60 characters." }
      : { title }
  },
  async remove() {
    await wait()
    return {}
  },
  async block(userId) {
    await wait()
    return userId.includes("fail") ? { error: "Nobody has this account." } : {}
  },
  async unblock() {
    await wait()
    return {}
  },
}

const DAY = 864e5
/** A picture for one author, inline so the story works offline; the others fall back to a letter. */
const PORTRAIT =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#6d5dfc"/><circle cx="32" cy="26" r="12" fill="#fff"/><path d="M8 64c2-16 12-24 24-24s22 8 24 24z" fill="#fff"/></svg>'
  )
const summary = (over: Partial<LessonSummary> = {}): LessonSummary => ({
  id: "k3x9a2mq",
  slug: "how-compound-interest-works",
  title: "How compound interest works",
  summary:
    "Why money grows faster the longer you leave it, and how to estimate it without a calculator.",
  subject: "money",
  tags: ["Compound interest", "Investing", "Rule of 72"],
  level: "beginner",
  minutes: 6,
  language: "en",
  author: { id: "ada", handle: "ada", name: "Ada Lovelace", image: PORTRAIT },
  views: 1284,
  likes: 37,
  origin: "claude-code_2-1-304_agent",
  visibility: "public",
  hidden: false,
  createdAt: Date.now() - 2 * DAY,
  expiresAt: null,
  ...over,
})

const LESSONS: LessonSummary[] = [
  summary(),
  summary({
    id: "p7qw2z1x",
    slug: "writing-a-prd",
    title: "Writing a PRD that engineers actually read",
    summary: "The five sections that matter and the ones to leave out.",
    subject: "business",
    tags: ["PRD", "Product management"],
    level: "intermediate",
    minutes: 10,
    author: {
      id: "bob-builds",
      handle: "bob-builds",
      name: "Bob",
      image: null,
    },
    views: 412,
    likes: 9,
    origin: "cursor",
  }),
  summary({
    id: "a1b2c3d4",
    slug: "saludos-en-espanol",
    title: "Saludos básicos en español",
    summary: "Hola, buenos días y cómo responder cuando te preguntan qué tal.",
    subject: "languages",
    tags: ["Saludos", "Conversación"],
    level: "beginner",
    minutes: 4,
    language: "es",
    author: { id: "maria", handle: "maria", name: "María", image: null },
    views: 88,
    likes: 2,
    origin: "claude-ai",
  }),
  summary({
    id: "z9y8x7w6",
    slug: "arabic-greetings",
    title: "التحيات الأساسية بالعربية",
    summary: "كيف تقول مرحباً وكيف ترد عندما يسألك أحدهم عن حالك.",
    subject: "languages",
    tags: ["التحيات", "محادثة"],
    level: "beginner",
    minutes: 5,
    language: "ar",
    author: { id: "noor", handle: "noor", name: "Noor", image: null },
    views: 40,
    likes: 5,
    origin: "codex",
  }),
  summary({
    id: "n0h4ndl3",
    slug: "bronze-age-collapse",
    title: "Why the Bronze Age collapsed",
    summary:
      "Drought, earthquakes, and the Sea Peoples: weighing the usual suspects.",
    subject: "history",
    tags: ["Bronze Age"],
    level: "advanced",
    minutes: 14,
    author: {
      id: "nohandle",
      handle: null,
      name: "Someone without a handle",
      image: null,
    },
    views: 0,
    likes: 0,
    origin: "openai-mcp",
  }),
  summary({
    id: "bignums1",
    slug: "map-vs-foreach",
    title: "map vs forEach",
    summary: "When to use each, and the bug that comes from mixing them up.",
    subject: "programming",
    tags: ["JavaScript", "Arrays", "Higher-order functions"],
    level: "intermediate",
    minutes: 7,
    author: { id: "dev", handle: "dev", name: "Dev", image: null },
    views: 3100,
    likes: 120,
    // An app that didn't say, or has no logo: no icon.
    origin: null,
  }),
]

const meta = {
  title: "Site/Explore",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta
type Story = StoryObj

const signedOut = { signedIn: false, liked: new Set<string>() }
const signedIn = {
  signedIn: true,
  liked: new Set(["k3x9a2mq"]),
  completed: new Map([["k3x9a2mq", Date.UTC(2026, 9, 20, 12, 12)]]),
}

export const Row: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <LessonRow lesson={LESSONS[0]!} viewer={signedOut} />
    </div>
  ),
}

/** Saves progress for a row the way the player would: `done` of `total` katas behind the learner. */
function seedProgress(lesson: LessonSummary, done: number, total: number) {
  const items = [
    { kind: "intro" },
    ...Array.from({ length: total }, () => ({ kind: "concept", kata: {} })),
    { kind: "fix" },
    { kind: "wrap" },
  ]
  localStorage.setItem(
    `learn:progress:l/${lesson.slug}-${lesson.id}`,
    JSON.stringify({
      v: 1,
      fingerprint: "story",
      savedAt: Date.now(),
      state: { items, index: done + 1 },
    })
  )
}

/** A lesson nobody has kept yet, which only its liker's own Likes tab lists. */
const ANONYMOUS = summary({
  id: "z8y7x6w5",
  slug: "why-the-sky-is-blue",
  title: "Why the sky is blue",
  summary: "Sunlight scatters off air, and blue scatters the most.",
  subject: "science",
  tags: ["Light", "Atmosphere"],
  minutes: 5,
  author: null,
  views: 23,
  likes: 3,
  origin: "claude",
  visibility: "unlisted",
  createdAt: Date.now() - 4 * DAY,
  expiresAt: Date.now() + 3 * DAY,
})

export const RowStates: Story = {
  name: "Row states",
  beforeEach: () => {
    seedProgress(LESSONS[1]!, 3, 8)
    seedProgress(LESSONS[5]!, 6, 8)
    return () => {
      localStorage.removeItem(
        `learn:progress:l/${LESSONS[1]!.slug}-${LESSONS[1]!.id}`
      )
      localStorage.removeItem(
        `learn:progress:l/${LESSONS[5]!.slug}-${LESSONS[5]!.id}`
      )
    }
  },
  render: () => (
    <div className="grid max-w-5xl gap-x-8 gap-y-4 sm:grid-cols-2">
      <Labeled label="Read-only (home page)">
        <LessonRow lesson={LESSONS[0]!} />
      </Labeled>
      <Labeled label="Logged out: pressing the heart asks to log in">
        <LessonRow lesson={LESSONS[0]!} viewer={signedOut} />
      </Labeled>
      <Labeled label="Logged in, liked and completed">
        <LessonRow lesson={LESSONS[0]!} viewer={signedIn} />
      </Labeled>
      <Labeled label="Logged in, not liked, 3 of 8 katas done">
        <LessonRow lesson={LESSONS[1]!} viewer={signedIn} />
      </Labeled>
      <Labeled label="Big numbers, 6 of 8 katas done">
        <LessonRow lesson={LESSONS[5]!} viewer={signedIn} />
      </Labeled>
      <Labeled label="Owner has no handle yet">
        <LessonRow lesson={LESSONS[4]!} viewer={signedIn} />
      </Labeled>
      <Labeled label="Anonymous (liked before anyone kept it)">
        <LessonRow lesson={ANONYMOUS} viewer={signedIn} />
      </Labeled>
      <Labeled label="Yours, private, 3 of 8 katas done">
        {/* Your own rows' menu needs Next's router, which Storybook doesn't mount. */}
        <AppRouterContext.Provider value={stubRouter}>
          <LessonRow
            lesson={{ ...LESSONS[1]!, visibility: "unlisted" }}
            viewer={{ ...signedIn, userId: "bob-builds" }}
          />
        </AppRouterContext.Provider>
      </Labeled>
      <Labeled label="Long handle on a phone">
        <div className="max-w-[340px]">
          <LessonRow
            lesson={summary({
              id: "longname",
              author: {
                id: "long",
                handle: "a-rather-long-handle-indeed",
                name: "Long",
                image: null,
              },
              origin: "claude-code",
            })}
            viewer={signedOut}
          />
        </div>
      </Labeled>
      <Labeled label="Right-to-left lesson">
        <LessonRow lesson={LESSONS[3]!} viewer={signedIn} />
      </Labeled>
      <Labeled label="Ranked (Top tab)">
        <LessonRow lesson={LESSONS[5]!} viewer={signedIn} rank={1} />
      </Labeled>
    </div>
  ),
}

/** The menu on the viewer's own rows: right-click the title (or long-press it, or Shift+F10). */
export const OwnerMenu: Story = {
  name: "Owner menu",
  render: function Render() {
    const [done, setDone] = React.useState(0)
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Right-click the title. Done {done} {done === 1 ? "time" : "times"}.
        </p>
        <h3 className="text-base leading-snug font-medium">
          <LessonMenuView
            lesson={{
              id: LESSONS[0]!.id,
              title: LESSONS[0]!.title,
              language: "en",
              visibility: "public",
            }}
            href="#"
            api={fakeApi}
            onDone={() => setDone((n) => n + 1)}
            className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {LESSONS[0]!.title}
          </LessonMenuView>
        </h3>
      </div>
    )
  },
}

const HOUR = 36e5
const AGES: [string, number][] = [
  ["Just now", 0],
  ["Minutes", 5 * 60e3],
  ["Hours", 3 * HOUR],
  ["Yesterday", DAY],
  ["Days", 4 * DAY],
  ["Weeks", 2 * 7 * DAY],
  ["Months", 3 * 30 * DAY],
  ["Last year", 365 * DAY],
  ["Years", 2 * 365 * DAY],
]

/** The byline's age at every step, from a lesson published this minute to one years old. */
export const RowAges: Story = {
  name: "Row ages",
  render: () => (
    <div className="mx-auto flex max-w-2xl flex-col divide-y">
      {AGES.map(([label, age]) => (
        <LessonRow
          key={label}
          lesson={summary({ id: label, createdAt: Date.now() - age })}
          viewer={signedOut}
        />
      ))}
    </div>
  ),
}

export const Feed: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <LessonFeed lessons={LESSONS} viewer={signedIn} />
    </div>
  ),
}

export const FeedTop: Story = {
  name: "Feed, ranked",
  render: () => (
    <div className="mx-auto max-w-2xl">
      <LessonFeed
        lessons={[...LESSONS].sort((a, b) => b.likes - a.likes)}
        viewer={signedIn}
        ranked
      />
    </div>
  ),
}

export const FeedLoading: Story = {
  name: "Feed, loading",
  render: () => (
    <div className="mx-auto max-w-2xl">
      <FeedSkeleton rows={4} />
    </div>
  ),
}

/** The greeting at each part of the day, and while the page loads. */
export const Greeting: Story = {
  render: () => (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      {[9, 14, 19, 23].map((hour) => (
        <ExploreGreeting key={hour} greeting={greetingFor(hour)} />
      ))}
      <ExploreGreetingSkeleton />
    </div>
  ),
}

export const Like: Story = {
  name: "Like button",
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <Labeled label="Logged out">
        <LikeButton id="a" likes={37} signedIn={false} api={fakeApi} />
      </Labeled>
      <Labeled label="Logged in">
        <LikeButton id="b" likes={12} signedIn api={fakeApi} />
      </Labeled>
      <Labeled label="Logged in, liked">
        <LikeButton id="c" likes={13} liked signedIn api={fakeApi} />
      </Labeled>
    </div>
  ),
}

export const Report: Story = {
  name: "Report dialog",
  render: function Render() {
    const [open, setOpen] = React.useState(true)
    return (
      <>
        <Button variant="outline" onPress={() => setOpen(true)}>
          Report lesson
        </Button>
        <ReportDialog
          id="k3x9a2mq"
          isOpen={open}
          onOpenChange={setOpen}
          api={fakeApi}
        />
      </>
    )
  },
}

export const Block: Story = {
  name: "Block dialog",
  render: function Render() {
    const [open, setOpen] = React.useState(true)
    return (
      <>
        <Button variant="outline" onPress={() => setOpen(true)}>
          Block ada
        </Button>
        <BlockDialog
          person={{ id: "ada", handle: "ada" }}
          isOpen={open}
          onOpenChange={setOpen}
          onDone={() => {}}
          api={fakeApi}
        />
      </>
    )
  },
}

export const Blocked: Story = {
  name: "Blocked people (Settings)",
  render: () => (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <BlockedPeople
        api={fakeApi}
        initial={[
          {
            id: "ada",
            handle: "ada",
            name: "Ada",
            image: PORTRAIT,
            blockedAt: Date.now() - 2 * DAY,
          },
          {
            id: "grace",
            handle: "grace",
            name: "Grace",
            image: null,
            blockedAt: Date.now() - 40 * DAY,
          },
        ]}
      />
      <BlockedPeople api={fakeApi} initial={[]} />
    </div>
  ),
}

export const OwnProfileTabs: Story = {
  name: "Profile tabs (own profile)",
  render: () => {
    // Partway through two lessons, as the account has it (no browser progress needed).
    const started = [LESSONS[3]!, LESSONS[4]!]
    const own = {
      ...signedIn,
      userId: "ada",
      progress: new Map([
        [started[0]!.id, { done: 4, total: 9 }],
        [started[1]!.id, { done: 1, total: 7 }],
      ]),
    }
    const author = LESSONS[0]!.author
    const lessons: LessonSummary[] = [
      LESSONS[0]!,
      { ...LESSONS[1]!, author, visibility: "unlisted" },
      { ...LESSONS[5]!, author, hidden: true },
    ]
    // Your own rows' menu refreshes the page through Next's router, which Storybook doesn't mount.
    return (
      <AppRouterContext.Provider value={stubRouter}>
        <div className="mx-auto max-w-2xl">
          <ProfileTabs
            activity={
              <ActivityGrid
                grid={buildGrid(
                  [
                    { day: "2026-10-20", lessons: 1 },
                    { day: "2026-10-22", lessons: 2 },
                  ],
                  "2026-10-23"
                )}
              />
            }
            lessons={{
              label: "My lessons",
              count: lessons.length,
              panel: <LessonFeed lessons={lessons} viewer={own} />,
            }}
            inProgress={{
              count: started.length,
              panel: <LessonFeed lessons={started} viewer={own} />,
            }}
            likes={{
              count: 2,
              panel: (
                <LessonFeed
                  lessons={[ANONYMOUS, ...LESSONS.slice(2, 3)]}
                  viewer={own}
                />
              ),
            }}
          />
        </div>
      </AppRouterContext.Provider>
    )
  },
}

const stubRouter = {
  bfcacheId: "story",
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
}

function Labeled({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
