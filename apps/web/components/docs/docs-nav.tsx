"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnchorProvider, TOCItem } from "fumadocs-core/toc"
import { PanelLeftIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetTitle } from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"

/** A heading in a docs page, as a sidebar link. */
export type NavHeading = { title: string; id: string }
/** A docs page, with its level-2 headings. */
export type NavPage = {
  name: string
  url: string
  headings: NavHeading[]
}
/** A sidebar section: a separator in docs/meta.json and the pages after it. */
export type NavSection = { name: string; pages: NavPage[] }

/**
 * The docs sidebar. Sections collapse to their name; the one holding the page being read opens on
 * its own, and a click opens or closes any of them. An open section lists its pages, and under the
 * page being read its headings, marking the one in view.
 */
export function DocsNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[]
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const current = sections
    .flatMap((s) => s.pages)
    .find((page) => page.url === pathname)
  const toc = (current?.headings ?? []).map((h) => ({
    title: h.title,
    url: `#${h.id}`,
    depth: 2,
  }))
  return (
    <AnchorProvider toc={toc} single>
      <NavSections
        sections={sections}
        current={current}
        onNavigate={onNavigate}
      />
    </AnchorProvider>
  )
}

function NavSections({
  sections,
  current,
  onNavigate,
}: {
  sections: NavSection[]
  current?: NavPage
  onNavigate?: () => void
}) {
  const reading = sections.find((section) =>
    section.pages.some((page) => page.url === current?.url)
  )?.name
  // Sections the reader opened or closed by hand, on top of the one being read.
  const [opened, setOpened] = React.useState<Set<string>>(() => new Set())
  const [closed, setClosed] = React.useState<Set<string>>(() => new Set())
  // Moving to another section starts over, so one section is open at a time, like an accordion.
  React.useEffect(() => {
    setOpened(new Set())
    setClosed(new Set())
  }, [reading])
  const isOpen = (name: string) =>
    (name === reading || opened.has(name)) && !closed.has(name)
  const toggle = (name: string) => {
    const open = isOpen(name)
    setOpened((s) => edit(s, name, !open))
    setClosed((s) => edit(s, name, open))
    return !open
  }

  return (
    <nav aria-label="Docs" className="-mt-0.5 flex flex-col gap-1 text-sm">
      {sections.map((section) => {
        const first = section.pages[0]
        if (!first) return null
        const open = isOpen(section.name)
        return (
          <div key={section.name}>
            {/* Opens the section and goes to its first page; a second click only closes it. */}
            <Link
              href={first.url}
              aria-expanded={open}
              onClick={(e) => {
                const nowOpen = toggle(section.name)
                if (!nowOpen) e.preventDefault()
                else onNavigate?.()
              }}
              className={cn(
                "block rounded-md px-3 py-1.5 font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                open && "bg-accent text-foreground"
              )}
            >
              {section.name}
            </Link>
            {open ? (
              <div className="ms-3 mt-1 flex flex-col border-s ps-2">
                {section.pages.length === 1 ? (
                  <PageHeadings
                    page={first}
                    current={first.url === current?.url}
                    onNavigate={onNavigate}
                  />
                ) : (
                  section.pages.map((page) => {
                    const here = page.url === current?.url
                    return (
                      <div key={page.url} className="mt-2 first:mt-0">
                        <Link
                          href={page.url}
                          aria-current={here ? "page" : undefined}
                          onClick={onNavigate}
                          className={cn(
                            "block rounded-md px-2 pt-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                            here && "text-foreground"
                          )}
                        >
                          {page.name}
                        </Link>
                        <PageHeadings
                          page={page}
                          current={here}
                          onNavigate={onNavigate}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}

function edit(set: Set<string>, name: string, add: boolean): Set<string> {
  if (set.has(name) === add) return set
  const next = new Set(set)
  if (add) next.add(name)
  else next.delete(name)
  return next
}

/** A page's headings, marking the one in view on the page being read. Other pages show none. */
function PageHeadings({
  page,
  current,
  onNavigate,
}: {
  page: NavPage
  current: boolean
  onNavigate?: () => void
}) {
  if (!current || page.headings.length === 0) return null
  return (
    <div className="flex flex-col">
      {page.headings.map((heading) => (
        <TOCItem
          key={heading.id}
          href={`#${heading.id}`}
          onClick={onNavigate}
          className="relative block rounded-md py-1 ps-3 pe-2 font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[active=true]:text-foreground data-[active=true]:before:absolute data-[active=true]:before:-start-[9px] data-[active=true]:before:top-1 data-[active=true]:before:h-5 data-[active=true]:before:w-px data-[active=true]:before:bg-foreground"
        >
          {heading.title}
        </TOCItem>
      ))}
    </div>
  )
}

/** The sidebar in a sheet, for screens without room for it. Its button is a panel, not the
 * site menu's hamburger, since on phones both sit in the header. */
export function MobileDocsNav({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Docs menu"
        className="lg:hidden"
        onPress={() => setOpen(true)}
      >
        <PanelLeftIcon className="rtl:-scale-x-100" />
      </Button>
      <Sheet side="start" isOpen={open} onOpenChange={setOpen}>
        <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
          <SheetTitle className="px-3">Docs</SheetTitle>
          <DocsNav sections={sections} onNavigate={() => setOpen(false)} />
        </div>
      </Sheet>
    </>
  )
}
