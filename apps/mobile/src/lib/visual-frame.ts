import type { WebViewNavigation, WebViewProps } from "react-native-webview"

import { inStyle, VISUAL_CSP } from "@workspace/player-core/visual-frame"

// A lesson's HTML visual in the app: LLM-written HTML in a WebView with scripts off, every
// navigation blocked, and the same Content-Security-Policy as the web's sandboxed frame. Its
// stylesheets are inlined: the visuals' shared one (Basecoat and the theme, fetched once per
// session by visuals-css.ts) and the lesson's prepared utilities. The document is loaded with the
// API's origin as its base URL, so 'self' in that policy is the web app and nothing else.
// visual-frame.test.ts pins all of it; loosen nothing here without a proposal.

/** The visual's whole document. The policy is the first thing in its head. */
export function visualDocument({
  html,
  css,
  height,
  baseCss,
  visualsCss,
}: {
  html: string
  css?: string
  /** The visual's own height: it then fills the frame. Without one it keeps its natural size, to be measured. */
  height?: number
  /** The visuals' shared stylesheet (/lesson-visuals.css), inlined. */
  baseCss: string
  /** The lesson's prepared Tailwind utilities (Prepared.visualsCss). */
  visualsCss: string
}): string {
  return (
    `<!doctype html><html dir="auto" class="dark"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${VISUAL_CSP}">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<style>${inStyle(baseCss)}</style>` +
    `<style>${inStyle(visualsCss)}</style>` +
    `<style>html,body{background:transparent}body{margin:0;padding:16px;display:flex;justify-content:center;align-items:center;box-sizing:border-box${height ? ";min-height:100vh" : ""}}${inStyle(css ?? "")}</style>` +
    `</head><body>${html}</body></html>`
  )
}

type Navigation = Pick<WebViewNavigation, "url"> & {
  isTopFrame?: boolean
  /** iOS only: "click", "formsubmit", "backforward", "reload", "formresubmit", or "other". */
  navigationType?: string
}

/**
 * Lets the document itself load, from its base URL, and blocks every other navigation: links,
 * form posts, frames, any other URL. The document may load again as itself: WebKit reloads it
 * after its content process is killed (memory pressure, backgrounding), and VisualFrame reloads it
 * then too. On iOS a repeat must be a reload, so a meta refresh or link that points at the base
 * URL (which would fetch the web app's page, not this document) stays blocked; Android doesn't say
 * how a navigation started, so there any load of the exact base URL passes. One guard per WebView.
 */
export function navigationGuard(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "")
  let loaded = false
  return (request: Navigation) => {
    if (request.isTopFrame === false) return false
    if (request.url.replace(/\/+$/, "") !== base) return false
    const type = request.navigationType
    if (!loaded) {
      if (type !== undefined && type !== "other" && type !== "reload")
        return false
      loaded = true
      return true
    }
    return type === undefined || type === "reload"
  }
}

/** The WebView's settings, apart from its source and guard. */
export const VISUAL_WEBVIEW_PROPS = {
  javaScriptEnabled: false,
  // Every URL passes the library's own allowlist, so it never hands one to Linking.openURL (Safari);
  // navigationGuard blocks them all instead.
  originWhitelist: ["*"],
  javaScriptCanOpenWindowsAutomatically: false,
  setSupportMultipleWindows: false,
  allowsLinkPreview: false,
  allowFileAccess: false,
  allowFileAccessFromFileURLs: false,
  allowUniversalAccessFromFileURLs: false,
  dataDetectorTypes: "none",
  mediaPlaybackRequiresUserAction: true,
  allowsInlineMediaPlayback: false,
  allowsBackForwardNavigationGestures: false,
  incognito: true,
  cacheEnabled: false,
  scrollEnabled: false,
  bounces: false,
} satisfies Partial<WebViewProps>
