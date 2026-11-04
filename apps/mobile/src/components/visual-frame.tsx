import { useMemo, useRef } from "react"
import { View } from "react-native"
import { WebView } from "react-native-webview"

import { API_BASE_URL } from "@/lib/config"
import {
  navigationGuard,
  VISUAL_WEBVIEW_PROPS,
  visualDocument,
} from "@/lib/visual-frame"
import { colors } from "../../tokens"

/** How tall an HTML visual is without a height of its own. */
// TODO(phase 1): size the frame to its content. With scripts off the page can't report its
// height, so this needs a native measurement (or a height the server works out at publish time).
const DEFAULT_HEIGHT = 240

export function VisualFrame({
  html,
  css,
  alt,
  height,
  visualsCss,
}: {
  html: string
  css?: string
  alt?: string
  height?: number
  visualsCss: string
}) {
  const source = useMemo(
    () => ({
      html: visualDocument({ html, css, visualsCss }),
      baseUrl: `${API_BASE_URL}/`,
    }),
    [html, css, visualsCss]
  )
  // A new guard per document: the loads it allows are that document's.
  const guard = useMemo(() => navigationGuard(source.baseUrl), [source])
  // WebView<P> types its props as WebViewProps & P; the default P (undefined) makes them never.
  const ref = useRef<WebView<object>>(null)
  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-background"
      style={{ height: height ?? DEFAULT_HEIGHT }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={alt}
    >
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
    </View>
  )
}
