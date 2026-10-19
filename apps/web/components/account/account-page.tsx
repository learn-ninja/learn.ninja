import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import type { AccountInfo } from "@/lib/auth/account-info"

/** The frame for the sign-in, settings, and keep pages: a narrow centered column. */
export function AccountPage({
  account,
  wide = false,
  children,
}: {
  /** The signed-in user, or null when nobody is signed in. */
  account: AccountInfo | null
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader account={account} />
      <main
        className={
          wide
            ? "mx-auto flex w-full max-w-2xl flex-1 flex-col gap-12 px-4 py-12 sm:px-6 sm:py-16"
            : "mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6"
        }
      >
        {children}
      </main>
      <SiteFooter className="max-w-3xl" />
    </div>
  )
}
