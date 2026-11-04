import { Link } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"

import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { fetchTestLessons, type TestLesson } from "@/lib/api"

// Phase 0: the test lessons the web app bundles (examples/), listed by GET /api/lessons and
// opened from GET /api/lessons/{slug} without a database. Explore and shared links come later.

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; lessons: TestLesson[] }

export default function Home() {
  const [load, setLoad] = useState<Load>({ state: "loading" })

  useEffect(() => {
    let live = true
    fetchTestLessons()
      .then((lessons) => live && setLoad({ state: "ready", lessons }))
      .catch(
        (e: unknown) =>
          live &&
          setLoad({
            state: "error",
            message:
              e instanceof Error ? e.message : "The lessons didn't load.",
          })
      )
    return () => {
      live = false
    }
  }, [])

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="mx-auto w-full max-w-lg gap-6 p-6"
    >
      <View className="gap-2">
        <Text className="text-2xl font-semibold">Test lessons</Text>
        <Text className="text-sm text-muted-foreground">
          Played from the web app&apos;s API, every kata and visual included.
        </Text>
      </View>
      {load.state === "loading" ? (
        <ActivityIndicator />
      ) : load.state === "error" ? (
        <Text className="text-sm text-muted-foreground">{load.message}</Text>
      ) : (
        <View className="gap-3">
          {load.lessons.map((l) => (
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
      )}
    </ScrollView>
  )
}
