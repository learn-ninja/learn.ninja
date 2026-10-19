"use client"

import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import type { ExploreSort } from "@/lib/explore/queries"

const TABS: { id: ExploreSort; label: string; href: string }[] = [
  { id: "new", label: "New", href: "/explore" },
  { id: "trending", label: "Trending", href: "/explore?sort=trending" },
  { id: "top", label: "Top", href: "/explore?sort=top" },
]

/** New, Trending, and Top as links, so each tab is a page the server renders and caches. */
export function ExploreTabs({ sort }: { sort: ExploreSort }) {
  return (
    <Tabs selectedKey={sort} aria-label="Sort lessons">
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.id} id={tab.id} href={tab.href}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
