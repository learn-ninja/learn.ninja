import type { Meta, StoryObj } from "@storybook/react-vite"

import type { KeySummary } from "@/lib/auth/account"
import type { AccountApi } from "@/lib/auth/browser"

import { ApiKeys } from "./api-keys"
import { HandleForm } from "./handle-form"
import { SignInForm } from "./sign-in-form"
import { SignOutButton } from "./sign-out-button"

// The account screens with a fake server: any code "123456" works, the handle "taken" is taken.

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms))

const fakeApi = (over: Partial<AccountApi> = {}): AccountApi => ({
  async sendCode(email) {
    await wait()
    return email.includes("@") ? {} : { error: "That doesn't look like an email." }
  },
  async verifyCode(_email, code) {
    await wait()
    return code === "123456"
      ? { handle: null }
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
  ...over,
})

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
        verifyCode: async () => ({ handle: "ada" }),
      })}
      navigate={navigate}
    />
  ),
}

export const Handle: Story = {
  render: () => <HandleForm initial="ada" api={fakeApi()} />,
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

export const SignOut: Story = {
  render: () => <SignOutButton api={fakeApi()} navigate={navigate} />,
}
