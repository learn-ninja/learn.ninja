import type { WebViewNavigation, WebViewProps } from "react-native-webview"

import { inStyle, VISUAL_CSP } from "@workspace/player-core/visual-frame"

// A lesson's HTML visual in the app: LLM-written HTML in a WebView with scripts off, every
// navigation blocked, and the same Content-Security-Policy as the web's sandboxed frame. The
// document is loaded with the API's origin as its base URL, so 'self' in that policy is the web
// app: the visuals' stylesheet (/lesson-visuals.css, Basecoat and the theme) loads from there and
// nothing else does. visual-frame.test.ts pins all of it; loosen nothing here without a proposal.

/** The visual's whole document. The policy is the first thing in its head. */
export function visualDocument({
  html,
  css,
  visualsCss,
}: {
  html: string
  css?: string
  /** The lesson's prepared Tailwind utilities (Prepared.visualsCss). */
  visualsCss: string
}): string {
  return (
    `<!doctype html><html dir="auto" class="dark"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${VISUAL_CSP}">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<link rel="stylesheet" href="/lesson-visuals.css">` +
    `<style>${inStyle(visualsCss)}</style>` +
    `<style>html,body{background:transparent}body{margin:0;padding:16px;display:flex;justify-content:center;align-items:center;box-sizing:border-box;min-height:100vh}${inStyle(css ?? "")}</style>` +
    `</head><body>${html}</body></html>`
  )
}

/**
 * Lets the document itself load once, from its base URL, and blocks everything after it: links,
 * form posts, meta refreshes, frames. One guard per WebView.
 */
export function navigationGuard(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "")
  let loaded = false
  return (
    request: Pick<WebViewNavigation, "url"> & { isTopFrame?: boolean }
  ) => {
    const first =
      !loaded &&
      request.isTopFrame !== false &&
      request.url.replace(/\/+$/, "") === base
    if (first) loaded = true
    return first
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
