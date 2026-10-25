import Link from "next/link"

import { LearnLogo } from "@workspace/player/logo"
import { cn } from "@workspace/ui/lib/utils"

import { SITE } from "@/lib/site"

/** The logo and the lowercase name, linking home (or wherever `href` says). */
export function Wordmark({
  href = "/",
  className,
}: {
  href?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md text-base font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      {/* The same 28px box and 22px mark as the player header's home button, so the two line up. */}
      <span className="grid size-7 shrink-0 place-items-center self-center">
        <LearnLogo className="size-5.5" />
      </span>
      {SITE.name}
    </Link>
  )
}
