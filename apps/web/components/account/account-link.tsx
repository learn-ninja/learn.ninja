"use client"

import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

import { ButtonLink } from "@/components/site/button-link"
import type { AccountInfo } from "@/lib/auth/account-info"
import {
  ACCOUNT_EVENT,
  forgetAccount,
  readAccount,
  rememberAccount,
} from "@/lib/auth/browser"

/**
 * What the header knows about the visitor: the signed-in user's handle and picture, null when
 * nobody is signed in, or undefined until the marker cookie has been read.
 */
export type Account = AccountInfo | null | undefined

/**
 * The visitor's account, from the marker cookie (so static pages need no session request).
 * Pages that checked the session pass `known` to correct the marker: the account, or null when
 * nobody is signed in. Changes made on the page (a new picture, signing out) come through
 * ACCOUNT_EVENT, so the header follows without a reload.
 */
export function useAccount(known?: AccountInfo | null): Account {
  const [account, setAccount] = React.useState<Account>(known)
  React.useEffect(() => {
    if (known === undefined) setAccount(readAccount())
    else if (known === null) forgetAccount()
    else rememberAccount(known)
  }, [known])
  React.useEffect(() => {
    const sync = () => setAccount(readAccount())
    window.addEventListener(ACCOUNT_EVENT, sync)
    return () => window.removeEventListener(ACCOUNT_EVENT, sync)
  }, [])
  return account
}

/**
 * The header's "Sign in" link. Until the cookie is read (after hydration) it holds its space
 * invisibly, so the header doesn't shift for the many visitors who aren't signed in. A signed-in
 * user gets the AccountMenu instead.
 */
export function AccountLink({
  account,
  className,
}: {
  account: Account
  className?: string
}) {
  return (
    <ButtonLink
      href="/sign-in"
      variant="ghost"
      size="sm"
      className={cn(className, account === undefined && "invisible")}
      aria-hidden={account === undefined || undefined}
    >
      Sign in
    </ButtonLink>
  )
}
