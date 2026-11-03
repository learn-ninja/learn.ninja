import type { Meta, StoryObj } from "@storybook/react-vite"

import type { DayStreak } from "@workspace/player"

import type {
  ConnectedApp,
  KeySummary,
  McpConnection,
} from "@/lib/auth/account"
import type { AccountApi } from "@/lib/auth/browser"
import { ButtonLink } from "@/components/site/button-link"
import { SiteHeader } from "@/components/site/site-header"

import { AccountMenu } from "./account-menu"
import { ApiKeys } from "./api-keys"
import { AvatarForm } from "./avatar-form"
import { ConnectChat } from "./connect-chat"
import { ConnectedApps } from "./connected-apps"
import { AuthHeading, AuthPanel, LegalConsent } from "./auth-panel"
import { ConsentForm } from "./consent-form"
import { HandleForm } from "./handle-form"
import { LessonAccount } from "./lesson-account"
import { LogInMethods } from "./log-in-methods"
import { LoginForm } from "./login-form"
import { SettingsView } from "./settings-view"
import { StreakButton } from "./streak-button"

// The account screens with a fake server: any code "123456" works, the handle "taken" is taken,
// a picture named "big" is refused by the server (the browser refuses real oversized files first),
// and changing the email to an address starting "stale" asks you to log in again.

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms))

const fakeApi = (over: Partial<AccountApi> = {}): AccountApi => ({
  async sendCode(email) {
    await wait()
    return email.includes("@")
      ? {}
      : { error: "That doesn't look like an email." }
  },
  async verifyCode(_email, code) {
    await wait()
    return code === "123456"
      ? { account: { handle: "quiet-kitsune", image: null } }
      : { error: "That code isn't right. 2 tries left." }
  },
  async loginWithGitHub() {
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
  async listApps() {
    return APPS
  },
  async disconnectApp() {
    await wait()
    return {}
  },
  async requestEmailChange(newEmail) {
    await wait()
    return newEmail.startsWith("stale")
      ? { error: "Log in again to change your email." }
      : {}
  },
  async changeEmail(_newEmail, code) {
    await wait()
    return code === "123456"
      ? {}
      : { error: "That code isn't right. 2 tries left." }
  },
  async connectGitHub() {
    await wait()
    return { error: "GitHub isn't wired up in Storybook." }
  },
  async disconnectGitHub() {
    await wait()
    return {}
  },
  async consent(accept) {
    await wait()
    return {
      url: accept
        ? "https://claude.ai/…?code=…"
        : "https://claude.ai/…?error=access_denied",
    }
  },
  ...over,
})

const CONNECTION: McpConnection = {
  id: "m1",
  start: "learn_mcp_ab12",
  createdAt: new Date(Date.now() - 10 * 864e5).toISOString(),
  lastUsedAt: new Date(Date.now() - 864e5).toISOString(),
}

const APPS: ConnectedApp[] = [
  {
    id: "c1",
    clientId: "https://claude.ai/.well-known/oauth-client",
    name: "claude.ai",
    allowedAt: new Date(Date.now() - 20 * 864e5).toISOString(),
    lastUsedAt: new Date().toISOString(),
  },
  {
    id: "c2",
    clientId: "https://chatgpt.com/.well-known/oauth-client",
    name: "chatgpt.com",
    allowedAt: new Date(Date.now() - 5 * 864e5).toISOString(),
    lastUsedAt: new Date(Date.now() - 2 * 864e5).toISOString(),
  },
  {
    id: "c3",
    clientId: "k9ZlQ2m4",
    name: "Claude Code",
    allowedAt: new Date(Date.now() - 45 * 864e5).toISOString(),
    lastUsedAt: null,
  },
]

const KEYS: KeySummary[] = [
  {
    id: "k1",
    name: "learn CLI on my-laptop",
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
    // A whole page (`page: true`) gets the settings page's width instead of the form column.
    (Story, { parameters }) => (
      <div
        className={
          parameters.page
            ? "mx-auto max-w-3xl px-4 py-12 sm:px-6"
            : "mx-auto max-w-md py-10"
        }
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj

const navigate = (to: string) => alert(`→ ${to}`)

export const Settings: Story = {
  parameters: { layout: "fullscreen", page: true },
  render: () => (
    <SettingsView
      email="ada@example.com"
      github={{ linkedAt: new Date(Date.now() - 30 * 864e5).toISOString() }}
      image={PICTURE}
      handle="ada"
      apps={APPS}
      connection={CONNECTION}
      keys={KEYS}
      api={fakeApi()}
    />
  ),
}

export const SettingsNew: Story = {
  name: "Settings, new account",
  parameters: { layout: "fullscreen", page: true },
  render: () => (
    <SettingsView
      email="ada@example.com"
      github={{ linkedAt: null }}
      image={null}
      handle={null}
      apps={[]}
      connection={null}
      keys={[]}
      api={fakeApi()}
    />
  ),
}

export const Login: Story = {
  render: () => (
    <AuthPanel footer={<LegalConsent />}>
      <LoginForm
        github
        callback="/settings"
        api={fakeApi()}
        navigate={navigate}
      />
    </AuthPanel>
  ),
}

export const LoginEmailOnly: Story = {
  name: "Log in, email only",
  render: () => (
    <AuthPanel footer={<LegalConsent />}>
      <LoginForm
        github={false}
        callback="/settings"
        api={fakeApi()}
        navigate={navigate}
      />
    </AuthPanel>
  ),
}

export const LoginFromChatApp: Story = {
  name: "Log in, from a chat app",
  render: () => (
    // A chat app's OAuth log-in: it goes on to /consent.
    <AuthPanel footer={<LegalConsent />}>
      <LoginForm
        github
        callback="/consent?client_id=…"
        title="Log in to connect your app"
        description="An agent wants to publish lessons to your account. Log in, then you’ll be asked to allow it."
        api={fakeApi()}
        navigate={navigate}
      />
    </AuthPanel>
  ),
}

export const LoginWithHandle: Story = {
  name: "Log in, user has a handle",
  render: () => (
    <AuthPanel footer={<LegalConsent />}>
      <LoginForm
        github
        callback="/settings"
        api={fakeApi({
          verifyCode: async () => ({
            account: { handle: "ada", image: PICTURE },
          }),
        })}
        navigate={navigate}
      />
    </AuthPanel>
  ),
}

export const LogIn: Story = {
  name: "Log-in methods, GitHub refused",
  render: () => (
    <LogInMethods
      email="ada@example.com"
      github={{ linkedAt: null }}
      error="account_already_linked_to_different_user"
      api={fakeApi()}
    />
  ),
}

export const LogInNoGitHub: Story = {
  name: "Log-in methods, no GitHub app",
  render: () => (
    <LogInMethods email="ada@example.com" github={null} api={fakeApi()} />
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

export const ConnectedAppsList: Story = {
  name: "Connected apps",
  render: () => <ConnectedApps initial={APPS} api={fakeApi()} />,
}

export const ConnectedAppsOne: Story = {
  name: "Connected apps, one",
  render: () => <ConnectedApps initial={APPS.slice(0, 1)} api={fakeApi()} />,
}

export const ConnectedAppsNone: Story = {
  name: "Connected apps, none yet",
  render: () => <ConnectedApps initial={[]} api={fakeApi()} />,
}

export const ConnectedAppsFails: Story = {
  name: "Connected apps, server refuses",
  render: () => (
    <ConnectedApps
      initial={APPS}
      api={fakeApi({
        disconnectApp: async () => {
          await wait()
          return { error: "Log in again to disconnect an app." }
        },
      })}
    />
  ),
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
          return { error: "Log in again to make a URL." }
        },
      })}
    />
  ),
}

export const HeaderLinks: Story = {
  name: "Header states",
  render: () => (
    // Logged out, logged in without a handle, logged in with and without a picture: Explore only
    // shows for visitors, and the wordmark links there once logged in.
    <div className="flex flex-col gap-2 [&_header]:static">
      <SiteHeader account={null} />
      <SiteHeader account={{ handle: null, image: null }} />
      <SiteHeader account={{ handle: "ada-lovelace", image: null }} />
      <SiteHeader account={{ handle: "ada-lovelace", image: PICTURE }} />
    </div>
  ),
}

export const HeaderMenu: Story = {
  name: "Header menu",
  render: () => (
    // The logged-in header's menu, open: hover the picture to open it on the other headers.
    <div className="flex h-72 flex-col gap-2 [&_header]:static">
      <SiteHeader account={{ handle: "ada-lovelace", image: PICTURE }} />
      <div className="flex justify-end px-8">
        <AccountMenu
          account={{ handle: "ada-lovelace", image: PICTURE }}
          api={fakeApi()}
          navigate={navigate}
          defaultOpen
        />
      </div>
    </div>
  ),
}

/**
 * A streak as of a fixed Monday: the last seven days oldest first, one letter each (l lit, r a rest
 * day, m missed, o today still open).
 */
const streakOf = (
  current: number,
  longest: number,
  rest: number,
  week: string,
  toward = 0,
  recharged = false
): DayStreak => ({
  current,
  longest,
  rest,
  toward,
  recharged,
  days: [...week].map((c, i) => ({
    day: `2026-10-${String(20 + i).padStart(2, "0")}`,
    state: ({ l: "lit", r: "rest", m: "missed", o: "open" } as const)[
      c as "l" | "r" | "m" | "o"
    ],
  })),
})

export const HeaderStreak: Story = {
  name: "Header streak",
  render: () => (
    // Lit once today has a lesson, unlit until then (the count holds through today), and a new
    // account's 0. Learners without a streak at all still see the lantern, as an invitation.
    <div className="flex flex-col gap-2 [&_header]:static">
      <SiteHeader
        account={{ handle: "ada-lovelace", image: PICTURE }}
        streak={streakOf(12, 21, 2, "lllrlll")}
      />
      <SiteHeader
        account={{ handle: "ada-lovelace", image: PICTURE }}
        streak={streakOf(12, 21, 1, "lllrllo")}
      />
      <SiteHeader
        account={{ handle: "ada-lovelace", image: PICTURE }}
        streak={streakOf(0, 0, 0, "mmmmmmo")}
      />
    </div>
  ),
}

export const HeaderStreakOpen: Story = {
  name: "Header streak, open",
  render: () => (
    // The popover: this week's lanterns, the best streak, and the way to the activity grid.
    <div className="flex h-96 justify-end px-8 pt-4">
      <StreakButton
        streak={streakOf(12, 21, 1, "lllrllo", 1)}
        profileHref="#profile"
        defaultOpen
      />
    </div>
  ),
}

export const HeaderStreakRestUsed: Story = {
  name: "Header streak, rest day used",
  render: () => (
    // Yesterday spent a rest day and today has no lesson yet.
    <div className="flex h-96 justify-end px-8 pt-4">
      <StreakButton
        streak={streakOf(5, 5, 0, "mllllro", 1)}
        profileHref="#profile"
        defaultOpen
      />
    </div>
  ),
}

export const HeaderStreakFull: Story = {
  name: "Header streak, fully charged",
  render: () => (
    <div className="flex h-96 justify-end px-8 pt-4">
      <StreakButton
        streak={streakOf(9, 21, 2, "lllllll", 0, true)}
        profileHref="#profile"
        defaultOpen
      />
    </div>
  ),
}

/** The consent step of a chat app logging in over OAuth (/consent). */
// The end of a lesson's header: the lantern and picture, or Sign up for a visitor.
export const LessonHeaderEnd: Story = {
  name: "Lesson header end",
  render: () => (
    <div className="flex items-center gap-4">
      <LessonAccount
        account={{ handle: "ada-lovelace", image: PICTURE }}
        streak={streakOf(12, 21, 2, "lllrllo")}
      />
      <LessonAccount account={null} />
    </div>
  ),
}

export const Consent: Story = {
  render: () => (
    <AuthPanel>
      <ConsentForm
        app="claude.ai"
        handle="ada"
        email="ada@example.com"
        returnTo="claude.ai"
        switchHref="/login"
        api={fakeApi()}
        navigate={navigate}
      />
    </AuthPanel>
  ),
}

export const ConsentNewAccount: Story = {
  name: "Consent, new account",
  render: () => (
    <AuthPanel>
      <ConsentForm
        app="A chat app"
        handle="quiet-kitsune"
        email="ada@example.com"
        returnTo={null}
        switchHref="/login"
        api={fakeApi()}
        navigate={navigate}
      />
    </AuthPanel>
  ),
}

export const ConsentExpired: Story = {
  name: "Consent, expired",
  render: () => (
    <AuthPanel>
      <AuthHeading title="This request has expired">
        Go back to your chat app and connect learn.ninja again. It only takes a
        moment.
      </AuthHeading>
      <ButtonLink href="/" variant="outline" className="w-full">
        Go to learn.ninja
      </ButtonLink>
    </AuthPanel>
  ),
}
