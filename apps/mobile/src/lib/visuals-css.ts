import { API_BASE_URL } from "./config"

// The stylesheet every HTML visual loads first (Basecoat and the theme, /lesson-visuals.css on the
// web), fetched once per version for the app's whole session and inlined into each visual's
// document: the WebViews themselves don't cache (they're incognito), so a <link> would fetch it
// again for every kata.

const loaded = new Map<string, Promise<string>>()

/** The stylesheet at `path` (versioned: /lesson-visuals.css?v={hash}), fetched once. */
export function loadVisualsCss(
  path: string,
  base = API_BASE_URL
): Promise<string> {
  const url = new URL(path, `${base}/`).toString()
  const cached = loaded.get(url)
  if (cached) return cached
  const promise = fetch(url).then((res) => {
    if (!res.ok)
      throw new Error(`The visuals' stylesheet didn't load (${res.status}).`)
    return res.text()
  })
  loaded.set(url, promise)
  // A failed fetch isn't kept: the next lesson tries again.
  promise.catch(() => {
    if (loaded.get(url) === promise) loaded.delete(url)
  })
  return promise
}
