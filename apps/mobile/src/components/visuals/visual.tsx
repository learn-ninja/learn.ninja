import { View } from "react-native"

import type { ChatTurn } from "@workspace/player-core/chat"
import type { Mark } from "@workspace/player-core/check"
import { countryName } from "@workspace/player-core/country-names"
import {
  chartKey,
  diagramKey,
  mathKey,
  moleculeKey,
} from "@workspace/player-core/prepared"
import { stringsFor } from "@workspace/player-core/strings"
import type { Visual as VisualSpec } from "@workspace/spec"

import { CodeBlock } from "@/components/code-block"
import { useLesson } from "@/components/lesson-context"
import { MathBlock } from "@/components/math"
import { Text } from "@/components/ui/text"
import { VisualFrame } from "@/components/visual-frame"
import { cn } from "@/lib/utils"
import { useLessonTextScale } from "@/components/text-size"
import { fontSize } from "../../../tokens"

import { ChatBlock } from "./chat"
import { ChessBoard } from "./chess"
import { Clock, Fractions, NumberLine } from "./figures"
import { WorldMap } from "./map"
import { PreparedSvg } from "./prepared-svg"

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
  width,
}: {
  visual: VisualSpec
  hotspots?: HotspotControl
  /** On a chat, turns the player adds after the lesson's own: a scenario's pick and its reply. */
  turns?: ChatTurn[]
  label?: string
  plain?: boolean
  /** The width an HTML visual is laid out at, when its place fixes it (an order item). */
  width?: number
}) {
  const { prepared, baseCss, mathSvg, lang } = useLesson()
  const scale = useLessonTextScale()
  const t = stringsFor(lang)
  const alt = ("alt" in visual ? visual.alt : undefined) ?? label ?? t.visual
  switch (visual.kind) {
    case "html":
      return (
        <VisualFrame
          html={visual.html}
          css={visual.css}
          alt={alt}
          height={visual.height}
          baseCss={baseCss}
          visualsCss={prepared.visualsCss}
          plain={plain}
          hotspots={hotspots}
          label={t.picked}
          width={width}
        />
      )
    case "code":
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
    case "math":
      return (
        <MathBlock
          tex={visual.tex}
          math={mathSvg[mathKey(visual.tex, true)]}
          fontSize={fontSize.xl[0] * scale}
          plain={plain}
        />
      )
    case "chart":
      // The server draws charts at two sizes: full, and compact for the cards, which show them plain.
      return (
        <PreparedSvg
          svg={prepared.charts?.[chartKey(visual, plain)]}
          alt={alt}
          maxWidth={plain ? 320 : 480}
          plain={plain}
        />
      )
    case "diagram":
      return (
        <PreparedSvg
          svg={prepared.diagrams?.[diagramKey(visual.d2)]}
          alt={alt}
          plain={plain}
        />
      )
    case "molecule":
      return (
        <PreparedSvg
          svg={prepared.molecules?.[moleculeKey(visual)]}
          alt={alt}
          maxWidth={plain ? 320 : undefined}
          plain={plain}
        />
      )
    case "numberline":
    case "fraction":
    case "clock":
      return (
        <Figure alt={alt} plain={plain}>
          {visual.kind === "numberline" ? (
            <NumberLine line={visual} maxWidth={plain ? 320 : 480} />
          ) : visual.kind === "fraction" ? (
            <Fractions
              figure={visual}
              maxWidth={
                visual.shape === "circle"
                  ? plain
                    ? 320
                    : [160, 320, 448, 576][visual.fractions.length - 1]!
                  : plain
                    ? 320
                    : 480
              }
            />
          ) : (
            <Clock clock={visual} maxWidth={plain ? 128 : 240} />
          )}
        </Figure>
      )
    case "chess":
      return (
        <TappableStage
          alt={alt}
          hotspots={hotspots}
          plain={plain}
          name={(s) => s}
          picked={t.picked}
        >
          <View className={cn("w-full", plain ? "max-w-40" : "max-w-sm")}>
            <ChessBoard board={visual} plain={plain} hotspots={hotspots} />
          </View>
        </TappableStage>
      )
    case "map":
      return (
        <TappableStage
          alt={alt}
          hotspots={hotspots}
          plain={plain}
          name={(code) => countryName(code, lang)}
          picked={t.picked}
        >
          <View className={cn("w-full", plain && "max-w-xs")}>
            <WorldMap map={visual} plain={plain} hotspots={hotspots} />
          </View>
        </TappableStage>
      )
    case "chat":
      return <ChatBlock chat={visual} extra={turns} label={alt} plain={plain} />
  }
}

/** A small math figure, in the box charts use. */
function Figure({
  alt,
  plain,
  children,
}: {
  alt: string
  plain: boolean
  children: React.ReactNode
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={alt}
      className={cn(
        "w-full items-center justify-center",
        !plain &&
          "min-h-72 rounded-xl border border-border bg-background px-4 py-6"
      )}
      style={{ direction: "ltr" }}
    >
      {children}
    </View>
  )
}

/**
 * A drawing whose every part can be tapped on a hotspot (a board's squares, a map's countries).
 * There it's a group on a filled stage, like an HTML hotspot's visual, with the parts picked named
 * under it: that confirms the tap, and screen readers hear it. Elsewhere it's an image in a box.
 */
function TappableStage({
  alt,
  hotspots,
  plain,
  name,
  picked,
  children,
}: {
  alt: string
  hotspots?: HotspotControl
  plain: boolean
  /** A picked part's name, from its id. */
  name: (id: string) => string
  picked: (parts: string) => string
  children: React.ReactNode
}) {
  const block = (
    <View
      accessible={!hotspots}
      accessibilityRole={hotspots ? undefined : "image"}
      accessibilityLabel={alt}
      className={cn(
        "w-full items-center justify-center",
        !plain &&
          (hotspots
            ? "bg-surface min-h-72 rounded-2xl px-4 py-6"
            : "min-h-72 rounded-xl border border-border bg-background px-4 py-6")
      )}
      style={{ direction: "ltr" }}
    >
      {children}
    </View>
  )
  if (!hotspots) return block
  return (
    <View className="gap-3">
      {block}
      <Text
        className="text-lesson-sm min-h-5 text-muted-foreground"
        numberOfLines={1}
        accessibilityLiveRegion="polite"
      >
        {hotspots.selected.length
          ? picked(hotspots.selected.map(name).join(", "))
          : ""}
      </Text>
    </View>
  )
}
