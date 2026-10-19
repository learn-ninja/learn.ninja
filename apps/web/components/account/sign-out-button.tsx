"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"

import { accountApi, forgetAccount, type AccountApi } from "@/lib/auth/browser"

export function SignOutButton({
  api = accountApi,
  navigate = (to) => window.location.assign(to),
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
        await api.signOut()
        forgetAccount()
        navigate("/")
      }}
    >
      Sign out
    </Button>
  )
}
