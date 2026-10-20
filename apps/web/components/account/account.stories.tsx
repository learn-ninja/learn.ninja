import type { Meta, StoryObj } from "@storybook/react-vite"

import type { KeySummary, McpConnection } from "@/lib/auth/account"
import type { AccountApi } from "@/lib/auth/browser"
import { SiteHeader } from "@/components/site/site-header"

import { ApiKeys } from "./api-keys"
import { AvatarForm } from "./avatar-form"
import { ConnectChat } from "./connect-chat"
import { HandleForm } from "./handle-form"
import { KeepForm, type KeepResult } from "./keep-form"
import { SignInForm } from "./sign-in-form"
import { SignOutButton } from "./sign-out-button"

// The account screens with a fake server: any code "123456" works, the handle "taken" is taken,
// and a picture named "big" is refused by the server (the browser refuses real oversized files first).

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms))

const fakeApi = (over: Partial<AccountApi> = {}): AccountApi => ({
  async sendCode(email) {
    await wait()
    return email.includes("@") ? {} : { error: "That doesn't look like an email." }
  },
  async verifyCode(_email, code) {
    await wait()
    return code === "123456"
      ? { account: { handle: null, image: null } }
      : { error: "That code isn't right. 2 tries left." }
  },
  async signInWithGitHub() {
    await wait()
    return { error: "GitHub isn't wired up in Storybook." }
  },
  async setHandle(handle) {
    await wait()
    return handle === "taken"
      ? { error: "Someone already has that handle." }
      : { handle }
  },
  async uploadAvatar(file) {
    await wait(800)
    return file.name.startsWith("big")
      ? { error: "That picture is over 5 MB. Choose a smaller one." }
      : { image: URL.createObjectURL(file) }
  },
  async removeAvatar() {
    await wait()
    return {}
  },
  async signOut() {
    await wait()
  },
  async listKeys() {
    return KEYS
  },
  async createKey(name) {
    await wait()
    return {
      key: {
        id: `k${Date.now()}`,
        name: name || "Unnamed key",
        key: "learn_" + "x".repeat(64),
        start: "learn_xxxx",
        createdAt: new Date().toISOString(),
      },
    }
  },
  async deleteKey() {
    await wait()
    return {}
  },
  async connectChat() {
    await wait()
    return {
      connection: {
        id: `m${Date.now()}`,
        url: "https://learn.ninja/mcp/learn_mcp_" + "x".repeat(64),
        start: "learn_mcp_xxxx",
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      },
    }
  },
  async disconnectChat() {
    await wait()
    return {}
  },
  ...over,
})

const CONNECTION: McpConnection = {
  id: "m1",
  start: "learn_mcp_ab12",
  createdAt: new Date(Date.now() - 10 * 864e5).toISOString(),
  lastUsedAt: new Date(Date.now() - 864e5).toISOString(),
}

const KEYS: KeySummary[] = [
  {
    id: "k1",
    name: "learn CLI on colins-mac",
    start: "learn_ab12",
    createdAt: new Date(Date.now() - 3 * 864e5).toISOString(),
    lastUsedAt: new Date().toISOString(),
  },
  {
    id: "k2",
    name: "CI",
    start: "learn_cd34",
    createdAt: new Date(Date.now() - 60 * 864e5).toISOString(),
    lastUsedAt: null,
  },
]

const meta = {
  title: "Site/Account",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-md py-10">
        <Story />
      </div>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj

const navigate = (to: string) => alert(`→ ${to}`)

export const SignIn: Story = {
  render: () => (
    <SignInForm github callback="/settings" api={fakeApi()} navigate={navigate} />
  ),
}

export const SignInEmailOnly: Story = {
  name: "Sign in, email only",
  render: () => (
    <SignInForm
      github={false}
      callback="/settings"
      api={fakeApi()}
      navigate={navigate}
    />
  ),
}

export const SignInWithHandle: Story = {
  name: "Sign in, user has a handle",
  render: () => (
    <SignInForm
      github
      callback="/settings"
      api={fakeApi({
        verifyCode: async () => ({
          account: { handle: "ada", image: PICTURE },
        }),
      })}
      navigate={navigate}
    />
  ),
}

export const Handle: Story = {
  render: () => <HandleForm initial="ada" api={fakeApi()} />,
}

/** A stand-in picture: a two-tone SVG, so the story needs no file. */
const PICTURE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2563eb"/><circle cx="32" cy="26" r="12" fill="#fff"/><path d="M10 60c2-14 12-20 22-20s20 6 22 20z" fill="#fff"/></svg>'
  )

export const Picture: Story = {
  render: () => <AvatarForm initial={PICTURE} handle="ada" api={fakeApi()} />,
}

export const PictureNone: Story = {
  name: "Picture, none yet",
  render: () => <AvatarForm initial={null} handle="ada" api={fakeApi()} />,
}

export const PictureNoHandle: Story = {
  name: "Picture, no handle either",
  render: () => <AvatarForm initial={null} handle={null} api={fakeApi()} />,
}

export const HandleNew: Story = {
  name: "Handle, none yet",
  render: () => <HandleForm initial={null} api={fakeApi()} />,
}

export const Keys: Story = {
  render: () => <ApiKeys initial={KEYS} api={fakeApi()} />,
}

export const KeysNone: Story = {
  name: "Keys, none yet",
  render: () => <ApiKeys initial={[]} api={fakeApi()} />,
}

export const ConnectChatApp: Story = {
  name: "Connect a chat app",
  render: () => <ConnectChat initial={CONNECTION} api={fakeApi()} />,
}

export const ConnectChatAppNone: Story = {
  name: "Connect a chat app, no URL yet",
  render: () => <ConnectChat initial={null} api={fakeApi()} />,
}

export const ConnectChatAppFails: Story = {
  name: "Connect a chat app, server refuses",
  render: () => (
    <ConnectChat
      initial={null}
      api={fakeApi({
        connectChat: async () => {
          await wait()
          return { error: "Sign in again to make a URL." }
        },
      })}
    />
  ),
}

export const SignOut: Story = {
  render: () => <SignOutButton api={fakeApi()} navigate={navigate} />,
}

/** A stand-in for the server action: keeps unless the token is "spent". */
const keep = async (_: KeepResult | null, data: FormData): Promise<KeepResult> => {
  await wait()
  return data.get("token") === "spent"
    ? { ok: false, message: "This lesson was already saved to an account." }
    : { ok: true, message: "Kept.", url: "#", title: "Basic Spanish greetings" }
}

export const Keep: Story = {
  render: () => (
    <KeepForm token="fresh" title="Basic Spanish greetings" action={keep} />
  ),
}

export const KeepFails: Story = {
  name: "Keep, already kept",
  render: () => (
    <KeepForm token="spent" title="Basic Spanish greetings" action={keep} />
  ),
}

export const HeaderLinks: Story = {
  name: "Header states",
  render: () => (
    // Signed out, signed in without a handle, signed in with and without a picture: Explore only
    // shows for visitors, and the wordmark links there once signed in.
    <div className="flex flex-col gap-2 [&_header]:static">
      <SiteHeader account={null} />
      <SiteHeader account={{ handle: null, image: null }} />
      <SiteHeader account={{ handle: "ada-lovelace", image: null }} />
      <SiteHeader account={{ handle: "ada-lovelace", image: PICTURE }} />
    </div>
  ),
}
