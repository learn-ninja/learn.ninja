import { View } from "react-native"

import type { Prepared } from "@workspace/player-core/prepared"
import type {
  ConceptKata as ConceptKataData,
  Kata,
  Visual,
} from "@workspace/spec"

import { CodeBlock } from "@/components/code-block"
import { RichBlocks } from "@/components/rich-text"
import { Text } from "@/components/ui/text"
import { VisualFrame } from "@/components/visual-frame"

/** A concept kata: its title, its visual if it has one, and its body, as the web lays them out. */
export function ConceptKata({
  kata,
  prepared,
  baseCss,
}: {
  kata: ConceptKataData
  prepared: Prepared
  /** The visuals' shared stylesheet. */
  baseCss: string
}) {
  // The web's spacing: 12 points between the title and the body, 24 when a visual sits between.
  return (
    <View className={kata.visual ? "gap-6" : "gap-3"}>
      <Text className="text-lesson-lg font-semibold" accessibilityRole="header">
        {kata.title}
      </Text>
      {kata.visual ? (
        <LessonVisual
          visual={kata.visual}
          prepared={prepared}
          baseCss={baseCss}
        />
      ) : null}
      <RichBlocks text={kata.body} />
    </View>
  )
}

function LessonVisual({
  visual,
  prepared,
  baseCss,
}: {
  visual: Visual
  prepared: Prepared
  baseCss: string
}) {
  if (visual.kind === "html")
    return (
      <VisualFrame
        html={visual.html}
        css={visual.css}
        alt={visual.alt}
        height={visual.height}
        baseCss={baseCss}
        visualsCss={prepared.visualsCss}
      />
    )
  if (visual.kind === "code")
    return (
      <CodeBlock
        code={visual.code}
        language={visual.language}
        prepared={prepared}
      />
    )
  return <NotPorted what={`The ${visual.kind} visual`} />
}

/** Every kata the app can't play yet. */
export function KataPlaceholder({ kata }: { kata: Kata }) {
  return <NotPorted what={`A ${kata.type} kata`} />
}

function NotPorted({ what }: { what: string }) {
  return (
    <View className="gap-1 rounded-xl border border-border bg-card p-4 shadow-xs">
      <Text className="text-sm font-medium">{what}</Text>
      <Text className="text-sm text-muted-foreground">
        Not ported to the app yet.
      </Text>
    </View>
  )
}
