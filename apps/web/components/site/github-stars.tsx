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

/** The header's link to the repository, with its star count once /api/github/stars answers. */
export function GitHubStars({ className }: { className?: string }) {
  const [stars, setStars] = React.useState<number | null>(null)
  React.useEffect(() => {
    let live = true
    fetch("/api/github/stars")
      .then((reply) => (reply.ok ? reply.json() : null))
      .then((data: { stars?: number | null } | null) => {
        if (live && typeof data?.stars === "number") setStars(data.stars)
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
