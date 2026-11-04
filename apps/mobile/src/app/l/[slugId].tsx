import * as Haptics from "expo-haptics"
import { Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { buildSequence } from "@workspace/player-core/flow"

import { ConceptKata, KataPlaceholder } from "@/components/katas"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { fetchLesson, type LoadedLesson } from "@/lib/api"

// A lesson at /l/{slug}-{id}, the same path as on the web, or /l/{slug} for a bundled test lesson.
// Phase 0 opens on the first concept kata and steps through the katas in play order; question
// katas show a placeholder until they're ported.

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; data: LoadedLesson }

export default function LessonScreen() {
  const { slugId } = useLocalSearchParams<{ slugId: string }>()
  const [load, setLoad] = useState<Load>({ state: "loading" })

  useEffect(() => {
    let live = true
    fetchLesson(slugId)
      .then((data) => live && setLoad({ state: "ready", data }))
      .catch(
        (e: unknown) =>
          live &&
          setLoad({
            state: "error",
            message: e instanceof Error ? e.message : "The lesson didn't load.",
          })
      )
    return () => {
      live = false
    }
  }, [slugId])

  if (load.state === "loading")
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    )
  if (load.state === "error")
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center text-sm text-muted-foreground">
          {load.message}
        </Text>
      </View>
    )
  return <Player data={load.data} />
}

function Player({ data }: { data: LoadedLesson }) {
  const insets = useSafeAreaInsets()
  // The katas in play order (hook, the lesson's katas, the challenge), from the shared flow.
  const katas = useMemo(
    () =>
      buildSequence(data.lesson).flatMap((item) =>
        "kata" in item ? [item.kata] : []
      ),
    [data.lesson]
  )
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      katas.findIndex((k) => k.type === "concept")
    )
  )
  const kata = katas[index]
  const done = index >= katas.length

  const next = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIndex((i) => i + 1)
  }

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: data.lesson.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-4 p-6"
      >
        <Text className="text-xs font-medium text-muted-foreground">
          {done ? "Done" : `Kata ${index + 1} of ${katas.length}`}
        </Text>
        {done ? (
          <Text className="text-lg font-semibold">That&apos;s the lesson.</Text>
        ) : kata?.type === "concept" ? (
          <ConceptKata kata={kata} prepared={data.prepared} />
        ) : kata ? (
          <KataPlaceholder kata={kata} />
        ) : null}
      </ScrollView>
      <View
        className="border-t border-border px-6 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <Button
          size="lg"
          className="rounded-full"
          onPress={next}
          disabled={done}
        >
          <Text>Continue</Text>
        </Button>
      </View>
    </View>
  )
}
