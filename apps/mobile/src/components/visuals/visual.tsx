import { View } from "react-native"

import type { ChatTurn } from "@workspace/player-core/chat"
import type { Mark } from "@workspace/player-core/check"
import { mathKey } from "@workspace/player-core/prepared"
import { stringsFor } from "@workspace/player-core/strings"
import type { Visual as VisualSpec } from "@workspace/spec"

import { CodeBlock } from "@/components/code-block"
import { useLesson } from "@/components/lesson-context"
import { MathBlock } from "@/components/math"
import { Text } from "@/components/ui/text"
import { VisualFrame } from "@/components/visual-frame"
import { fontSize, LESSON_TEXT_SCALE } from "../../../tokens"

/** Hotspot wiring for interactive visuals: which regions are selected or marked, and what a tap does. */
export interface HotspotControl {
  selected: string[]
  marks: Record<string, Mark>
  onToggle: (id: string) => void
  disabled: boolean
}

/**
 * A lesson visual of any kind, as the web's Visual (packages/player/src/visuals.tsx): HTML in its
 * frame, code, a formula, and the drawn kinds. `plain` leaves off the visual's own window, for a
 * surface that already frames it (an option card's panel).
 */
export function Visual({
  visual,
  hotspots,
  turns,
  label,
  plain = false,
}: {
  visual: VisualSpec
  hotspots?: HotspotControl
  /** On a chat, turns the player adds after the lesson's own: a scenario's pick and its reply. */
  turns?: ChatTurn[]
  label?: string
  plain?: boolean
}) {
  const { prepared, baseCss, mathSvg, lang } = useLesson()
  const t = stringsFor(lang)
  if (visual.kind === "html")
    return (
      <VisualFrame
        html={visual.html}
        css={visual.css}
        alt={visual.alt ?? label}
        height={visual.height}
        baseCss={baseCss}
        visualsCss={prepared.visualsCss}
        plain={plain}
        hotspots={hotspots}
        label={t.picked}
      />
    )
  if (visual.kind === "code")
    return (
      <CodeBlock
        code={visual.code}
        language={visual.language}
        highlight={visual.highlight}
        spots={visual.hotspots}
        hotspots={hotspots}
        prepared={prepared}
        plain={plain}
      />
    )
  if (visual.kind === "math")
    return (
      <MathBlock
        tex={visual.tex}
        math={mathSvg[mathKey(visual.tex, true)]}
        fontSize={fontSize.xl[0] * LESSON_TEXT_SCALE}
        plain={plain}
      />
    )
  void turns
  return <NotPorted what={`The ${visual.kind} visual`} />
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
