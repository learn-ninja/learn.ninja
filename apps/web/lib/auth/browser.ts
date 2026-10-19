import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import type { KeySummary } from "./account"

// What the sign-in and settings pages call from the browser: Better Auth's client for sign-in
// and sign-out, and the account API (lib/auth/account.ts) for handles and keys. The components
// take it as a prop so Storybook can hand them a fake.

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
})

export interface Outcome {
  error?: string
}

export interface NewKey {
  id: string
  name: string | null
  key: string
  start: string | null
  createdAt: string
}

export interface AccountApi {
  /** Emails a six-digit code. */
  sendCode(email: string): Promise<Outcome>
  /** Signs in with the code; `handle` is null when the user still has to pick one. */
  verifyCode(
    email: string,
    code: string
  ): Promise<Outcome & { handle?: string | null }>
  /** Sends the browser to GitHub, and back to `callback` afterwards. */
  signInWithGitHub(callback: string): Promise<Outcome>
  setHandle(handle: string): Promise<Outcome & { handle?: string }>
  signOut(): Promise<void>
  listKeys(): Promise<KeySummary[]>
  createKey(name: string): Promise<Outcome & { key?: NewKey }>
  deleteKey(id: string): Promise<Outcome>
}

async function call<T extends object>(
  path: string,
  init?: RequestInit
): Promise<(T & { ok: true }) | { ok: false; error: string; message: string }> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  })
  return (await res.json().catch(() => ({
    ok: false,
    error: "server_error",
    message: `The server replied HTTP ${res.status}.`,
  }))) as (T & { ok: true }) | { ok: false; error: string; message: string }
}

const FAILED = "Something went wrong. Try again."

export const accountApi: AccountApi = {
  async sendCode(email) {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    })
    return error ? { error: error.message ?? FAILED } : {}
  },
  async verifyCode(email, otp) {
    const { data, error } = await authClient.signIn.emailOtp({ email, otp })
    if (error) return { error: error.message ?? FAILED }
    const user = data?.user as { handle?: string | null } | undefined
    return { handle: user?.handle ?? null }
  },
  async signInWithGitHub(callback) {
    const { error } = await authClient.signIn.social({
      provider: "github",
      callbackURL: callback,
    })
    return error ? { error: error.message ?? FAILED } : {}
  },
  async setHandle(handle) {
    const reply = await call<{ handle: string }>("/api/account", {
      method: "PATCH",
      body: JSON.stringify({ handle }),
    })
    return reply.ok ? { handle: reply.handle } : { error: reply.message }
  },
  async signOut() {
    await authClient.signOut()
  },
  async listKeys() {
    const reply = await call<{ keys: KeySummary[] }>("/api/keys")
    return reply.ok ? reply.keys : []
  },
  async createKey(name) {
    const reply = await call<NewKey>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    })
    return reply.ok ? { key: reply } : { error: reply.message }
  },
  async deleteKey(id) {
    const reply = await call(`/api/keys/${id}`, { method: "DELETE" })
    return reply.ok ? {} : { error: reply.message }
  },
}

// ---------- the "signed in" marker ----------
// The session cookie is httpOnly, so the header can't read it. A plain cookie says whether to
// show "Sign in" or the account link, without a request on every page. It can go stale (an expired
// session); /settings then redirects to sign in.

const MARKER = "learn.account"

export function rememberAccount(handle: string | null) {
  document.cookie = `${MARKER}=${encodeURIComponent(handle ?? "1")}; path=/; max-age=${30 * 24 * 3600}; samesite=lax`
}

export function forgetAccount() {
  document.cookie = `${MARKER}=; path=/; max-age=0; samesite=lax`
}

/** The handle, "1" for a user without one, or null when nobody is signed in. */
export function readAccount(): string | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${MARKER}=`))
  return match ? decodeURIComponent(match.slice(MARKER.length + 1)) : null
}
