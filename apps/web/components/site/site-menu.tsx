"use client"

import * as React from "react"
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  BugIcon,
  CompassIcon,
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
  UserRoundIcon,
} from "lucide-react"

import { Button, LinkButton } from "@workspace/ui/components/button"
import { Sheet, SheetTitle } from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"

import type { Account } from "@/components/account/account-link"
import { logOutAndLeave } from "@/components/account/log-out-button"
import { UserAvatar } from "@/components/account/user-avatar"
import { FeedbackDialog } from "@/components/feedback/feedback-dialog"
import { accountApi, type AccountApi } from "@/lib/auth/browser"
import { SITE } from "@/lib/site"

import { LivelyLogo } from "./lively-logo"

/** A drawer row: a ghost button the width of the drawer, 44px tall for a thumb, its icon first. */
const ROW =
  "h-11 w-full justify-start gap-2.5 px-3 [&_svg:not([class*='size-'])]:size-4"

/**
 * The header's menu on phones, where its links don't fit beside the wordmark: a button at the end
 * of the header that opens a drawer from the same side. A visitor's drawer holds the header's
 * links (Explore, Docs) and Log in; a logged-in learner's holds what the profile picture's menu
 * holds on wider screens (Explore, their profile, settings, the docs in a new tab) and Log out.
 * On the app's pages (`feedback`) both get the bug report too; the GitHub link stays in the
 * header. Following a link or opening the bug report closes it. The trigger only shows below
 * `sm`; the drawer itself isn't tied to a breakpoint, so stories open it anywhere with
 * `defaultOpen`.
 */
export function SiteMenu({
  account,
  feedback = false,
  api = accountApi,
  navigate,
  defaultOpen = false,
  className,
}: {
  account: Account
  /** Add "Report a bug", on the app's pages (not the marketing pages or the docs). */
  feedback?: boolean
  api?: AccountApi
  /** Where to go after logging out; the browser's own navigation by default. */
  navigate?: (to: string) => void
  /** For stories: start with the drawer open. */
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [reporting, setReporting] = React.useState(false)
  const close = () => setOpen(false)
  // Until the marker cookie is read nobody is logged in; the drawer only opens after that anyway.
  const user = account ?? null
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label="Menu"
        className={cn("sm:hidden", className)}
        onPress={() => setOpen(true)}
      >
        <MenuIcon />
      </Button>
      <Sheet side="end" isOpen={open} onOpenChange={setOpen}>
        <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
          {/* Room at the end for the close button. */}
          <SheetTitle className="flex h-11 items-center gap-2.5 px-3 pe-10">
            {user ? (
              <>
                <UserAvatar
                  image={user.image}
                  handle={user.handle}
                  size="header"
                />
                <bdi dir="ltr" className="truncate">
                  {user.handle ? `@${user.handle}` : "Account"}
                </bdi>
              </>
            ) : (
              <>
                <span className="grid size-7 shrink-0 place-items-center">
                  <LivelyLogo className="size-5.5" />
                </span>
                {SITE.name}
              </>
            )}
          </SheetTitle>
          <nav aria-label="Site" className="flex flex-col gap-1">
            <Row href="/explore" onPress={close}>
              <CompassIcon />
              Explore
            </Row>
            {user ? (
              <>
                {user.handle ? (
                  <Row href={`/u/${user.handle}`} onPress={close}>
                    <UserRoundIcon />
                    Profile
                  </Row>
                ) : null}
                <Row href="/settings" onPress={close}>
                  <SettingsIcon />
                  Settings
                </Row>
                {/* In a new tab, as in the picture's menu: the docs aren't part of the app. */}
                <Row href="/docs" target="_blank" onPress={close}>
                  <BookOpenIcon />
                  Docs
                  <Away />
                </Row>
              </>
            ) : (
              <Row href="/docs" onPress={close}>
                <BookOpenIcon />
                Docs
              </Row>
            )}
            {feedback ? (
              <Button
                variant="ghost"
                className={ROW}
                onPress={() => {
                  close()
                  setReporting(true)
                }}
              >
                <BugIcon />
                Report a bug
              </Button>
            ) : null}
          </nav>
          <div className="mt-auto flex flex-col pt-2">
            {user ? (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onPress={() => void logOutAndLeave(api, navigate)}
              >
                <LogOutIcon />
                Log out
              </Button>
            ) : (
              <LinkButton
                href="/login"
                variant="default"
                size="lg"
                className="w-full"
                onPress={close}
              >
                Log in
              </LinkButton>
            )}
          </div>
        </div>
      </Sheet>
      {feedback ? (
        <FeedbackDialog isOpen={reporting} onOpenChange={setReporting} />
      ) : null}
    </>
  )
}

/** A link row. React Aria's link goes through Next's router (ClientRouter), so pages don't reload. */
function Row({
  className,
  ...props
}: Omit<React.ComponentProps<typeof LinkButton>, "variant" | "size">) {
  return (
    <LinkButton variant="ghost" className={cn(ROW, className)} {...props} />
  )
}

/** The arrow that marks a row opening in a new tab. */
function Away() {
  return (
    <ArrowUpRightIcon
      className="ms-auto size-3.5 text-muted-foreground rtl:-scale-x-100"
      aria-hidden="true"
    />
  )
}
