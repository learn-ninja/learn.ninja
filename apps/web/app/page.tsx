import type { Metadata } from "next"

import { Faq } from "@/components/home/faq"
import { GetStarted } from "@/components/home/get-started"
import { Hero } from "@/components/home/hero"
import { HeaderCopyPrompt } from "@/components/site/header-copy-prompt"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    types: { "text/markdown": "/index.md", "text/plain": "/llms.txt" },
  },
}

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader action={<HeaderCopyPrompt afterHero />} />
      <main className="flex-1">
        <Hero />
        <Faq />
        <GetStarted />
      </main>
      <SiteFooter className="max-w-3xl" />
    </div>
  )
}
