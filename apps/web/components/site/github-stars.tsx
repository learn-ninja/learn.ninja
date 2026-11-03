"use client"

import * as React from "react"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { SITE } from "@/lib/site"

import { GitHubLogo } from "./social-icons"

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

// The header is part of each page, not a shared layout, so the counter remounts on every
// navigation. The count is kept here for the page's lifetime and in sessionStorage for the
// tab's, so it's there on the first render instead of popping in after each fetch.
let known: number | null = null
const STORAGE_KEY = "learn.ninja:stars"

function remembered(): number | null {
  if (known !== null) return known
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const count = raw === null ? NaN : Number(raw)
    if (Number.isFinite(count)) known = count
  } catch {
    // Storage may be unavailable; the fetch still fills it in.
  }
  return known
}

function remember(count: number) {
  known = count
  try {
    sessionStorage.setItem(STORAGE_KEY, String(count))
  } catch {
    // Fine without it.
  }
}

/** The header's link to the repository, with its star count once /api/github/stars answers. */
export function GitHubStars({ className }: { className?: string }) {
  // `known` is null on the server and on a fresh page load, so the first render matches.
  const [stars, setStars] = React.useState<number | null>(() => known)
  React.useEffect(() => {
    const stored = remembered()
    if (stored !== null) {
      setStars(stored)
      return
    }
    let live = true
    fetch("/api/github/stars")
      .then((reply) => (reply.ok ? reply.json() : null))
      .then((data: { stars?: number | null } | null) => {
        if (typeof data?.stars !== "number") return
        remember(data.stars)
        if (live) setStars(data.stars)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  return (
    <a
      href={SITE.repo}
      target="_blank"
      rel="noreferrer"
      data-slot="button"
      aria-label={
        stars === null ? "GitHub" : `GitHub, ${stars.toLocaleString("en")} stars`
      }
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "tabular-nums [&_svg]:size-4",
        className
      )}
    >
      <GitHubLogo />
      {stars === null ? null : <span>{compact.format(stars)}</span>}
    </a>
  )
}
