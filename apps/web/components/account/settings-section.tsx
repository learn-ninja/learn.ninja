import * as React from "react"

import {
  ItemGroup,
  ItemSeparator,
} from "@workspace/ui/components/item"

/**
 * One section of the settings page: its title and a line about it on the start side, its
 * controls beside them. Stacked on phones.
 */
export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  /** A short line under the title, only where the controls don't explain themselves. */
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="font-semibold">
          {title}
        </h2>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  )
}

/** The rows of a section (apps, keys, the URL) on one card, a line between each. */
export function SettingsList({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children)
  return (
    <ItemGroup className="gap-0 rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      {rows.map((row, i) => (
        <React.Fragment key={React.isValidElement(row) ? row.key : i}>
          {i ? <ItemSeparator className="my-0" /> : null}
          {row}
        </React.Fragment>
      ))}
    </ItemGroup>
  )
}
