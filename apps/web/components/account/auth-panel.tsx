import Link from "next/link"

import { Wordmark } from "@/components/site/wordmark"

/**
 * The frame for signing in and connecting a chat app (Agendolo's auth panel): no site header or
 * footer, just the wordmark linking home, centered in a bar as tall as the site header's (so it
 * sits the same distance from the top), and the page's content in a narrow column centered in the
 * height left. `footer` (the legal line) sits at the bottom. The
 * whole panel fades and rises in over 300ms when it loads (skipped for reduced motion).
 */
export function AuthPanel({
  children,
  footer,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col px-4 sm:px-6 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both">
      <div className="flex h-14 shrink-0 items-center justify-center sm:h-16">
        <Wordmark />
      </div>
      <main className="flex flex-1 flex-col items-center justify-center py-12">
        <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
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
