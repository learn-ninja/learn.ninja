"use client"

import Link from "next/link"

import { CopyButton } from "@/components/site/copy-button"
import { SETUPS } from "@/lib/site"
import { useSetup } from "@/lib/use-setup"

const GUIDES = {
  cli: { href: "/docs#install", link: "Install guide" },
  mcp: { href: "/docs/reference/mcp", link: "How to connect" },
}

export function GetStarted() {
  const setup = useSetup()
  const guide = GUIDES[setup]

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-start gap-6 px-4 py-20 sm:px-6 sm:py-28">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Get started
        </h2>
        <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
          Copy the prompt, paste it into your agent, and finish it with what you
          want to learn.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <CopyButton text={SETUPS[setup].prompt} size="lg">
          Copy prompt
        </CopyButton>
        <Link
          href={guide.href}
          className="text-sm text-muted-foreground underline underline-offset-3 hover:text-foreground"
        >
          {guide.link}
        </Link>
      </div>
    </section>
  )
}
