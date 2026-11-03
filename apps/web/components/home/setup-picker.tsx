"use client"

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import { logoMask } from "@/components/site/agent-logos"
import { SETUPS, type SetupId } from "@/lib/site"
import { setSetup, useSetup } from "@/lib/use-setup"

/** The CLI/MCP toggle. */
export function SetupPicker({ className }: { className?: string }) {
  const setup = useSetup()

  return (
    <ToggleGroup
      className={className}
      aria-label="How your agent sets up learn.ninja"
      variant="outline"
      size="sm"
      spacing={1}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[setup]}
      onSelectionChange={(keys) => {
        const [next] = keys
        if (next !== undefined) setSetup(next as SetupId)
      }}
    >
      {Object.values(SETUPS).map((option) => (
        // Selected as other controls are: the toggle's own fill alone vanishes in dark mode.
        <ToggleGroupItem
          key={option.id}
          id={option.id}
          className="text-sm data-selected:border-primary"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** Who the chosen setup is for. */
export function SetupAgents() {
  const setup = useSetup()

  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      For
      {SETUPS[setup].agents.map((agent) => (
        <span key={agent.name} className="flex items-center gap-0.5">
          <span
            role="img"
            aria-label={agent.name}
            title={agent.name}
            className="block size-4 bg-foreground/70"
            style={logoMask(agent.logo)}
          />
          ,
        </span>
      ))}
      and more.
    </p>
  )
}
