import type { ReactNode } from "react"
import { View } from "react-native"

import { directionOf, type Strings } from "@workspace/player-core/strings"
import type { Lesson } from "@workspace/spec"

import { SwordsIcon } from "@/components/icons"
import { Ninja } from "@/components/ninja"
import { SmokeWords, VanishFade } from "@/components/smoke"
import { useStage } from "@/components/stage-context"
import { Text } from "@/components/ui/text"
import { challengeNote } from "@/lib/challenge-text"

// The intro, as the web's Screen draws it (packages/player/src/lesson-player.tsx): the ninja in his
// slot above the title, making his entrance, then the title, the summary, and the meta line. The
// smoke behind it is the player's (Aura, in the lesson route), and Start makes it all vanish.

/** The ninja's slot, in points: the web's size-22. */
export const SLOT = 88

export function Intro({
  lesson,
  meta,
  t,
}: {
  lesson: Lesson
  meta: ReactNode
  t: Strings
}) {
  const { ninja, vanishing, challenge } = useStage()
  const rtl = directionOf(lesson.language) === "rtl"
  return (
    <View className="items-center gap-5">
      {ninja !== "off" ? (
        // His slot, 88 points as on the web, sitting a little closer to the title.
        <View
          className="-mb-5 items-center justify-center"
          style={{ width: SLOT, height: SLOT }}
        >
          <Ninja size={SLOT} level={ninja} entrance vanishing={vanishing} />
        </View>
      ) : null}
      <View className="w-full gap-3">
        <SmokeWords
          text={lesson.title}
          vanishing={vanishing}
          step={50}
          rtl={rtl}
          className="text-lesson-2xl text-center font-semibold tracking-tight"
        />
        <VanishFade vanishing={vanishing}>
          <Text
            className="text-lesson-base text-center font-medium text-muted-foreground"
            style={{ writingDirection: rtl ? "rtl" : "ltr" }}
          >
            {lesson.summary}
          </Text>
        </VanishFade>
      </View>
      <VanishFade vanishing={vanishing}>{meta}</VanishFade>
      {challenge ? (
        // A challenge link's score to beat, as the web's ChallengeNote: a pill under the meta line.
        <VanishFade vanishing={vanishing}>
          <View className="flex-row items-center gap-2 rounded-full border border-border bg-card px-3 py-1">
            <SwordsIcon size={16} />
            <Text className="text-sm font-medium">
              {challengeNote(challenge, t)}
            </Text>
          </View>
        </VanishFade>
      ) : null}
    </View>
  )
}
