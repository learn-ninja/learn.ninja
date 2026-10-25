import { LearnLogo } from "@workspace/player/logo"

/** A thin rule with the mark in the middle, between home page sections and above the footer. */
export function LogoDivider() {
  return (
    <div aria-hidden="true" className="flex items-center gap-6">
      <span className="h-px flex-1 bg-border" />
      <LearnLogo className="size-5" />
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
