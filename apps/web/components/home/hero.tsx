"use client"

import { ButtonLink } from "@/components/site/button-link"
import { CopyButton } from "@/components/site/copy-button"
import { SETUPS } from "@/lib/site"
import { useSetup } from "@/lib/use-setup"

import { HeroDemo } from "./hero-demo"
import { RotatingWord } from "./rotating-word"
import { SetupAgents, SetupPicker } from "./setup-picker"

const TOPICS = ["design", "coding", "data", "math", "science", "history"]

export function Hero() {
  const setup = useSetup()

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-24 px-4 py-20 sm:px-6 sm:py-28">
      <div className="flex w-full flex-col items-start gap-6">
        {/* The header has no room for the CLI/MCP toggle on phones, so it sits here. */}
        <SetupPicker className="sm:hidden" />
        <SetupAgents />
        <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-5xl sm:leading-[1.05]">
          Vibe learn <span className="sr-only">anything</span>
          <span aria-hidden="true">
            <RotatingWord words={TOPICS} />
          </span>
          <br />
          with your agent
        </h1>
        <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
          Give your agent an article, notes, docs, a transcript, or code. It
          writes one short lesson you play in the browser, and gives you a link
          to share. Free, no account.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={SETUPS[setup].prompt} size="lg">
            Copy prompt
          </CopyButton>
          {/* Play one before installing anything: the bundled Spanish greetings lesson */}
          <ButtonLink
            href="/lessons/spanish-greetings"
            variant="outline"
            size="lg"
          >
            Try a lesson
          </ButtonLink>
        </div>
      </div>
      {/* The product shot follows the setup toggle: a terminal for the skill, a chat window for MCP.
          The key restarts its story on a switch. One image for assistive tech; its words are drawn, not read. */}
      <div
        role="img"
        aria-label="A prompt typed into an agent comes back as a lesson link, and the lesson plays on a phone."
        className="w-full"
      >
        <HeroDemo key={setup} setup={setup} />
      </div>
    </section>
  )
}
