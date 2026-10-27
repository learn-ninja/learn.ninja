"use client"

import * as React from "react"
import { MailIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Label } from "@workspace/ui/components/label"

import { GitHubLogo } from "@/components/site/social-icons"
import { accountApi, type AccountApi } from "@/lib/auth/browser"
import { relative } from "@/lib/relative-time"

import { FormError } from "./form-error"
import { SettingsList } from "./settings-section"

const CODE_LENGTH = 6

/** What GitHub's refused link means, from the `error` Better Auth puts on /settings. */
function githubLinkError(code: string | undefined): string | null {
  if (!code) return null
  if (code === "account_already_linked_to_different_user")
    return "That GitHub account already belongs to another learn.ninja account. Log in with it to use that one."
  return "GitHub didn't connect. Try again."
}

/**
 * How the account logs in: a code to its email, which every account has and can change, and
 * GitHub, linked or not. `github` is null when the site has no GitHub app (development).
 */
export function LogInMethods({
  email: initialEmail,
  github: initialGitHub,
  error: initialError = null,
  api = accountApi,
}: {
  email: string
  github: { linkedAt: string | null } | null
  /** Better Auth's code for a refused GitHub link, from the page's `?error=`. */
  error?: string | null
  api?: AccountApi
}) {
  const [email, setEmail] = React.useState(initialEmail)
  const [github, setGitHub] = React.useState(initialGitHub)
  const [changing, setChanging] = React.useState(false)
  // Each opening of the email dialog is a fresh one.
  const [changeKey, setChangeKey] = React.useState(0)
  const [unlinking, setUnlinking] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(() =>
    githubLinkError(initialError ?? undefined)
  )
  const [status, setStatus] = React.useState("")

  async function connect() {
    setBusy(true)
    setError(null)
    // On success the browser leaves for GitHub.
    const result = await api.connectGitHub()
    setBusy(false)
    if (result.error) setError(result.error)
  }

  async function disconnect() {
    setBusy(true)
    setError(null)
    const result = await api.disconnectGitHub()
    setBusy(false)
    setUnlinking(false)
    if (result.error) return setError(result.error)
    setGitHub({ linkedAt: null })
    setStatus("GitHub disconnected")
  }

  return (
    <>
      <SettingsList>
        <Item role="listitem">
          <ItemMedia variant="icon">
            <MailIcon />
          </ItemMedia>
          <ItemContent className="min-w-0 gap-0.5">
            <ItemTitle className="w-full min-w-0">
              <bdi dir="ltr" className="truncate">
                {email}
              </bdi>
            </ItemTitle>
          </ItemContent>
          <ItemActions>
            <Button
              variant="outline"
              size="sm"
              isDisabled={busy}
              onPress={() => {
                setStatus("")
                setChangeKey((k) => k + 1)
                setChanging(true)
              }}
            >
              Change
            </Button>
          </ItemActions>
        </Item>
        {github ? (
          <Item role="listitem">
            <ItemMedia variant="icon">
              <GitHubLogo />
            </ItemMedia>
            <ItemContent className="min-w-0 gap-0.5">
              <ItemTitle>GitHub</ItemTitle>
              <ItemDescription>
                {github.linkedAt
                  ? `Connected ${relative(github.linkedAt)}`
                  : "Not connected"}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {github.linkedAt ? (
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={busy}
                  onPress={() => setUnlinking(true)}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={busy}
                  onPress={() => void connect()}
                >
                  Connect
                </Button>
              )}
            </ItemActions>
          </Item>
        ) : null}
      </SettingsList>
      <p aria-live="polite" className="text-sm text-muted-foreground empty:hidden">
        {status}
      </p>
      <FormError>{error}</FormError>

      <ChangeEmailDialog
        key={changeKey}
        isOpen={changing}
        current={email}
        api={api}
        onClose={() => setChanging(false)}
        onChanged={(next) => {
          setEmail(next)
          setChanging(false)
          setStatus("Email changed")
        }}
      />

      <Dialog
        isOpen={unlinking}
        onOpenChange={(open) => {
          if (!open) setUnlinking(false)
        }}
      >
        <DialogHeader>
          <DialogTitle>Disconnect GitHub?</DialogTitle>
          <DialogDescription>
            You&apos;ll log in with a code sent to{" "}
            <bdi dir="ltr" className="font-medium text-foreground">
              {email}
            </bdi>
            . You can connect GitHub again any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Keep it</DialogClose>
          <Button
            variant="destructive"
            isDisabled={busy}
            onPress={() => void disconnect()}
          >
            Disconnect
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

/** The new address, then the code sent to it. Nothing changes until the code is right. */
function ChangeEmailDialog({
  isOpen,
  current,
  api,
  onClose,
  onChanged,
}: {
  isOpen: boolean
  current: string
  api: AccountApi
  onClose: () => void
  onChanged: (email: string) => void
}) {
  const [step, setStep] = React.useState<"address" | "code">("address")
  const [next, setNext] = React.useState("")
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const address = next.trim().toLowerCase()

  async function send() {
    if (!address || busy) return
    if (address === current.toLowerCase())
      return setError("That's already your email.")
    setBusy(true)
    setError(null)
    const result = await api.requestEmailChange(address)
    setBusy(false)
    if (result.error) return setError(result.error)
    setCode("")
    setStep("code")
  }

  async function verify(value = code) {
    if (value.length < CODE_LENGTH || busy) return
    setBusy(true)
    setError(null)
    const result = await api.changeEmail(address, value)
    setBusy(false)
    if (result.error) {
      setCode("")
      return setError(result.error)
    }
    onChanged(address)
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {step === "address" ? (
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <DialogHeader>
            <DialogTitle>Change your email</DialogTitle>
            <DialogDescription>
              We&apos;ll send a code to the new address. Your email stays the
              same until you enter it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-email">New email</Label>
            <Input
              id="new-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="you@example.com"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <FormError>{error}</FormError>
          </div>
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button type="submit" isDisabled={busy || !address}>
              {busy ? "Sending…" : "Send code"}
            </Button>
          </DialogFooter>
        </form>
      ) : (
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void verify()
          }}
        >
          <DialogHeader>
            <DialogTitle>Enter the code</DialogTitle>
            <DialogDescription>
              We emailed a six-digit code to{" "}
              <bdi dir="ltr" className="font-medium text-foreground">
                {address}
              </bdi>
              . It works for 5 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email-code" className="sr-only">
              Code
            </Label>
            <InputOTP
              id="email-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={setCode}
              onComplete={(value: string) => void verify(value)}
              autoFocus
              disabled={busy}
              inputMode="numeric"
              pattern="\d*"
            >
              <InputOTPGroup>
                {Array.from({ length: CODE_LENGTH }, (_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="size-10 text-base"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <FormError>{error}</FormError>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              isDisabled={busy}
              onPress={() => {
                setError(null)
                setStep("address")
              }}
            >
              Back
            </Button>
            <Button type="submit" isDisabled={busy || code.length < CODE_LENGTH}>
              {busy ? "Changing…" : "Change email"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}
