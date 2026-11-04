import { readFileSync } from "node:fs"
import { join } from "node:path"

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
const doc = (
  visual: { html: string; css?: string },
  visualsCss = "",
  baseCss = ""
) => visualDocument({ ...visual, visualsCss, baseCss })

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

  it("loads its own document, and nothing else", () => {
    const guard = navigationGuard(BASE)
    expect(guard({ url: "https://evil.example/", isTopFrame: true })).toBe(
      false
    )
    expect(guard({ url: BASE, isTopFrame: false })).toBe(false)
    expect(
      guard({ url: BASE, isTopFrame: true, navigationType: "click" })
    ).toBe(false)
    expect(
      guard({ url: BASE, isTopFrame: true, navigationType: "other" })
    ).toBe(true)
    for (const url of [
      "http://localhost:3000/docs",
      "http://localhost:3000/?x=1",
      "http://localhost:3001/",
      "https://localhost:3000/",
      "https://learn.ninja/",
      "tel:123",
      "about:blank",
    ])
      for (const navigationType of [undefined, "other", "reload", "click"])
        expect(guard({ url, isTopFrame: true, navigationType })).toBe(false)
  })

  it("loads the same document again after its process is killed, but not by a link or refresh", () => {
    const ios = navigationGuard(BASE)
    expect(ios({ url: BASE, isTopFrame: true, navigationType: "other" })).toBe(
      true
    )
    expect(ios({ url: BASE, isTopFrame: true, navigationType: "reload" })).toBe(
      true
    )
    expect(ios({ url: BASE, isTopFrame: true, navigationType: "reload" })).toBe(
      true
    )
    // A meta refresh or link back to the base URL would fetch the web app's page.
    expect(ios({ url: BASE, isTopFrame: true, navigationType: "other" })).toBe(
      false
    )
    expect(ios({ url: BASE, isTopFrame: true, navigationType: "click" })).toBe(
      false
    )
    expect(
      ios({ url: BASE, isTopFrame: true, navigationType: "formsubmit" })
    ).toBe(false)

    // Android doesn't say how a navigation started: the exact base URL passes, nothing else.
    const android = navigationGuard(BASE)
    expect(android({ url: BASE, isTopFrame: true })).toBe(true)
    expect(android({ url: BASE, isTopFrame: true })).toBe(true)
    expect(android({ url: `${BASE}docs`, isTopFrame: true })).toBe(false)
  })

  it("carries the web frame's policy, first in its head", () => {
    expect(VISUAL_CSP).toMatch(/^default-src 'none';/)
    expect(VISUAL_CSP).toContain("style-src 'self' 'unsafe-inline'")
    expect(VISUAL_CSP).not.toMatch(/https?:|\*|script-src/)
    const d = doc({ html: "<b>Hi</b>" })
    const head = d.slice(0, d.indexOf("<style"))
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
    // Nothing is fetched: both stylesheets are inline.
    expect(d).not.toMatch(/<link|@import|url\(/i)
    expect(d).toContain("<body><b>Hi</b></body></html>")
  })

  it("inlines the shared stylesheet before the lesson's own CSS, each kept inside its tag", () => {
    const d = doc(
      { html: "<b>Hi</b>" },
      ".p-4{padding:1rem}",
      ".btn{color:red}</style><b>x</b>"
    )
    expect(d.indexOf(".btn{color:red}")).toBeLessThan(
      d.indexOf(".p-4{padding:1rem}")
    )
    expect(d).toContain("<style>.btn{color:red}<\\/style><b>x<\\/b></style>")
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

  it("fills its frame only when it declares a height; otherwise it keeps its natural size, to be measured", () => {
    expect(doc({ html: "x" })).not.toContain("min-height")
    expect(
      visualDocument({ html: "x", height: 200, baseCss: "", visualsCss: "" })
    ).toContain("min-height:100vh")
  })
})

describe("the native measurement of an HTML visual", () => {
  const swift = readFileSync(
    join(__dirname, "../../modules/visual-height/ios/VisualHeightModule.swift"),
    "utf8"
  )

  it("lays the document out with the page's scripts off, and adds none to it", () => {
    expect(swift).toContain(
      "config.defaultWebpagePreferences.allowsContentJavaScript = false"
    )
    expect(swift).toContain(
      "config.preferences.javaScriptCanOpenWindowsAutomatically = false"
    )
    expect(swift).toContain("config.websiteDataStore = .nonPersistent()")
    // Nothing joins the page: no user scripts, no messages back from it.
    expect(swift).not.toMatch(
      /WKUserScript|addScriptMessageHandler|userContentController|evaluateJavaScript/
    )
  })

  it("reads the height with one expression in WebKit's isolated world, after the load", () => {
    const calls = [...swift.matchAll(/callAsyncJavaScript\(([\s\S]*?)\)\s*\{/g)]
    expect(calls).toHaveLength(1)
    expect(calls[0]![1]).toContain(
      '"return document.body.getBoundingClientRect().height"'
    )
    expect(calls[0]![1]).toContain("in: .defaultClient")
    expect(swift.indexOf("callAsyncJavaScript")).toBeGreaterThan(
      swift.indexOf("didFinish navigation")
    )
  })

  it("lets the document load once, as itself, and blocks every other navigation", () => {
    expect(swift).toContain("decisionHandler(own ? .allow : .cancel)")
    expect(swift).toMatch(/let own = !loaded\s/)
    expect(swift).toContain("navigationAction.navigationType == .other")
    expect(swift).toContain("navigationAction.targetFrame?.isMainFrame == true")
  })
})
