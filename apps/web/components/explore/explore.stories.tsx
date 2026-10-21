import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"

import { Button } from "@workspace/ui/components/button"

import { YourLessons } from "@/components/account/your-lessons"
import type { ExploreApi } from "@/lib/explore/browser"
import type { LessonSummary } from "@/lib/explore/queries"

import { FeedSkeleton } from "./feed-skeleton"
import { LessonFeed } from "./lesson-feed"
import { LessonRow } from "./lesson-row"
import { LikeButton } from "./like-button"
import { ProfileTabs } from "./profile-tabs"
import { ReportDialog } from "./report-dialog"

// Explore's rows and controls with a fake server: likes go through, a report with "fail" in it
// fails, and listing a lesson whose title has "fail" in it is refused.

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
  author: { handle: "ada", name: "Ada Lovelace", image: PORTRAIT },
  plays: 1284,
  likes: 37,
  visibility: "public",
  hidden: false,
  createdAt: Date.now() - 2 * DAY,
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
    author: { handle: "bob-builds", name: "Bob", image: null },
    plays: 412,
    likes: 9,
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
    author: { handle: "maria", name: "María", image: null },
    plays: 88,
    likes: 2,
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
    author: { handle: "noor", name: "Noor", image: null },
    plays: 40,
    likes: 5,
  }),
  summary({
    id: "n0h4ndl3",
    slug: "bronze-age-collapse",
    title: "Why the Bronze Age collapsed",
    summary:
      "Drought, earthquakes, and the Sea Peoples: weighing the usual suspects.",
    // One tag: the row shows just it before the length and level.
    subject: "history",
    tags: ["Bronze Age"],
    level: "advanced",
    minutes: 14,
    author: { handle: null, name: "Someone without a handle", image: null },
    plays: 0,
    likes: 0,
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
    author: { handle: "dev", name: "Dev", image: null },
    plays: 3100,
    likes: 120,
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

export const RowStates: Story = {
  name: "Row states",
  render: () => (
    <div className="grid max-w-5xl gap-x-8 gap-y-4 sm:grid-cols-2">
      <Labeled label="Read-only (home page)">
        <LessonRow lesson={LESSONS[0]!} />
      </Labeled>
      <Labeled label="Signed out: pressing the heart asks to sign in">
        <LessonRow lesson={LESSONS[0]!} viewer={signedOut} />
      </Labeled>
      <Labeled label="Signed in, liked and completed">
        <LessonRow lesson={LESSONS[0]!} viewer={signedIn} />
      </Labeled>
      <Labeled label="Signed in, not liked">
        <LessonRow lesson={LESSONS[1]!} viewer={signedIn} />
      </Labeled>
      <Labeled label="Big numbers">
        <LessonRow lesson={LESSONS[5]!} viewer={signedIn} />
      </Labeled>
      <Labeled label="Owner has no handle yet">
        <LessonRow lesson={LESSONS[4]!} viewer={signedIn} />
      </Labeled>
      <Labeled label="Right-to-left lesson">
        <LessonRow lesson={LESSONS[3]!} viewer={signedIn} />
      </Labeled>
      <Labeled label="Ranked (Top tab)">
        <LessonRow lesson={LESSONS[5]!} viewer={signedIn} rank={1} />
      </Labeled>
      <Labeled label="On a profile: no author">
        <LessonRow lesson={LESSONS[0]!} viewer={signedIn} showAuthor={false} />
      </Labeled>
    </div>
  ),
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

export const Like: Story = {
  name: "Like button",
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <Labeled label="Signed out">
        <LikeButton id="a" likes={37} signedIn={false} api={fakeApi} />
      </Labeled>
      <Labeled label="Signed in">
        <LikeButton id="b" likes={12} signedIn api={fakeApi} />
      </Labeled>
      <Labeled label="Signed in, liked">
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

export const OwnProfileTabs: Story = {
  name: "Profile tabs (own profile)",
  render: () => (
    <div className="mx-auto max-w-2xl">
      <ProfileTabs
        lessons={{
          count: 2,
          panel: (
            <LessonFeed
              lessons={LESSONS.slice(0, 2)}
              viewer={signedIn}
              showAuthor={false}
            />
          ),
        }}
        likes={{
          count: 1,
          panel: <LessonFeed lessons={LESSONS.slice(2, 3)} viewer={signedIn} />,
        }}
      />
    </div>
  ),
}

export const Settings: Story = {
  name: "Your lessons (own profile)",
  render: () => (
    <div className="mx-auto max-w-2xl">
      <YourLessons
        api={fakeApi}
        initial={[
          LESSONS[0]!,
          { ...LESSONS[1]!, visibility: "unlisted" },
          { ...LESSONS[2]!, id: "fail0001", visibility: "unlisted" },
          { ...LESSONS[5]!, hidden: true, visibility: "public" },
        ]}
      />
    </div>
  ),
}

export const SettingsEmpty: Story = {
  name: "Your lessons, none",
  render: () => <YourLessons api={fakeApi} initial={[]} />,
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
