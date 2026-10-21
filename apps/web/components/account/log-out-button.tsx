"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"

import { accountApi, forgetAccount, type AccountApi } from "@/lib/auth/browser"

/** Ends the session, forgets the header's marker, and leaves for the home page. */
export async function logOutAndLeave(
  api: AccountApi = accountApi,
  navigate: (to: string) => void = (to) => window.location.assign(to)
) {
  await api.signOut()
  forgetAccount()
  navigate("/")
}

export function LogOutButton({
  api = accountApi,
  navigate,
}: {
  api?: AccountApi
  navigate?: (to: string) => void
}) {
  const [busy, setBusy] = React.useState(false)
  return (
    <Button
      variant="outline"
      isDisabled={busy}
      onPress={async () => {
        setBusy(true)
        await logOutAndLeave(api, navigate)
      }}
    >
      Log out
    </Button>
  )
}
