"use client"

import { cn } from "@workspace/ui/lib/utils"

import { CopyButton } from "@/components/site/copy-button"
import { SETUPS } from "@/lib/site"
import { useSetup } from "@/lib/use-setup"

import { SetupPicker } from "./setup-picker"

/**
 * The bar fixed to the bottom of the home page: the prompt for the CLI/MCP choice. The toggle sits
 * in the header next to the wordmark, and here only on phones, where the header has no room. The
 * hero's agents and product shot, Get started's guide link, and every copy button follow it. `fixed` off renders it in the flow, for stories.
 */
export function SetupBar({
  fixed = true,
  className,
}: {
  fixed?: boolean
  className?: string
}) {
  const setup = useSetup()

  return (
    <div
      className={cn(
        "border-t bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/70",
        fixed &&
          "fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      <div className="mx-auto flex h-12 w-full max-w-3xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <p className="text-sm font-medium whitespace-nowrap">
          Get started with
          <span className="max-sm:hidden"> {SETUPS[setup].label}</span>
        </p>
        <SetupPicker className="sm:hidden" />
        <CopyButton text={SETUPS[setup].prompt} size="sm" className="ms-auto">
          Copy<span className="max-sm:sr-only"> prompt</span>
        </CopyButton>
      </div>
    </div>
  )
}
