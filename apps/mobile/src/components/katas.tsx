import { View } from "react-native"

import type { ConceptKata as ConceptKataData } from "@workspace/spec"

import { RichBlocks } from "@/components/rich-text"
import { Text } from "@/components/ui/text"
import { Visual } from "@/components/visuals/visual"

/** A concept kata: its title, its visual if it has one, and its body, as the web lays them out. */
export function ConceptKata({
  kata,
  steps,
}: {
  kata: ConceptKataData
  /** A stepped concept: how many steps of the body to show so far. */
  steps?: number
}) {
  // The web's spacing: 12 points between the title and the body, 24 when a visual sits between.
  return (
    <View className={kata.visual ? "gap-6" : "gap-3"}>
      <Text className="text-lesson-lg font-semibold" accessibilityRole="header">
        {kata.title}
      </Text>
      {kata.visual ? <Visual visual={kata.visual} /> : null}
      <RichBlocks text={kata.body} steps={kata.stepped ? steps : undefined} />
    </View>
  )
}
