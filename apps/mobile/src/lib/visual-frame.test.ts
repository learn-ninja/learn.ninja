import { describe, expect, it } from "vitest"

import { VISUAL_CSP } from "@workspace/player-core/visual-frame"

import {
  navigationGuard,
  VISUAL_WEBVIEW_PROPS,
  visualDocument,
} from "./visual-frame"

// The HTML visual's WebView is the only place lesson content touches the app, so its shape is
// pinned here, as packages/player/src/visuals.test.ts pins the web's iframe.

const BASE = "http://localhost:3000/"
const doc = (visual: { html: string; css?: string }, visualsCss = "") =>
  visualDocument({ ...visual, visualsCss })

describe("HTML visual WebView", () => {
  it("runs no scripts and opens no windows", () => {
    expect(VISUAL_WEBVIEW_PROPS.javaScriptEnabled).toBe(false)
    expect(VISUAL_WEBVIEW_PROPS.javaScriptCanOpenWindowsAutomatically).toBe(
      false
    )
    expect(VISUAL_WEBVIEW_PROPS.setSupportMultipleWindows).toBe(false)
    expect(VISUAL_WEBVIEW_PROPS).not.toHaveProperty("injectedJavaScript")
    expect(VISUAL_WEBVIEW_PROPS).not.toHaveProperty(
      "injectedJavaScriptBeforeContentLoaded"
    )
    expect(VISUAL_WEBVIEW_PROPS).not.toHaveProperty("onMessage")
  })

  it("hands no URL to the system: every one passes the library's allowlist, and the guard blocks it", () => {
    // A URL outside originWhitelist goes to Linking.openURL (Safari), so the list must allow all.
    expect(VISUAL_WEBVIEW_PROPS.originWhitelist).toEqual(["*"])
    expect(VISUAL_WEBVIEW_PROPS.allowsLinkPreview).toBe(false)
    expect(VISUAL_WEBVIEW_PROPS.dataDetectorTypes).toBe("none")
    expect(VISUAL_WEBVIEW_PROPS.allowFileAccess).toBe(false)
    expect(VISUAL_WEBVIEW_PROPS.allowUniversalAccessFromFileURLs).toBe(false)
  })

  it("loads its own document once and blocks every navigation after it", () => {
    const guard = navigationGuard(BASE)
    expect(guard({ url: "https://evil.example/", isTopFrame: true })).toBe(
      false
    )
    expect(guard({ url: BASE, isTopFrame: false })).toBe(false)
    expect(guard({ url: BASE, isTopFrame: true })).toBe(true)
    // A link, a meta refresh, or a form, even back to the base URL.
    expect(guard({ url: BASE, isTopFrame: true })).toBe(false)
    expect(guard({ url: "http://localhost:3000/docs", isTopFrame: true })).toBe(
      false
    )
    expect(guard({ url: "tel:123", isTopFrame: true })).toBe(false)
  })

  it("carries the web frame's policy, first in its head", () => {
    expect(VISUAL_CSP).toMatch(/^default-src 'none';/)
    expect(VISUAL_CSP).toContain("style-src 'self' 'unsafe-inline'")
    expect(VISUAL_CSP).not.toMatch(/https?:|\*|script-src/)
    const d = doc({ html: "<b>Hi</b>" })
    const head = d.slice(0, d.indexOf("<link"))
    expect(head).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${VISUAL_CSP}">`
    )
    expect(head.indexOf("Content-Security-Policy")).toBeLessThan(
      head.indexOf("viewport")
    )
  })

  it("is dark, takes its direction from its content, and adds no script of its own", () => {
    const d = doc({ html: "<b>Hi</b>" })
    expect(d).toMatch(/^<!doctype html><html dir="auto" class="dark">/)
    expect(d).not.toMatch(/<script/i)
    expect(d).toContain("<body><b>Hi</b></body></html>")
  })

  it("inlines the prepared CSS and keeps it, and the lesson's CSS, inside their style tags", () => {
    const evil = `b{color:red}</style><meta http-equiv="refresh" content="0;url=https://evil.example">`
    const d = doc(
      { html: "<b>Hi</b>", css: evil },
      `.p-4{padding:1rem}</style><script>x</script>`
    )
    expect(d).toContain(
      "<style>.p-4{padding:1rem}<\\/style><script>x<\\/script></style>"
    )
    expect(d).not.toContain('</style><meta http-equiv="refresh"')
    expect(d).toContain('<\\/style><meta http-equiv="refresh"')
    expect(d).toContain("<body><b>Hi</b></body></html>")
  })
})
