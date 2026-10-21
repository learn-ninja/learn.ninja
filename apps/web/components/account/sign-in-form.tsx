"use client"

import * as React from "react"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Label } from "@workspace/ui/components/label"

import { GitHubLogo } from "@/components/site/social-icons"
import type { AccountInfo } from "@/lib/auth/account-info"
import { accountApi, rememberAccount, type AccountApi } from "@/lib/auth/browser"

import { HandleForm } from "./handle-form"
import { FormError } from "./form-error"

const CODE_LENGTH = 6

/**
 * Sign in with GitHub or a six-digit email code. Email users without a handle pick one before
 * leaving, unless `pickHandle` is off: a chat app's OAuth sign-in goes straight on to /consent,
 * which offers the handle there. Ends by sending the browser to `callback`.
 */
export function SignInForm({
  github,
  callback,
  pickHandle = true,
  api = accountApi,
  navigate = (to) => window.location.assign(to),
}: {
  /** Whether the GitHub OAuth app is configured. */
  github: boolean
  /** Where to go once signed in, a site path. */
  callback: string
  /** Whether a new email user picks a handle here before going on. */
  pickHandle?: boolean
  api?: AccountApi
  navigate?: (to: string) => void
}) {
  const [step, setStep] = React.useState<"email" | "code" | "handle">("email")
  const [email, setEmail] = React.useState("")
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [account, setAccount] = React.useState<AccountInfo | null>(null)

  const finish = (handle: string | null, image = account?.image ?? null) => {
    rememberAccount({ handle, image })
    navigate(callback)
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await api.sendCode(email.trim())
    setBusy(false)
    if (error) return setError(error)
    setCode("")
    setStep("code")
  }

  async function verify(value = code) {
    if (value.length < CODE_LENGTH || busy) return
    setBusy(true)
    setError(null)
    const result = await api.verifyCode(email.trim(), value)
    setBusy(false)
    if (result.error) {
      setCode("")
      return setError(result.error)
    }
    setAccount(result.account ?? null)
    if (result.account?.handle || !pickHandle)
      finish(result.account?.handle ?? null, result.account?.image ?? null)
    else setStep("handle")
  }

  async function githubSignIn() {
    setBusy(true)
    setError(null)
    const { error } = await api.signInWithGitHub(callback)
    if (error) {
      setBusy(false)
      setError(error)
    }
  }

  if (step === "handle") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Pick a handle
          </h1>
          <p className="text-muted-foreground">
            It names your lessons and your page. You can change it later in
            settings.
          </p>
        </div>
        <HandleForm
          initial={null}
          api={api}
          submitLabel="Continue"
          onSaved={(handle) => finish(handle)}
        />
        <Button
          variant="link"
          className="self-start px-0"
          onPress={() => finish(null)}
        >
          Skip for now
        </Button>
      </div>
    )
  }

  if (step === "code") {
    return (
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          void verify()
        }}
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Enter the code
          </h1>
          <p className="text-muted-foreground">
            We emailed a six-digit code to{" "}
            <bdi dir="ltr" className="font-medium text-foreground">
              {email.trim()}
            </bdi>
            . It works for 5 minutes.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Code</Label>
          <InputOTP
            id="code"
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
                <InputOTPSlot key={i} index={i} className="size-10 text-base" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <FormError>{error}</FormError>
        <div className="flex items-center gap-2">
          <Button type="submit" isDisabled={busy || code.length < CODE_LENGTH}>
            Sign in
          </Button>
          <Button
            variant="ghost"
            isDisabled={busy}
            onPress={() => {
              setError(null)
              setStep("email")
            }}
          >
            <ArrowLeftIcon data-icon="inline-start" className="rtl:-scale-x-100" />
            Use another email
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground">
          Only to keep lessons beyond 7 days. Making and playing them needs no
          account.
        </p>
      </div>
      {github ? (
        <>
          <Button
            variant="outline"
            isDisabled={busy}
            onPress={() => void githubSignIn()}
          >
            <GitHubLogo />
            Continue with GitHub
          </Button>
          <div
            aria-hidden="true"
            className="flex items-center gap-3 text-xs text-muted-foreground"
          >
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}
      <form className="flex flex-col gap-4" onSubmit={(e) => void sendCode(e)}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus={!github}
            disabled={busy}
          />
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you a code. No password.
          </p>
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" isDisabled={busy} className="self-start">
          Email me a code
        </Button>
      </form>
    </div>
  )
}
