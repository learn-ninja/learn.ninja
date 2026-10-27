import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import type { ConnectedApp, KeySummary, McpConnection } from "./account"
import { decodeAccount, encodeAccount, type AccountInfo } from "./account-info"

// What the log-in and settings pages call from the browser: Better Auth's client for log-in
// and log-out, and the account API (lib/auth/account.ts) for handles and keys. The components
// take it as a prop so Storybook can hand them a fake.

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), oauthProviderClient()],
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
  loginWithGitHub(callback: string): Promise<Outcome>
  setHandle(handle: string): Promise<Outcome & { handle?: string }>
  /** Uploads a profile picture (PNG, JPEG, WebP, or GIF, up to 5 MB); `image` is its new URL. */
  uploadAvatar(file: File): Promise<Outcome & { image?: string }>
  removeAvatar(): Promise<Outcome>
  signOut(): Promise<void>
  listKeys(): Promise<KeySummary[]>
  createKey(name: string): Promise<Outcome & { key?: NewKey }>
  deleteKey(id: string): Promise<Outcome>
  /** Makes the personal MCP URL, replacing any earlier one; the URL comes back once, in the clear. */
  connectChat(): Promise<Outcome & { connection?: NewMcpConnection }>
  /** Revokes the personal MCP URL. */
  disconnectChat(): Promise<Outcome>
  /** The chat apps that logged in over OAuth and were allowed. */
  listApps(): Promise<ConnectedApp[]>
  /** Disconnects one of them: its tokens stop working at once. */
  disconnectApp(id: string): Promise<Outcome>
  /** Emails a code to `newEmail`, to make it the account's address. */
  requestEmailChange(newEmail: string): Promise<Outcome>
  /** Makes `newEmail` the account's address with the code sent to it. */
  changeEmail(newEmail: string, code: string): Promise<Outcome>
  /** Sends the browser to GitHub to link it, and back to the settings page. */
  connectGitHub(): Promise<Outcome>
  /** Unlinks GitHub; the email code still logs in. */
  disconnectGitHub(): Promise<Outcome>
  /**
   * Answers the consent page for the OAuth request in the page's query (a chat app logging in);
   * `url` is where to send the browser next: back to the app, with a code or a refusal.
   */
  consent(accept: boolean): Promise<Outcome & { url?: string }>
}

export interface NewMcpConnection extends McpConnection {
  /** The whole URL, shown once. */
  url: string
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
  async loginWithGitHub(callback) {
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
  async connectChat() {
    const reply = await call<{
      id: string
      url: string
      start: string | null
      createdAt: string
    }>("/api/account/mcp", { method: "POST" })
    return reply.ok
      ? { connection: { ...reply, lastUsedAt: null } }
      : { error: reply.message }
  },
  async disconnectChat() {
    const reply = await call("/api/account/mcp", { method: "DELETE" })
    return reply.ok ? {} : { error: reply.message }
  },
  async listApps() {
    const reply = await call<{ apps: ConnectedApp[] }>("/api/account/apps")
    return reply.ok ? reply.apps : []
  },
  async disconnectApp(id) {
    const reply = await call(`/api/account/apps/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    return reply.ok ? {} : { error: reply.message }
  },
  async requestEmailChange(newEmail) {
    const { error } = await authClient.emailOtp.requestEmailChange({ newEmail })
    return error ? { error: error.message ?? FAILED } : {}
  },
  async changeEmail(newEmail, otp) {
    const { error } = await authClient.emailOtp.changeEmail({ newEmail, otp })
    return error ? { error: error.message ?? FAILED } : {}
  },
  async connectGitHub() {
    // A refused link comes back as /settings?error=…, which the page explains.
    const { error } = await authClient.linkSocial({
      provider: "github",
      callbackURL: "/settings#log-in",
      errorCallbackURL: "/settings",
    })
    return error ? { error: error.message ?? FAILED } : {}
  },
  async disconnectGitHub() {
    const { data, error: listError } = await authClient.listAccounts()
    if (listError) return { error: listError.message ?? FAILED }
    const github = data?.find((a) => a.providerId === "github")
    if (!github) return {}
    const { error } = await authClient.unlinkAccount({
      accountId: github.id,
    })
    if (error?.code === "SESSION_NOT_FRESH")
      return { error: "Log in again to disconnect GitHub." }
    return error ? { error: error.message ?? FAILED } : {}
  },
  async consent(accept) {
    const { data, error } = await authClient.oauth2.consent({ accept })
    if (error) return { error: error.message ?? FAILED }
    const url = (data as { url?: string } | null)?.url
    return url ? { url } : { error: FAILED }
  },
}

// ---------- the "logged in" marker ----------
// The session cookie is httpOnly, so the header can't read it. A plain cookie says whether to
// show "Log in" or the account's picture, without a request on every page. It can go stale (an
// expired session); /settings then redirects to log in. Every change fires ACCOUNT_EVENT on
// window, so a header already on the page follows along.

const MARKER = "learn.account"
export const ACCOUNT_EVENT = "learn:account"

/** Records a logged-in user. A partial patch keeps what the cookie already knows (a new handle keeps the picture). */
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

/** The logged-in user as the cookie remembers them, or null when nobody is logged in. */
export function readAccount(): AccountInfo | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${MARKER}=`))
  if (!match) return null
  const value = decodeURIComponent(match.slice(MARKER.length + 1))
  return value ? decodeAccount(value) : null
}
