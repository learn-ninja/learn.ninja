import { Link } from "expo-router"
import { ScrollView, View } from "react-native"

import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

// Phase 0: the bundled test lessons from examples/, which the web app serves at
// GET /api/lessons/{slug} without a database. Explore and shared links come later.
const TEST_LESSONS = [
  { slug: "button-hierarchy", title: "Button hierarchy" },
  { slug: "map-vs-foreach", title: "map vs forEach" },
  { slug: "compound-interest", title: "Compound interest" },
  { slug: "spanish-greetings", title: "Spanish greetings" },
] as const

export default function Home() {
  return (
    <ScrollView contentContainerClassName="mx-auto w-full max-w-lg gap-6 p-6">
      <View className="gap-2">
        <Text className="text-2xl font-semibold">Test lessons</Text>
        <Text className="text-sm text-muted-foreground">
          Played from the web app&apos;s API. Only concept katas are ported so
          far.
        </Text>
      </View>
      <View className="gap-3">
        {TEST_LESSONS.map((l) => (
          <Link
            key={l.slug}
            href={{ pathname: "/l/[slugId]", params: { slugId: l.slug } }}
            asChild
          >
            <Button variant="outline" size="lg" className="justify-start">
              <Text>{l.title}</Text>
            </Button>
          </Link>
        ))}
      </View>
    </ScrollView>
  )
}
