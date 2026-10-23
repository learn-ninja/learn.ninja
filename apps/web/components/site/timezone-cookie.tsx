"use client"

import * as React from "react"

/** The cookie that carries the browser's IANA time zone, so the server can tell what day it is for the viewer. */
export const TZ_COOKIE = "tz"

/**
 * Remembers the browser's time zone in a cookie, the way GitHub does for its contribution graph:
 * the profile's activity grid ends on the viewer's today, and a completion recorded without an
 * explicit zone falls back to it. Renders nothing.
 */
export function TimezoneCookie() {
  React.useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!tz) return
      const value = `${TZ_COOKIE}=${encodeURIComponent(tz)}`
      if (document.cookie.split("; ").includes(value)) return
      document.cookie = `${value}; path=/; max-age=31536000; samesite=lax`
    } catch {
      // No Intl time zone support: the server keeps using UTC.
    }
  }, [])
  return null
}
