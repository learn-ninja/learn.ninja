"use client"

import * as React from "react"

/**
 * Counts a view each time the lesson page opens: a beacon to the view route, sent after the page
 * is up. Renders nothing. It runs in the browser rather than in the page's render so crawlers and
 * link previews, which fetch the page without running it, aren't counted.
 */
export function ViewBeacon({ id }: { id: string }) {
  // Strict mode runs effects twice on one mount and keeps refs across the two, so this stops a
  // single open counting twice; opening the lesson again mounts a fresh beacon and counts again.
  const sent = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (sent.current === id) return
    sent.current = id
    const url = `/api/lessons/${id}/view`
    if (!navigator.sendBeacon?.(url))
      fetch(url, { method: "POST", keepalive: true }).catch(() => {})
  }, [id])
  return null
}
