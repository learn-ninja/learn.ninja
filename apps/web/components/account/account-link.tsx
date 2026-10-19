"use client"

import * as React from "react"
import { UserRoundIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { ButtonLink } from "@/components/site/button-link"
import { forgetAccount, readAccount, rememberAccount } from "@/lib/auth/browser"

/**
 * The header's account control: "Sign in", or the handle once signed in (read from the marker
 * cookie, so static pages need no session request). Pages that know the session pass `handle` to
 * correct the marker.
 */
export function AccountLink({
  handle,
  className,
}: {
  /** The signed-in user's handle, "" for a user without one, null when nobody is signed in, or undefined when the page doesn't know. */
  handle?: string | null
  className?: string
}) {
  // The handle, "1" for a signed-in user without one, null when signed out, undefined until known.
  const [account, setAccount] = React.useState<string | null | undefined>(
    handle === undefined ? undefined : handle === null ? null : handle || "1"
  )
  React.useEffect(() => {
    if (handle === undefined) setAccount(readAccount())
    else if (handle === null) forgetAccount()
    else rememberAccount(handle || null)
  }, [handle])

  // Until the cookie is read (after hydration), an invisible "Sign in" holds the space so the
  // header doesn't shift for the many visitors who aren't signed in.
  if (account === null || account === undefined) {
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
  return (
    <ButtonLink
      href="/settings"
      variant="ghost"
      size="sm"
      className={className}
      aria-label={account === "1" ? "Account settings" : undefined}
    >
      <UserRoundIcon data-icon="inline-start" />
      {account === "1" ? (
        <span className="max-sm:sr-only">Account</span>
      ) : (
        <bdi dir="ltr" className="max-sm:sr-only">
          @{account}
        </bdi>
      )}
    </ButtonLink>
  )
}
