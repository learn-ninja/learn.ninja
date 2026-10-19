import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { accountOf } from "@/lib/auth/account-info"
import { currentActor } from "@/lib/auth/session"

/**
 * The frame around Explore and the profiles: header, a narrow column, footer. Sharing it means
 * moving between the two swaps only what's under the header: the frame stays mounted, and the
 * page's loading state (loading.tsx next to each page) shows the moment a link is followed.
 * The session is read once per request (currentActor is memoized), here and in the page.
 */
export default async function FeedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const actor = await currentActor()
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader account={accountOf(actor)} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
        {children}
      </main>
      <SiteFooter className="max-w-2xl" />
    </div>
  )
}
