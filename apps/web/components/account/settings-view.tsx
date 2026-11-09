import { Separator } from "@workspace/ui/components/separator"

import type {
  ConnectedApp,
  KeySummary,
  McpConnection,
} from "@/lib/auth/account"
import type { AccountApi } from "@/lib/auth/browser"

import { ApiKeys } from "./api-keys"
import { AvatarForm } from "./avatar-form"
import { ConnectChat } from "./connect-chat"
import { ConnectedApps } from "./connected-apps"
import { DeleteAccount } from "./delete-account"
import { HandleForm } from "./handle-form"
import { LogInMethods } from "./log-in-methods"
import { SettingsSection } from "./settings-section"


/**
 * The settings page's content: the profile, how you log in, then what can publish to the account (chat apps that
 * logged in, the personal MCP URL, API keys), and deleting the account. `api` is the fake server in
 * Storybook.
 */
export function SettingsView({
  email,
  github,
  githubError,
  image,
  handle,
  apps,
  connection,
  keys,
  api,
}: {
  email: string
  /** When GitHub was linked (null if it isn't), or null for no GitHub row at all. */
  github: { linkedAt: string | null } | null
  githubError?: string | null
  image: string | null
  handle: string | null
  apps: ConnectedApp[]
  connection: McpConnection | null
  keys: KeySummary[]
  api?: AccountApi
}) {
  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <SettingsSection
        id="profile"
        title="Profile"
        description="How others see you next to your lessons."
      >
        <AvatarForm initial={image} handle={handle} api={api} />
        <HandleForm initial={handle} api={api} />
      </SettingsSection>

      <Separator />

      <SettingsSection
        id="log-in"
        title="Log-in"
        description="How you get into your account."
      >
        <LogInMethods
          email={email}
          github={github}
          error={githubError}
          api={api}
        />
      </SettingsSection>

      <Separator />

      <SettingsSection
        id="apps"
        title="Connected apps"
        description="Chat apps that publish lessons as you."
      >
        <ConnectedApps initial={apps} api={api} />
      </SettingsSection>

      <Separator />

      <SettingsSection
        id="mcp-url"
        title="Personal MCP URL"
        description="For chat apps that can't log in."
      >
        <ConnectChat initial={connection} api={api} />
      </SettingsSection>

      <Separator />

      <SettingsSection
        id="keys"
        title="API keys"
        description="For publishing from the terminal."
      >
        <ApiKeys initial={keys} api={api} />
      </SettingsSection>

      <Separator />

      <SettingsSection
        id="delete"
        title="Delete account"
        description="Your account and everything in it, for good."
      >
        <DeleteAccount email={email} api={api} />
      </SettingsSection>
    </div>
  )
}
