import Link from "next/link"

import { Separator } from "@workspace/ui/components/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { CopyButton } from "@/components/site/copy-button"
import { INSTALL_COMMAND, MCP_URL } from "@/lib/site"

const OPTIONS = [
  {
    id: "cli",
    label: "CLI",
    value: INSTALL_COMMAND,
    hint: "For Claude Code, Codex, Cursor, and more.",
    href: "/docs#install",
    link: "Install guide",
  },
  {
    id: "mcp",
    label: "MCP",
    value: MCP_URL,
    hint: "For Claude, ChatGPT, and other chat apps.",
    href: "/docs#mcp",
    link: "How to connect",
  },
]

export function GetStarted() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-20 px-4 sm:gap-28 sm:px-6">
      <Separator />
      <div className="flex flex-col items-center gap-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Get started
        </h2>
        <Tabs className="w-full max-w-md items-center gap-4">
          <TabsList>
            {OPTIONS.map((option) => (
              <TabsTrigger key={option.id} id={option.id}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {OPTIONS.map((option) => (
            <TabsContent
              key={option.id}
              id={option.id}
              className="flex w-full flex-col items-center gap-3"
            >
              <span className="flex w-full items-center gap-1 rounded-lg border bg-background py-1 ps-3 pe-1 shadow-xs dark:bg-input/30">
                <code
                  dir="ltr"
                  className="min-w-0 flex-1 truncate text-start font-mono text-sm"
                >
                  {option.value}
                </code>
                <CopyButton text={option.value} size="icon-sm" variant="ghost" />
              </span>
              <p className="text-sm text-pretty text-muted-foreground">
                {option.hint}{" "}
                <Link
                  href={option.href}
                  className="underline underline-offset-3 hover:text-foreground"
                >
                  {option.link}
                </Link>
              </p>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
