import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import type { KeySummary } from "./account"
import { decodeAccount, encodeAccount, type AccountInfo } from "./account-info"

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
  ): Promise<Outcome & { account?: AccountInfo }>
  /** Sends the browser to GitHub, and back to `callback` afterwards. */
  signInWithGitHub(callback: string): Promise<Outcome>
  setHandle(handle: string): Promise<Outcome & { handle?: string }>
  /** Uploads a profile picture (PNG, JPEG, WebP, or GIF, up to 5 MB); `image` is its new URL. */
  uploadAvatar(file: File): Promise<Outcome & { image?: string }>
  removeAvatar(): Promise<Outcome>
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
    const user = data?.user as
      | { handle?: string | null; image?: string | null }
      | undefined
    return {
      account: { handle: user?.handle ?? null, image: user?.image ?? null },
    }
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
  async uploadAvatar(file) {
    const body = new FormData()
    body.append("file", file, file.name)
    // No content-type header: the browser sets multipart/form-data with its boundary.
    const res = await fetch("/api/account/avatar", { method: "POST", body })
    const reply = (await res.json().catch(() => null)) as
      | { ok: true; image: string }
      | { ok: false; message: string }
      | null
    if (!reply) return { error: `The server replied HTTP ${res.status}.` }
    return reply.ok ? { image: reply.image } : { error: reply.message }
  },
  async removeAvatar() {
    const reply = await call("/api/account/avatar", { method: "DELETE" })
    return reply.ok ? {} : { error: reply.message }
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
// show "Sign in" or the account's picture, without a request on every page. It can go stale (an
// expired session); /settings then redirects to sign in. Every change fires ACCOUNT_EVENT on
// window, so a header already on the page follows along.

const MARKER = "learn.account"
export const ACCOUNT_EVENT = "learn:account"

/** Records a signed-in user. A partial patch keeps what the cookie already knows (a new handle keeps the picture). */
export function rememberAccount(patch: Partial<AccountInfo>) {
  const current = readAccount() ?? { handle: null, image: null }
  const value = encodeURIComponent(encodeAccount({ ...current, ...patch }))
  document.cookie = `${MARKER}=${value}; path=/; max-age=${30 * 24 * 3600}; samesite=lax`
  window.dispatchEvent(new Event(ACCOUNT_EVENT))
}

export function forgetAccount() {
  document.cookie = `${MARKER}=; path=/; max-age=0; samesite=lax`
  window.dispatchEvent(new Event(ACCOUNT_EVENT))
}

/** The signed-in user as the cookie remembers them, or null when nobody is signed in. */
export function readAccount(): AccountInfo | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${MARKER}=`))
  if (!match) return null
  const value = decodeURIComponent(match.slice(MARKER.length + 1))
  return value ? decodeAccount(value) : null
}
