"use client"

import { cn } from "@workspace/ui/lib/utils"

import { AccountLink, useAccount } from "@/components/account/account-link"
import { AccountMenu } from "@/components/account/account-menu"
import type { AccountInfo } from "@/lib/auth/account-info"

import { ButtonLink } from "./button-link"
import { Wordmark } from "./wordmark"

/**
 * The bar at the top of every page. Visitors get Docs · Log in and a wordmark that
 * links home; once logged in, Explore is home, so the wordmark goes there and the links fold
 * into the account menu behind the profile picture (which also opens on hover). `start` adds
 * page-specific controls before the wordmark (the docs menu), `action` a button after it (copy
 * prompt). `account` is what a page that checked the session knows about the user; static pages
 * leave it out and the marker cookie decides after hydration. Until then the visitor's links are
 * kept but invisible, so the header doesn't shift for the many visitors who aren't logged in.
 */
export function SiteHeader({
  start,
  action,
  account: known,
}: {
  start?: React.ReactNode
  action?: React.ReactNode
  /** The logged-in user, or null when nobody is. */
  account?: AccountInfo | null
}) {
  const account = useAccount(known)
  const visitor = account === null || account === undefined
  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex h-14 w-full items-center gap-2 px-4 sm:h-16 sm:px-8">
        {start}
        <Wordmark href={visitor ? "/" : "/explore"} className="me-2" />
        {action}
        <nav aria-label="Site" className="ms-auto flex items-center gap-1">
          {visitor ? (
            <>
              {/* On phones the docs menu (`start`) stands in for this link. */}
              <ButtonLink
                href="/docs"
                variant="ghost"
                size="sm"
                className={cn(start && "max-sm:hidden")}
              >
                Docs
              </ButtonLink>
              <AccountLink account={account} />
            </>
          ) : (
            <AccountMenu account={account} />
          )}
        </nav>
      </div>
    </header>
  )
}
