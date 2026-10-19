"use client"

import * as React from "react"

/** The key under which a browser remembers playing a lesson today. */
export const playedKey = (id: string) => `learn.played.${id}`

/**
 * Counts a play once per browser per lesson per day: a beacon to the play route, sent after the
 * page is up and remembered in localStorage so a reload doesn't count again. Renders nothing.
 */
export function PlayBeacon({ id }: { id: string }) {
  React.useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    try {
      if (localStorage.getItem(playedKey(id)) === today) return
      localStorage.setItem(playedKey(id), today)
    } catch {
      // Private mode or storage off: count the play anyway.
    }
    const url = `/api/lessons/${id}/play`
    if (!navigator.sendBeacon?.(url))
      fetch(url, { method: "POST", keepalive: true }).catch(() => {})
  }, [id])
  return null
}
