import { Link, Stack } from "expo-router"
import { useEffect, useState } from "react"
import { ScrollView, View } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { DirectionProvider } from "@/components/direction"
import { Failed, LTR } from "@/components/explore/list-parts"
import { SavedLessons } from "@/components/explore/saved-lessons"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { fetchTestLessons, type TestLesson } from "@/lib/api"
import { OfflineError } from "@/lib/api-fetch"
import { useAppStrings } from "@/lib/use-strings"

// The Dev tab, only in development builds (the tabs layout hides it otherwise): the test lessons
// the web app bundles (examples/), to play without an account or a database.

export default function Dev() {
  const { t, dir } = useAppStrings()
  return (
    <DirectionProvider value={dir}>
      <Stack.Screen options={{ title: "Dev" }} />
      <ScrollView
        className="flex-1"
        style={LTR}
        contentContainerStyle={{ direction: dir }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="grow px-4 pb-12"
      >
        <TestLessons t={t} />
      </ScrollView>
    </DirectionProvider>
  )
}

/**
 * The lessons the web app bundles, opened from GET /api/lessons/{slug} without a database. When
 * they don't load, it says why (the server out of reach, or failing) with a way to ask again.
 */
function TestLessons({ t }: { t: Strings }) {
  const [lessons, setLessons] = useState<
    TestLesson[] | { error: "offline" | "failed" } | null
  >(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setLessons(null)
    fetchTestLessons()
      .then((l) => live && setLessons(l))
      .catch(
        (e: unknown) =>
          live &&
          setLessons({
            error: e instanceof OfflineError ? "offline" : "failed",
          })
      )
    return () => {
      live = false
    }
  }, [attempt])
  if (lessons && "error" in lessons)
    return (
      <>
        <Failed
          message={lessons.error === "offline" ? t.offline : t.feed.failed}
          retry={{ label: t.tryAgain, onPress: () => setAttempt((n) => n + 1) }}
        />
        {lessons.error === "offline" ? <SavedLessons t={t} /> : null}
      </>
    )
  if (!lessons?.length) return null
  return (
    <View className="gap-3 pt-4">
      <Text className="text-sm font-medium text-muted-foreground">
        {t.feed.testLessons}
      </Text>
      {lessons.map((l) => (
        <Link
          key={l.slug}
          href={{ pathname: "/l/[slugId]", params: { slugId: l.slug } }}
          asChild
        >
          <Button variant="outline" size="lg" className="justify-start">
            <Text numberOfLines={1}>{l.title}</Text>
          </Button>
        </Link>
      ))}
    </View>
  )
}
