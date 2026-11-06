import { View } from "react-native"
import Svg, { Path } from "react-native-svg"

import {
  runFor,
  scoredQuestions,
  summarize,
  type Outcome,
} from "@workspace/player-core/flow"
import { directionOf, type Strings } from "@workspace/player-core/strings"
import type { Lesson } from "@workspace/spec"

import { SLOT } from "@/components/intro"
import { TrophyIcon } from "@/components/icons"
import { Ninja } from "@/components/ninja"
import { RichText } from "@/components/rich-text"
import { useStage } from "@/components/stage-context"
import { StreakCard, StreakScreen } from "@/components/streak"
import { Button } from "@/components/ui/button"
import { DirectionView } from "@/components/direction"
import { Text } from "@/components/ui/text"
import { challengeVerdict } from "@/lib/challenge-text"
import { alpha } from "@/lib/color"
import { tap } from "@/lib/haptics"
import { colors, fontSize } from "../../tokens"

// The wrap-up, as the web's WrapUp lays it out on a phone (packages/player/src/lesson-player.tsx
// and wrap-up.tsx): two groups, further apart than anything inside them. First how it went: the
// ninja turning up in his slot for his send-off (a cheer, or the sensei's bow, deeper after a
// perfect run), Done with the first tries under it, the run as one bar, and the actions stacked
// (Challenge friend through the share sheet, filled; Restart, outlined). Then the streak and what
// the lesson said. On the day's first finish the streak screen comes first (StreakScreen).
//
// The score is read from State as the web reads it: summarize(lesson, state.results). Still to
// come with sign-in (phase 4): the challenge's verdict, the heart, and Keep learning.

const SEGMENT: Record<Outcome, string> = {
  first: colors.feedback.good,
  second: colors.feedback.warn,
  missed: alpha(colors.foreground, 0.15),
}

export function WrapUp({
  lesson,
  results,
  onRestart,
  t,
}: {
  lesson: Lesson
  results: Record<string, Outcome>
  onRestart: () => void
  t: Strings
}) {
  const { ninja, streak, streakScreen, sound, onShare, uiLang, challenge } =
    useStage()
  if (streakScreen && streak)
    return (
      <StreakScreen streak={streak.streak} sound={sound} lang={uiLang} t={t} />
    )
  const summary = summarize(lesson, results)
  const run = runFor(summary)
  const outcomes = scoredQuestions(lesson).map((b) => results[b.id] ?? "missed")
  // The celebration leads; the score is one quiet line of first tries.
  const score =
    run === "perfect"
      ? t.allFirstTry(summary.total)
      : t.firstTryCount(summary.first, summary.total)
  return (
    <View className="gap-14">
      <View className="gap-6">
        <View className="items-center gap-4">
          {ninja !== "off" ? (
            <View
              className="-mb-4 items-center justify-center"
              style={{ width: SLOT, height: SLOT }}
            >
              <Ninja size={SLOT} level={ninja} appear celebrate={run} />
            </View>
          ) : null}
          <View className="items-center gap-2">
            <Text
              className="text-center text-2xl font-semibold"
              accessibilityRole="header"
            >
              {t.done}
            </Text>
            {summary.total > 0 ? (
              <Text className="text-center text-sm font-medium text-muted-foreground">
                {score}
              </Text>
            ) : null}
            {challenge ? <Verdict first={summary.first} t={t} /> : null}
          </View>
          {summary.total > 0 ? <RunBar outcomes={outcomes} t={t} /> : null}
        </View>
        <View className="gap-2">
          {onShare ? (
            <Button
              size="lg"
              onPress={() => {
                tap()
                onShare(summary.first, summary.total)
              }}
            >
              <ActionIcon kind="challenge" color={colors.primary.foreground} />
              <Text>{challenge ? t.challengeBack : t.challengeTitle}</Text>
            </Button>
          ) : null}
          <Button
            size="lg"
            variant="outline"
            onPress={() => {
              tap()
              onRestart()
            }}
          >
            <ActionIcon kind="restart" color={colors.foreground} />
            <Text>{t.restart}</Text>
          </Button>
        </View>
      </View>
      <View className="gap-8">
        {streak ? (
          <StreakCard streak={streak.streak} lang={uiLang} t={t} />
        ) : null}
        <Takeaways
          items={lesson.wrapup.takeaways}
          language={lesson.language}
          t={t}
        />
      </View>
    </View>
  )
}

/**
 * The run as one bar under the score: a segment for each scored question in play order, green on
 * the first try, yellow after another go, empty when it was missed.
 */
function RunBar({ outcomes, t }: { outcomes: Outcome[]; t: Strings }) {
  return (
    <View
      className="w-56 max-w-full flex-row gap-1"
      accessibilityRole="list"
      accessibilityLabel={`${t.howYouDid}: ${outcomes
        .map((o, i) => `${i + 1}. ${t.outcomes[o]}`)
        .join(", ")}`}
    >
      {outcomes.map((o, i) => (
        <View
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{ backgroundColor: SEGMENT[o] }}
        />
      ))}
    </View>
  )
}

/** For a challenged learner, under the score: whether they beat the score they were sent. */
function Verdict({ first, t }: { first: number; t: Strings }) {
  const { challenge } = useStage()
  if (!challenge) return null
  const { won, text } = challengeVerdict(first, challenge, t)
  return (
    <View className="flex-row items-center gap-2">
      <TrophyIcon
        size={16}
        color={won ? colors.feedback.warn : colors.muted.foreground}
      />
      <Text className="text-sm font-medium">{text}</Text>
    </View>
  )
}

/** The takeaways as a grouped list (the web's WrapSection): a quiet label over a card, a check on each row. */
function Takeaways({
  items,
  language,
  t,
}: {
  items: string[]
  /** The lesson's language: the takeaways run its way, under a label in the player's. */
  language: string
  t: Strings
}) {
  return (
    <View className="w-full gap-2">
      <Text
        className="px-1 text-sm font-medium text-muted-foreground"
        accessibilityRole="header"
      >
        {t.takeaways}
      </Text>
      <DirectionView
        dir={directionOf(language)}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
      >
        {items.map((text, i) => (
          <View
            key={i}
            className={
              i > 0
                ? "flex-row gap-3 border-t border-border px-4 py-3"
                : "flex-row gap-3 px-4 py-3"
            }
          >
            <View className="mt-0.5">
              <ActionIcon kind="check" color={colors.feedback.good} />
            </View>
            <View className="min-w-0 flex-1">
              <RichText
                text={text}
                size={fontSize.sm[0]}
                className="text-lesson-sm font-medium"
              />
            </View>
          </View>
        ))}
      </DirectionView>
    </View>
  )
}

/** Lucide's Swords, RotateCcw, and Check, at 16 points. */
function ActionIcon({
  kind,
  color,
}: {
  kind: "challenge" | "restart" | "check"
  color: string
}) {
  const paths = {
    challenge: [
      "m13 19 6-6",
      "M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5",
      "m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586",
      "m16 16 4 4",
      "m19 21 2-2",
      "m5 14 4 4",
      "m5 21-2-2",
      "M7.5 16.5 4 20",
    ],
    restart: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
    check: ["M20 6 9 17l-5-5"],
  }[kind]
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  )
}
