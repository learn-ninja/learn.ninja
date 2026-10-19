"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

import { AGENT_PROMPT, HERO_CTA_ID } from "@/lib/site"

import { CopyButton } from "./copy-button"

/**
 * A small "Copy prompt for agent" for the header. With `afterHero` (the home page) it
 * shows only once the hero's own button has scrolled under the header.
 */
export function HeaderCopyPrompt({
  afterHero = false,
}: {
  afterHero?: boolean
}) {
  const [shown, setShown] = React.useState(!afterHero)

  React.useEffect(() => {
    if (!afterHero) return
    const target = document.getElementById(HERO_CTA_ID)
    if (!target) return
    const top = document.querySelector("header")?.offsetHeight ?? 0
    const observer = new IntersectionObserver(
      ([entry]) =>
        setShown(!entry!.isIntersecting && entry!.boundingClientRect.top < top),
      { rootMargin: `-${top}px 0px 0px 0px` }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [afterHero])

  return (
    <div
      inert={!shown}
      className={cn(
        "shrink-0 transition-[opacity,translate] duration-200",
        !shown && "pointer-events-none opacity-0 motion-safe:translate-y-2"
      )}
    >
      <CopyButton text={AGENT_PROMPT} variant="ghost" size="sm">
        <span className="sm:hidden">Copy prompt</span>
        <span className="max-sm:hidden">Copy prompt for agent</span>
      </CopyButton>
    </div>
  )
}
