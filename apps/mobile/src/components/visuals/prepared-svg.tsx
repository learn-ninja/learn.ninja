import { useMemo, useState } from "react"
import { View } from "react-native"
import { SvgXml } from "react-native-svg"

import { Text } from "@/components/ui/text"
import { themeSvg } from "@/lib/svg-theme"
import { cn } from "@/lib/utils"

/**
 * A drawing the server made as an SVG string (a chart, a diagram, a molecule), themed for the app
 * (lib/svg-theme.ts) and drawn at the width it has, no wider than its own. Before it's drawn (a
 * lesson without prepared data), the alt stands in. In its own window unless `plain`.
 */
export function PreparedSvg({
  svg,
  alt,
  maxWidth,
  plain = false,
  className,
}: {
  svg: string | undefined
  alt: string
  /** The drawing's widest, in points; the web's max-w-* on the drawing. */
  maxWidth?: number
  plain?: boolean
  className?: string
}) {
  const themed = useMemo(() => (svg ? themeSvg(svg) : null), [svg])
  const [laidOut, setLaidOut] = useState(0)
  const width = themed
    ? Math.min(themed.width, maxWidth ?? Infinity, laidOut || Infinity)
    : 0
  const height = themed ? (width / themed.width) * themed.height : 0
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={alt}
      onLayout={(e) => setLaidOut(e.nativeEvent.layout.width)}
      className={cn(
        "w-full items-center justify-center overflow-hidden",
        !plain &&
          "min-h-72 rounded-xl border border-border bg-background px-4 py-6",
        className
      )}
      style={{ direction: "ltr" }}
    >
      {themed && width > 0 ? (
        <SvgXml
          xml={themed.xml}
          width={width}
          height={height}
          color={themed.color}
        />
      ) : (
        <Text className="px-4 py-6 text-center text-sm text-muted-foreground">
          {alt}
        </Text>
      )}
    </View>
  )
}
