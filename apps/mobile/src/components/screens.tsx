import { View } from "react-native"

import type { Item } from "@workspace/player-core/flow"
import type { State } from "@workspace/player-core/state"
import type { Strings } from "@workspace/player-core/strings"

import { Intro } from "@/components/intro"
import { ConceptKata } from "@/components/katas"
import { QuestionScreen } from "@/components/question"
import { Text } from "@/components/ui/text"
import { WrapUp } from "@/components/wrap-up"
import type { LoadedLesson } from "@/lib/api"
import type { Feedback } from "@/lib/feedback"
import type { AppAction } from "@/lib/play"

// One screen of the lesson, as the web's Screen draws it (packages/player/src/lesson-player.tsx),
// with the text at the player's medium size (the lesson-* sizes).

export function LessonScreen({
  data,
  item,
  state,
  dispatch,
  feedback,
  whyOpen,
  steps,
  t,
}: {
  /** A stepped concept: how many steps of its body are showing. */
  steps?: number
  data: LoadedLesson
  item: Item
  state: State
  dispatch: (action: AppAction) => void
  feedback: Feedback
  whyOpen: boolean
  t: Strings
}) {
  const { lesson } = data
  switch (item.kind) {
    case "intro":
      // Phase 3: the ninja's slot and entrance, and the title vanishing into smoke (intro.tsx).
      return (
        <Intro
          lesson={lesson}
          t={t}
          meta={
            <MetaLine
              facts={[
                t.minutes(lesson.estimatedMinutes),
                t.levels[lesson.level],
              ]}
            />
          }
        />
      )
    case "concept":
      return <ConceptKata kata={item.kata} steps={steps} />
    case "question":
      return state.question ? (
        <QuestionScreen
          item={item}
          question={state.question}
          dispatch={dispatch}
          feedback={feedback}
          whyOpen={whyOpen}
          t={t}
        />
      ) : null
    case "fix":
      return (
        <View className="gap-2">
          <Text className="text-lesson-2xl font-semibold">{t.fixTitle}</Text>
          <Text className="text-lesson-sm font-medium text-muted-foreground">
            {t.fixBody(state.mistakes.length)}
          </Text>
        </View>
      )
    case "wrap":
      // Phase 3: the ninja's send-off, the streak, and the actions (wrap-up.tsx).
      return (
        <WrapUp
          lesson={lesson}
          results={state.results}
          guesses={state.guesses}
          onRestart={() => dispatch({ type: "restart" })}
          t={t}
        />
      )
  }
}

/** The intro's meta line under the summary: the length and level, dot-separated. */
function MetaLine({ facts }: { facts: string[] }) {
  return (
    <View className="flex-row flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
      {facts.map((fact, i) => (
        <View key={i} className="flex-row items-center gap-x-1.5">
          {i > 0 ? (
            <Text
              className="text-lesson-sm text-muted-foreground/60"
              aria-hidden
            >
              ·
            </Text>
          ) : null}
          <Text className="text-lesson-sm text-muted-foreground">{fact}</Text>
        </View>
      ))}
    </View>
  )
}
