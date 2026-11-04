"use client"

import { AGENT_PROMPT } from "@/lib/site"

import { CopyButton } from "./copy-button"

/**
 * A small "Copy prompt" for the header. Phones don't get it: next to the wordmark and
 * the nav it doesn't fit in 375px. The home page doesn't use it: its hero has the button.
 */
export function HeaderCopyPrompt() {
  return (
    <div className="shrink-0 max-sm:hidden">
      <CopyButton text={AGENT_PROMPT} variant="ghost" size="sm">
        Copy prompt
      </CopyButton>
    </div>
  )
}
