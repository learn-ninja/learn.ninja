import { View } from "react-native"

import {
  runFor,
  scoredQuestions,
  summarize,
  type Outcome,
} from "@workspace/player-core/flow"
import type { Strings } from "@workspace/player-core/strings"
import type { Lesson } from "@workspace/spec"

import { RichText } from "@/components/rich-text"
import { Text } from "@/components/ui/text"
import { alpha } from "@/lib/color"
import { colors, fontSize, LESSON_TEXT_SCALE } from "../../tokens"

// The wrap-up's score, as the web's WrapUp shows it (packages/player/src/lesson-player.tsx and
// wrap-up.tsx): the title, the lesson's name, the first-try count, the run bar, and the takeaways.
// The ninja's send-off, the streak, the challenge, and the heart come with phase 3 and 4.

const SEGMENT: Record<Outcome, string> = {
  first: colors.feedback.good,
  second: colors.feedback.warn,
  missed: alpha(colors.foreground, 0.15),
}

export function WrapUp({
  lesson,
  results,
  t,
}: {
  lesson: Lesson
  results: Record<string, Outcome>
  t: Strings
}) {
  const summary = summarize(lesson, results)
  const perfect = runFor(summary) === "perfect"
  const outcomes = scoredQuestions(lesson).map((b) => results[b.id] ?? "missed")
  return (
    <View className="items-center gap-8">
      <View className="items-center gap-3">
        <Text className="text-lesson-2xl text-center font-semibold tracking-tight">
          {t.done}
        </Text>
        <Text className="text-lesson-base text-center font-medium text-muted-foreground">
          {lesson.title}
        </Text>
      </View>
      {summary.total > 0 ? (
        <View className="items-center gap-3">
          <Text className="text-lesson-lg text-center font-semibold">
            {perfect
              ? t.allFirstTry(summary.total)
              : t.firstTryCount(summary.first, summary.total)}
          </Text>
          <RunBar outcomes={outcomes} t={t} />
        </View>
      ) : null}
      <View className="w-full gap-2">
        <Text className="px-1 text-sm font-medium text-muted-foreground">
          {t.takeaways}
        </Text>
        <View className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {lesson.wrapup.takeaways.map((text, i) => (
            <View
              key={i}
              className={
                i > 0 ? "border-t border-border px-4 py-3" : "px-4 py-3"
              }
            >
              <RichText
                text={text}
                size={fontSize.sm[0] * LESSON_TEXT_SCALE}
                className="text-lesson-sm"
              />
            </View>
          ))}
        </View>
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
