import Link from "next/link"

import { ButtonLink } from "@/components/site/button-link"
import { CopyButton } from "@/components/site/copy-button"
import { LogoDivider } from "@/components/site/logo-divider"
import { AGENT_PROMPT, MCP_URL } from "@/lib/site"

export function GetStarted() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-20 px-4 sm:gap-28 sm:px-6">
      <LogoDivider />
      <div className="flex flex-col items-center gap-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Get started
        </h2>
        <p className="max-w-md text-base text-pretty text-muted-foreground sm:text-lg">
          Paste the prompt into your agent and finish the sentence with what you
          want to learn.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <CopyButton text={AGENT_PROMPT} size="lg">
            Copy prompt for agent
          </CopyButton>
          <ButtonLink href="/docs#install" variant="outline" size="lg">
            Install guide
          </ButtonLink>
        </div>
        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          <p className="text-sm text-pretty text-muted-foreground">
            In Claude, ChatGPT, or another chat app, add the MCP server instead.{" "}
            <Link
              href="/docs#mcp"
              className="underline underline-offset-3 hover:text-foreground"
            >
              How to connect
            </Link>
          </p>
          <span className="flex w-full items-center gap-2">
            <code
              dir="ltr"
              className="min-w-0 flex-1 truncate rounded-md border bg-background px-2 py-1 text-start font-mono text-sm shadow-xs dark:bg-input/30"
            >
              {MCP_URL}
            </code>
            <CopyButton text={MCP_URL} size="sm" variant="outline">
              Copy
            </CopyButton>
          </span>
        </div>
      </div>
    </section>
  )
}
