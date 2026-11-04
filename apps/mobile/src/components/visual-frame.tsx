import { useEffect, useMemo, useRef, useState } from "react"
import { Pressable, View } from "react-native"
import { WebView } from "react-native-webview"

import type { HotspotControl } from "@/components/visuals/visual"
import { Text } from "@/components/ui/text"
import { alpha } from "@/lib/color"
import { API_BASE_URL } from "@/lib/config"
import { tap } from "@/lib/haptics"
import { overlaysFor } from "@/lib/spots"
import { cn } from "@/lib/utils"
import {
  navigationGuard,
  VISUAL_WEBVIEW_PROPS,
  visualDocument,
} from "@/lib/visual-frame"
import {
  DEFAULT_VISUAL_HEIGHT,
  useVisualHeight,
  useVisualSpots,
} from "@/lib/visual-height"
import { colors } from "../../tokens"
import { markColor } from "./controls"

/** The document an HTML visual is drawn from, and the base URL it's loaded at. */
export function useVisualSource({
  html,
  css,
  height,
  baseCss,
  visualsCss,
}: {
  html: string
  css?: string
  height?: number
  baseCss: string
  visualsCss: string
}) {
  return useMemo(
    () => ({
      html: visualDocument({ html, css, height, baseCss, visualsCss }),
      baseUrl: `${API_BASE_URL}/`,
    }),
    [html, css, height, baseCss, visualsCss]
  )
}

/** How long every part shows its tile when a hotspot kata arrives. */
const REVEAL_MS = 1800
/** How long a finger holds the stage before the parts show. */
const HOLD_MS = 350

/**
 * A lesson's HTML visual, as the web's HtmlFrame: in its own window (at least 288 points tall, the
 * content in the middle), or `plain` on a surface that already frames it. On a hotspot kata the
 * parts are measured natively and taps land on buttons laid over them, with the picks and marks
 * drawn over the frame (lib/spots.ts).
 */
export function VisualFrame({
  html,
  css,
  alt,
  height,
  baseCss,
  visualsCss,
  plain = false,
  hotspots,
  label,
}: {
  html: string
  css?: string
  alt?: string
  height?: number
  baseCss: string
  visualsCss: string
  plain?: boolean
  hotspots?: HotspotControl
  /** What's picked, in words under the stage (the parts' names), as on the web. */
  label?: (parts: string) => string
}) {
  const source = useVisualSource({ html, css, height, baseCss, visualsCss })
  // The frame's own width once it's laid out: an option card's panel is narrower than the column.
  const [laidOut, setLaidOut] = useState<number | undefined>(undefined)
  const interactive = Boolean(hotspots)
  // Its own height, or its content's (measured natively, with scripts off), capped as on the web.
  const measuredHeight = useVisualHeight(
    source.html,
    source.baseUrl,
    height,
    laidOut
  )
  const spots = useVisualSpots(
    interactive ? source.html : "",
    source.baseUrl,
    laidOut
  )
  const measured = interactive
    ? (spots?.height ?? measuredHeight)
    : measuredHeight
  // A new guard per document: the loads it allows are that document's.
  const guard = useMemo(() => navigationGuard(source.baseUrl), [source])
  // WebView<P> types its props as WebViewProps & P; the default P (undefined) makes them never.
  const ref = useRef<WebView<object>>(null)

  // Every part shows its tile when the kata arrives, and while a finger holds the stage: phones
  // have no hover to find the parts with.
  const [reveal, setReveal] = useState(interactive)
  useEffect(() => {
    if (!interactive) return
    const timer = setTimeout(() => setReveal(false), REVEAL_MS)
    return () => clearTimeout(timer)
  }, [interactive])

  const overlays =
    hotspots && spots
      ? overlaysFor(spots.spots, {
          selected: hotspots.selected,
          marks: hotspots.marks,
          reveal,
        })
      : []
  const picked =
    hotspots && spots
      ? spots.spots
          .filter((s) => hotspots.selected.includes(s.id))
          .map((s) => s.label)
      : []

  const frame = (
    <View
      className="w-full"
      style={{ height: measured ?? DEFAULT_VISUAL_HEIGHT }}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width)
        if (w > 0) setLaidOut(w)
      }}
    >
      {/* Drawn once its height is known, so it doesn't open at one size and jump to another. */}
      {measured === null ? null : (
        <WebView
          {...VISUAL_WEBVIEW_PROPS}
          ref={ref}
          source={source}
          onShouldStartLoadWithRequest={guard}
          // iOS kills a WebView's content process under memory pressure, which leaves it blank;
          // load the same document again.
          onContentProcessDidTerminate={() => ref.current?.reload()}
          style={{ backgroundColor: "transparent", flex: 1 }}
          // The frame is a picture: the buttons over it take the taps on a hotspot.
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      {overlays.map((o) => (
        <View
          key={`${o.id}-${o.kind}`}
          pointerEvents="none"
          className="absolute rounded-md"
          style={{
            top: o.top,
            left: o.left,
            width: o.width,
            height: o.height,
            ...(o.kind === "tile"
              ? { backgroundColor: alpha(colors.foreground, 0.26) }
              : {
                  backgroundColor: alpha(markColor(o.kind), 0.3),
                  borderWidth: 2,
                  borderColor: markColor(o.kind),
                }),
          }}
        />
      ))}
      {hotspots && spots
        ? spots.spots.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              accessibilityState={{
                selected: hotspots.selected.includes(s.id),
                disabled: hotspots.disabled,
              }}
              disabled={hotspots.disabled}
              onPress={() => {
                tap()
                hotspots.onToggle(s.id)
              }}
              className="absolute"
              style={{
                top: s.top,
                left: s.left,
                width: s.width,
                height: s.height,
              }}
            />
          ))
        : null}
    </View>
  )

  const stage = (
    <Pressable
      accessible={!interactive}
      accessibilityRole={interactive ? undefined : "image"}
      accessibilityLabel={alt}
      disabled={!interactive}
      delayLongPress={HOLD_MS}
      onLongPress={interactive ? () => setReveal(true) : undefined}
      onPressOut={interactive ? () => setReveal(false) : undefined}
      className={cn(
        !plain && "min-h-72 justify-center overflow-hidden",
        // A hotspot's visual sits on a filled stage, with no frame around it; the rest in a
        // window on the page's own surface, with room above and below.
        !plain &&
          (interactive
            ? "bg-surface rounded-2xl py-3"
            : "rounded-xl border border-border bg-background py-6")
      )}
    >
      {frame}
    </Pressable>
  )
  if (!hotspots) return stage
  return (
    <View className="gap-3">
      {stage}
      {/* What's picked, in words: confirms the tap, and screen readers hear it. */}
      <Text
        className="text-lesson-sm min-h-5 text-muted-foreground"
        numberOfLines={1}
        accessibilityLiveRegion="polite"
      >
        {picked.length && label ? label(picked.join(", ")) : ""}
      </Text>
    </View>
  )
}
