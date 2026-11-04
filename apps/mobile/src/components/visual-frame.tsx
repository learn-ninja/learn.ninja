import { useMemo, useRef } from "react"
import { View } from "react-native"
import { WebView } from "react-native-webview"

import { API_BASE_URL } from "@/lib/config"
import {
  navigationGuard,
  VISUAL_WEBVIEW_PROPS,
  visualDocument,
} from "@/lib/visual-frame"
import { DEFAULT_VISUAL_HEIGHT, useVisualHeight } from "@/lib/visual-height"
import { colors } from "../../tokens"

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

export function VisualFrame({
  html,
  css,
  alt,
  height,
  baseCss,
  visualsCss,
}: {
  html: string
  css?: string
  alt?: string
  height?: number
  baseCss: string
  visualsCss: string
}) {
  const source = useVisualSource({ html, css, height, baseCss, visualsCss })
  // Its own height, or its content's (measured natively, with scripts off), capped as on the web.
  const measured = useVisualHeight(source.html, source.baseUrl, height)
  // A new guard per document: the loads it allows are that document's.
  const guard = useMemo(() => navigationGuard(source.baseUrl), [source])
  // WebView<P> types its props as WebViewProps & P; the default P (undefined) makes them never.
  const ref = useRef<WebView<object>>(null)
  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-background"
      style={{ height: (measured ?? DEFAULT_VISUAL_HEIGHT) + 2 }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={alt}
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
          style={{ backgroundColor: colors.background }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  )
}
