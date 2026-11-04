// What every player puts around a lesson's HTML visual, whatever frame it uses (a sandboxed iframe
// on the web, a WebView with scripts off in the app).

/**
 * The frame's own Content-Security-Policy, first in its head. The lesson page's header policy only
 * covers a page loaded from a lesson URL, not one reached by an in-app link, so the frame carries
 * one too: same-origin styles, images, and fonts, and nothing else.
 */
export const VISUAL_CSP =
  "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:"

/** Keeps CSS inside its <style>: "</" would otherwise end the tag and inject markup. A CSS "\/" still means "/". */
export const inStyle = (css: string) => css.replace(/<\//g, "<\\/")
