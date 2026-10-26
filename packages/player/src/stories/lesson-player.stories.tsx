import type { Meta, StoryObj } from "@storybook/react-vite"
import { useGlobals } from "storybook/preview-api"

import type { Lesson } from "@workspace/spec"

import { buildSequence, scoredQuestions, type Outcome } from "../flow"
import { LessonPlayer, type State } from "../lesson-player"
import { fingerprint } from "../progress"
import type { DayStreak } from "../streak"
import { stringsFor } from "../strings"
import { lessons, prepared } from "./fixtures"

// The whole player, playable end to end. Switch language and theme in the toolbar or the footer.

const HOUR = 3.6e6
const DAY = 24 * HOUR

const meta = {
  title: "Player/Lesson player",
  component: LessonPlayer,
  // A freshly published link: the lesson menu (the chevron by the title) says it expires in 7 days.
  args: { lesson: lessons.buttons, prepared, expiresAt: Date.now() + 7 * DAY },
  argTypes: {
    lesson: { control: false },
    prepared: { control: false },
    expiresAt: { control: "date" },
  },
  render: function Render(args, { globals }) {
    const [, updateGlobals] = useGlobals()
    return (
      <div className="h-screen">
        <LessonPlayer
          key={globals.ui}
          {...args}
          uiLanguage={globals.ui}
          homeHref="#"
          nextPrompt={(kind, topic, after) =>
            `Make me a learn.ninja lesson (${kind}) about ${topic}, after my lesson "${after}".`
          }
          docsHref="#"
          privacyHref="#"
          termsHref="#"
          theme={globals.theme === "dark" ? "dark" : "light"}
          onThemeChange={(theme) =>
            updateGlobals({
              theme:
                theme === "system"
                  ? matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light"
                  : theme,
            })
          }
        />
      </div>
    )
  },
} satisfies Meta<typeof LessonPlayer>

export default meta
type Story = StoryObj<typeof meta>

export const ButtonHierarchy: Story = { args: { lesson: lessons.buttons } }
export const WritingAPrd: Story = {
  name: "Writing a PRD",
  args: { lesson: lessons.prd },
}
export const CompoundInterest: Story = { args: { lesson: lessons.compound } }
export const SpanishGreetings: Story = { args: { lesson: lessons.spanish } }
export const MapVsForEach: Story = {
  name: "map vs forEach",
  args: { lesson: lessons.coding },
}
export const CorrelationVsCausation: Story = {
  name: "Correlation vs causation",
  args: { lesson: lessons.correlation },
}
export const BronzeAgeCollapse: Story = {
  name: "Bronze Age collapse",
  args: { lesson: lessons.bronze },
}
/** Under a day left: the lesson menu counts the link's time in hours instead of days. */
export const ExpiresSoon: Story = {
  args: { lesson: lessons.buttons, expiresAt: Date.now() + 14 * HOUR },
}
// The player reads its preferences on mount, so these stories save a choice before it renders.
const withPrefs = (prefs: object) => [
  () =>
    localStorage.setItem(
      "learn:preferences",
      JSON.stringify({ textSize: "md", ...prefs })
    ),
]

/** The tray of buttons under the lesson closes with the notch; Enter still runs the main action. */
export const TrayClosed: Story = {
  args: { lesson: lessons.buttons },
  loaders: withPrefs({ tray: "closed" }),
}
/**
 * On a phone: the header is the logo, the progress bar, and one menu (the settings and the footer's
 * links move into it), the actions span the tray, and feedback is a card in the tray above them.
 */
export const Phone: Story = {
  args: { lesson: lessons.buttons },
  globals: { viewport: { value: "mobile2", isRotated: false } },
}
/**
 * The ninja as the sensei: he settles and bows in, breathes while he waits, and bows at the earned
 * moments. On a lesson you can play through by keyboard, to reach the wrap-up and his line there.
 */
export const NinjaSensei: Story = {
  args: { lesson: lessons.compound },
  loaders: withPrefs({ ninja: "sensei" }),
}
/** The ninja setting at its top stop: bigger moves, and two reactions to every answer. */
export const NinjaUnhinged: Story = {
  args: { lesson: lessons.buttons },
  loaders: withPrefs({ ninja: "unhinged" }),
}
/** The ninja setting off: no ninja, and the feedback toast starts at the card's edge. */
export const NinjaOff: Story = {
  args: { lesson: lessons.buttons },
  loaders: withPrefs({ ninja: "off" }),
}
/**
 * Story mode: a scenario opens with the ninja's brief. He steps up to tell it, goes back to his
 * corner for the question, says what each pick led to, and a miss rewinds to the decision.
 */
export const ScenarioStoryMode: Story = {
  name: "Scenario story mode",
  args: { lesson: lessons.buttons, startAt: "ch" },
  loaders: withPrefs({ ninja: "casual" }),
}

/**
 * Opens on the wrap-up, as if the lesson was just finished with these outcomes (in play order, the
 * rest first try), by saving that progress for the player to resume. The time isn't known there.
 */
const atWrap = (lesson: Lesson, key: string, outcomes: Outcome[] = []) => [
  () => {
    const items = buildSequence(lesson)
    const state: State = {
      items,
      index: items.length - 1,
      results: Object.fromEntries(
        scoredQuestions(lesson).map((b, i) => [b.id, outcomes[i] ?? "first"])
      ),
      mistakes: [],
      fixed: [],
      inFix: false,
      fixQueued: false,
      question: null,
      run: 0,
    }
    localStorage.setItem(
      `learn:progress:${key}`,
      JSON.stringify({
        v: 1,
        fingerprint: fingerprint(lesson),
        savedAt: Date.now(),
        state,
      })
    )
  },
]

/** The wrap-up after a perfect run: all first tries, and Share leads. */
export const WrapUpPerfect: Story = {
  name: "Wrap-up: perfect run",
  args: { lesson: lessons.buttons, progressKey: "story-wrap-perfect" },
  loaders: atWrap(lessons.buttons, "story-wrap-perfect"),
}
/** A good run (at most one missed): Share still leads. */
export const WrapUpGood: Story = {
  name: "Wrap-up: good run",
  args: { lesson: lessons.buttons, progressKey: "story-wrap-good" },
  loaders: atWrap(lessons.buttons, "story-wrap-good", ["first", "second"]),
}
/** A rough run (more than one missed): Restart leads. */
export const WrapUpRough: Story = {
  name: "Wrap-up: rough run",
  args: { lesson: lessons.buttons, progressKey: "story-wrap-rough" },
  loaders: atWrap(lessons.buttons, "story-wrap-rough", [
    "missed",
    "first",
    "missed",
    "second",
  ]),
}

/** A fake like that answers after a moment, as the server would. */
const likeAfter = (likes: number, liked: boolean) => ({
  likes,
  liked,
  onChange: (next: boolean) =>
    new Promise<{ likes: number }>((resolve) =>
      setTimeout(
        () => resolve({ likes: likes + (next ? 1 : 0) - (liked ? 1 : 0) }),
        300
      )
    ),
})

/** Logged in, with the heart beside the other actions: pressing it likes the lesson. */
export const WrapUpLike: Story = {
  name: "Wrap-up: like",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-like",
    like: likeAfter(12, false),
  },
  loaders: atWrap(lessons.buttons, "story-wrap-like"),
}
/** Logged in and already liked. */
export const WrapUpLiked: Story = {
  name: "Wrap-up: liked",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-liked",
    like: likeAfter(13, true),
  },
  loaders: atWrap(lessons.buttons, "story-wrap-liked"),
}
/** Logged out: pressing the heart shows a toast asking them to log in, with a Log in button. */
export const WrapUpLikeLoggedOut: Story = {
  name: "Wrap-up: like, logged out",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-like-out",
    like: { likes: 12, liked: false, loginHref: "#login" },
  },
  loaders: atWrap(lessons.buttons, "story-wrap-like-out"),
}
/** A like the server refuses: the heart goes back and the failure is announced. */
export const WrapUpLikeFails: Story = {
  name: "Wrap-up: like fails",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-like-fails",
    like: {
      likes: 12,
      liked: false,
      onChange: async () => ({ error: "Something went wrong." }),
    },
  },
  loaders: atWrap(lessons.buttons, "story-wrap-like-fails"),
}

/** A fake publish that answers after a moment, as the server would. */
/**
 * A streak as of a fixed Monday: the last seven days oldest first, one letter each (l lit, r a rest
 * day, m missed, o today still open).
 */
const streakOf = (
  current: number,
  longest: number,
  rest: number,
  week: string,
  toward = 0,
  recharged = false
): DayStreak => ({
  current,
  longest,
  rest,
  toward,
  recharged,
  days: [...week].map((c, i) => ({
    day: `2026-10-${String(20 + i).padStart(2, "0")}`,
    state: ({ l: "lit", r: "rest", m: "missed", o: "open" } as const)[
      c as "l" | "r" | "m" | "o"
    ],
  })),
})

/**
 * The day's first lesson, logged in: the streak screen comes before the wrap-up. Today's lantern
 * lights and swings, the count ticks to 12, and Continue goes on to the wrap-up.
 */
export const StreakScreen: Story = {
  name: "Streak screen",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-streak",
    streak: streakOf(12, 21, 1, "lllrlll", 1),
  },
  loaders: atWrap(lessons.buttons, "story-wrap-streak", ["first", "second"]),
}
/** A second learning day: the bar fills, a rest day's lantern turns blue and swings, and the bar empties for the next. */
export const StreakScreenRecharged: Story = {
  name: "Streak screen: rest day recharged",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-streak-recharged",
    streak: streakOf(6, 21, 1, "mllllll", 0, true),
  },
  loaders: atWrap(lessons.buttons, "story-wrap-streak-recharged"),
}
/** The first lantern ever: the streak starts today. */
export const StreakScreenStarts: Story = {
  name: "Streak screen: first day",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-streak-starts",
    streak: streakOf(1, 1, 1, "mmmmmml", 1),
  },
  loaders: atWrap(lessons.buttons, "story-wrap-streak-starts"),
}
/** Day 1 after a streak broke: no guilt, and a proverb. */
export const StreakScreenAgain: Story = {
  name: "Streak screen: again",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-streak-again",
    streak: streakOf(1, 21, 1, "lllmmml", 1),
  },
  loaders: atWrap(lessons.buttons, "story-wrap-streak-again"),
}

const publishAfter = () =>
  new Promise<{ error?: string }>((resolve) =>
    setTimeout(() => resolve({}), 300)
  )
const LESSON_URL =
  "https://learn.ninja/l/pick-the-right-button-for-every-action-puepf71u"

/** The lesson's maker, logged in, with it still private: a lock on Share, which holds the link, the publish switch, and Make changes. */
export const WrapUpCreator: Story = {
  name: "Wrap-up: creator, private",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-creator",
    like: likeAfter(0, false),
    creator: {
      status: "private",
      onPublish: publishAfter,
      onUnpublish: publishAfter,
      url: LESSON_URL,
    },
  },
  loaders: atWrap(lessons.buttons, "story-wrap-creator"),
}
/** The maker's lesson once it's in Explore: a globe on Share, and its switch to make it private again. */
export const WrapUpCreatorPublished: Story = {
  name: "Wrap-up: creator, published",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-creator-published",
    creator: {
      status: "published",
      onUnpublish: publishAfter,
      profileHref: "#profile",
      url: LESSON_URL,
    },
  },
  loaders: atWrap(lessons.buttons, "story-wrap-creator-published"),
}
/** Hidden after a report: it can't be published, but it can still be changed. */
export const WrapUpCreatorHidden: Story = {
  name: "Wrap-up: creator, hidden",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-creator-hidden",
    creator: { status: "hidden", url: LESSON_URL },
  },
  loaders: atWrap(lessons.buttons, "story-wrap-creator-hidden"),
}
/** A publish the server refuses: the card stays private and says so. */
export const WrapUpCreatorPublishFails: Story = {
  name: "Wrap-up: creator, publish fails",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-creator-fails",
    creator: {
      status: "private",
      onPublish: async () => ({ error: "Something went wrong." }),
      url: LESSON_URL,
    },
  },
  loaders: atWrap(lessons.buttons, "story-wrap-creator-fails"),
}
/** Make changes open (from the wrap-up's row; Share has it too): tick changes, add your own, and copy them as one prompt. */
export const WrapUpCreatorChanges: Story = {
  name: "Wrap-up: creator, make changes",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-creator-changes",
    creator: {
      status: "private",
      onPublish: publishAfter,
      onUnpublish: publishAfter,
      url: LESSON_URL,
    },
  },
  loaders: atWrap(lessons.buttons, "story-wrap-creator-changes"),
  // Opens the dialog from the wrap-up's row once it's in, in whichever language the toolbar picked.
  play: async ({ canvas, userEvent, globals }) => {
    const button = await canvas.findByRole(
      "button",
      { name: stringsFor(globals.ui ?? "en").makeChanges },
      { timeout: 10_000 }
    )
    await userEvent.click(button)
  },
}

/** Opened from a friend's challenge link: their score to beat on the title screen. */
export const ChallengeTitle: Story = {
  name: "Challenge: title screen",
  args: {
    lesson: lessons.buttons,
    challenge: { first: 4, total: 6, by: "colin" },
  },
}
/** The challenged learner's wrap-up: How you did says who won, and the share box sends a score back. */
export const WrapUpChallengeWon: Story = {
  name: "Wrap-up: challenge won",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-challenge-won",
    challenge: { first: 4, total: 6, by: "colin" },
    challenger: "quiet-kitsune-7",
  },
  loaders: atWrap(lessons.buttons, "story-wrap-challenge-won"),
}
/** A challenge lost, from a friend who wasn't logged in. */
export const WrapUpChallengeLost: Story = {
  name: "Wrap-up: challenge lost",
  args: {
    lesson: lessons.buttons,
    progressKey: "story-wrap-challenge-lost",
    challenge: { first: 6, total: 6 },
  },
  loaders: atWrap(lessons.buttons, "story-wrap-challenge-lost", [
    "first",
    "second",
  ]),
}
