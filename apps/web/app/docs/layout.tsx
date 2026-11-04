import { DocsNav, MobileDocsNav } from "@/components/docs/docs-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { docsNavSections } from "@/lib/docs-nav"

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sections = docsNavSections()
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader start={<MobileDocsNav sections={sections} />} />
      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-10 px-4 sm:px-6">
        {/* Padded like the page so the first link lines up with the top of the body. */}
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-40 shrink-0 overflow-y-auto py-8 [scrollbar-width:none] sm:py-10 lg:block [&::-webkit-scrollbar]:hidden">
          <DocsNav sections={sections} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <SiteFooter className="max-w-5xl" />
    </div>
  )
}
