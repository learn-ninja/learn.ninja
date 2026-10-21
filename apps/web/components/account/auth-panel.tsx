import Link from "next/link"

import { Wordmark } from "@/components/site/wordmark"

/**
 * The frame for signing in and connecting a chat app (Agendolo's auth panel): no site header or
 * footer, just the wordmark linking home and the page's content beneath it, centered in a narrow
 * column with the viewport's height around it. `footer` (the legal line) sits at the bottom.
 */
export function AuthPanel({
  children,
  footer,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col px-4 sm:px-6">
      <main className="flex flex-1 flex-col items-center justify-center py-12">
        <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
          <Wordmark />
          {children}
        </div>
      </main>
      {footer ? (
        <footer className="pb-6 text-center text-sm text-pretty text-muted-foreground sm:pb-10">
          {footer}
        </footer>
      ) : null}
    </div>
  )
}

const LINK =
  "rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

/** The line under every sign-in. "Continuing" covers a first visit and a hundredth alike. */
export function LegalConsent() {
  return (
    <p>
      By continuing, you agree to the{" "}
      <Link href="/terms" className={LINK}>
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className={LINK}>
        Privacy Policy
      </Link>
      .
    </p>
  )
}

/** The panel's heading and the line under it. */
export function AuthHeading({
  title,
  children,
}: {
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <p className="text-pretty text-muted-foreground">{children}</p>
    </div>
  )
}
