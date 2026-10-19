import { cn } from "@workspace/ui/lib/utils"

import { AccountLink } from "@/components/account/account-link"

import { ButtonLink } from "./button-link"
import { Wordmark } from "./wordmark"

/**
 * The bar at the top of every page. `start` adds page-specific controls before the
 * wordmark (the docs menu), `action` a button after it (copy prompt). `handle` is what a page
 * that checked the session knows about the user; static pages leave it out and the account link
 * reads a cookie instead.
 */
export function SiteHeader({
  start,
  action,
  handle,
}: {
  start?: React.ReactNode
  action?: React.ReactNode
  handle?: string | null
}) {
  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex h-14 w-full items-center gap-2 px-4 sm:h-16 sm:px-8">
        {start}
        <Wordmark className="me-2" />
        {action}
        {/* On phones the docs menu (`start`) stands in for this link. */}
        <ButtonLink
          href="/docs"
          variant="outline"
          size="sm"
          className={cn("ms-auto", start && "max-sm:hidden")}
        >
          Docs
        </ButtonLink>
        <AccountLink handle={handle} className={cn(start && "max-sm:ms-auto")} />
      </div>
    </header>
  )
}
