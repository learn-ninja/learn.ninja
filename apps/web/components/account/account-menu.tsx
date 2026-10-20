"use client"

import * as React from "react"
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  CompassIcon,
  LibraryIcon,
  LogOutIcon,
  SettingsIcon,
  UserRoundIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import type { AccountInfo } from "@/lib/auth/account-info"
import { accountApi, type AccountApi } from "@/lib/auth/browser"

import { signOutAndLeave } from "./sign-out-button"
import { UserAvatar } from "./user-avatar"

/** How long the pointer rests on the picture before the menu opens, and off it before it closes. */
const OPEN_DELAY = 100
const CLOSE_DELAY = 200

/**
 * The header's account control once signed in: the profile picture, with a menu of everywhere
 * the user can go (Explore, their profile, their lessons, settings, the docs in a new tab) and
 * sign out. With a mouse the menu opens on hover and stays while the pointer is on it; a tap,
 * a click, or Enter opens it too, so phones and keyboards aren't left out.
 */
export function AccountMenu({
  account,
  api = accountApi,
  navigate,
  defaultOpen = false,
  className,
}: {
  account: AccountInfo
  api?: AccountApi
  /** Where to go after signing out; the browser's own navigation by default. */
  navigate?: (to: string) => void
  /** For stories: start with the menu open. */
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  // Whether a mouse is on the picture: a click there then keeps the menu you're looking at
  // instead of toggling it away.
  const overTrigger = React.useRef(false)
  const later = (fn: () => void, ms: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(fn, ms)
  }
  React.useEffect(() => () => clearTimeout(timer.current), [])
  const enter = () => later(() => setOpen(true), OPEN_DELAY)
  const leave = () => later(() => setOpen(false), CLOSE_DELAY)
  const byMouse = (e: React.PointerEvent) => e.pointerType !== "touch"

  const name = account.handle ? `@${account.handle}` : "Account"
  return (
    <DropdownMenuTrigger
      isOpen={open}
      onOpenChange={(next) => {
        if (!next && overTrigger.current) return
        clearTimeout(timer.current)
        setOpen(next)
      }}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`${name}: account menu`}
        className={cn("ms-1 rounded-full", className)}
        onHoverStart={() => {
          overTrigger.current = true
          enter()
        }}
        onHoverEnd={() => {
          overTrigger.current = false
          leave()
        }}
      >
        <UserAvatar
          image={account.image}
          handle={account.handle}
          size="header"
        />
      </Button>
      <DropdownMenu
        placement="bottom end"
        className="w-auto min-w-44"
        isNonModal
        onPointerEnter={(e) => {
          if (byMouse(e)) clearTimeout(timer.current)
        }}
        onPointerLeave={(e) => {
          if (byMouse(e)) leave()
        }}
      >
        <DropdownMenuGroup aria-label="Account">
          <DropdownMenuLabel>
            <bdi dir="ltr">{name}</bdi>
          </DropdownMenuLabel>
          <DropdownMenuItem href="/explore">
            <CompassIcon />
            Explore
          </DropdownMenuItem>
          {account.handle ? (
            <DropdownMenuItem href={`/u/${account.handle}`}>
              <UserRoundIcon />
              Profile
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem href="/settings#lessons">
            <LibraryIcon />
            Your lessons
          </DropdownMenuItem>
          <DropdownMenuItem href="/settings">
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem href="/docs" target="_blank" textValue="Docs">
            <BookOpenIcon />
            Docs
            <ArrowUpRightIcon
              className="ms-auto size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onAction={() => void signOutAndLeave(api, navigate)}
          >
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}
