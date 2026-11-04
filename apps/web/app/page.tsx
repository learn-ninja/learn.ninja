import type { Metadata } from "next"

import { Faq } from "@/components/home/faq"
import { GetStarted } from "@/components/home/get-started"
import { Hero } from "@/components/home/hero"
import { MadeThisWeek } from "@/components/home/made-this-week"
import { SectionDivider } from "@/components/home/section-divider"
import { SetupPicker } from "@/components/home/setup-picker"
import { SiteFooter } from "@/components/site/site-footer"
import { JsonLd } from "@/components/site/json-ld"
import { SiteHeader } from "@/components/site/site-header"
import { homeJsonLd } from "@/lib/json-ld"

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    types: { "text/markdown": "/index.md", "text/plain": "/llms.txt" },
  },
}

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader action={<SetupPicker className="max-sm:hidden" />} />
      <JsonLd data={homeJsonLd()} />
      <main className="flex-1">
        <Hero />
        <MadeThisWeek />
        <SectionDivider />
        <Faq />
        <SectionDivider />
        <GetStarted />
        <SectionDivider />
      </main>
      <SiteFooter className="max-w-3xl" />
    </div>
  )
}
