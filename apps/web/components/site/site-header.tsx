"use client"

import * as React from "react"
import type { DayStreak } from "@workspace/player"
import { cn } from "@workspace/ui/lib/utils"

import { AccountLink, useAccount } from "@/components/account/account-link"
import { AccountMenu } from "@/components/account/account-menu"
import { FeedbackButton } from "@/components/feedback/feedback-button"
import { StreakButton } from "@/components/account/streak-button"
import type { AccountInfo } from "@/lib/auth/account-info"
import { sendFinishes } from "@/lib/explore/finishes"

import { ButtonLink } from "./button-link"
import { GitHubStars } from "./github-stars"
import { Wordmark } from "./wordmark"

/**
 * The bar at the top of every page. Visitors get Explore · Docs · Log in and a wordmark that
 * links home; once logged in, Explore is home, so the wordmark goes there and the links fold
 * into the account menu behind the profile picture (which also opens on hover). The GitHub link
 * with its star count leads the links on wider screens. `start` adds
 * page-specific controls before the wordmark (the docs menu), `action` a button after it (copy
 * prompt). `feedback` adds the bug button at the start of the links, for the app's own pages
 * (not the marketing pages or the docs). `streak` puts the logged-in learner's lantern before the picture. `account` is what a
 * page that checked the session knows about the user; static pages
 * leave it out and the marker cookie decides after hydration. Until then the visitor's links are
 * kept but invisible, so the header doesn't shift for the many visitors who aren't logged in.
 * Logged in, it sends the lessons this browser finished while logged out (lib/explore/finishes).
 */
export function SiteHeader({
  start,
  action,
  account: known,
  streak,
  feedback = false,
}: {
  start?: React.ReactNode
  action?: React.ReactNode
  /** The logged-in user, or null when nobody is. */
  account?: AccountInfo | null
  /** The logged-in learner's streak, for pages that know it. */
  streak?: DayStreak | null
  /** Show the bug button: on the app's pages, not on marketing pages or the docs. */
  feedback?: boolean
}) {
  const account = useAccount(known)
  const visitor = account === null || account === undefined
  // Lessons this browser finished logged out, once it's logged in.
  React.useEffect(() => {
    if (!visitor) void sendFinishes()
  }, [visitor])
  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex h-14 w-full items-center gap-2 px-4 sm:h-16 sm:px-8">
        {start}
        <Wordmark href={visitor ? "/" : "/explore"} className="me-2" />
        {action}
        <nav aria-label="Site" className="ms-auto flex items-center gap-1">
          {feedback ? <FeedbackButton /> : null}
          <GitHubStars className="max-sm:hidden" />
          {visitor ? (
            <>
              <ButtonLink href="/explore" variant="ghost" size="sm">
                Explore
              </ButtonLink>
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
            <>
              {streak ? (
                <StreakButton
                  streak={streak}
                  profileHref={
                    account.handle ? `/u/${account.handle}` : undefined
                  }
                />
              ) : null}
              <AccountMenu account={account} />
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
