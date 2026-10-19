import { ButtonLink } from "@/components/site/button-link"
import { Wordmark } from "@/components/site/wordmark"

/**
 * An expired or unknown lesson link, or one hidden after a report. Sent with HTTP 200, not 404:
 * chat apps and social sites show no card for a 404, and the expired card is how someone sees the
 * link died before they click.
 */
export function LessonExpired({
  reason = "expired",
}: {
  reason?: "expired" | "hidden"
}) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 px-6">
      <Wordmark className="self-start" />
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          This lesson isn&apos;t available
        </h1>
        <p className="text-muted-foreground">
          {reason === "hidden"
            ? "It was taken down after a report. If it's yours, sign in and it still opens for you."
            : "Lessons expire 7 days after they're published. Ask whoever shared it to publish it again for a new link."}
        </p>
      </div>
      <div className="flex gap-2">
        <ButtonLink href="/" variant="outline" size="sm">
          Make your own
        </ButtonLink>
        {reason === "hidden" ? (
          <ButtonLink href="/sign-in" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
        ) : null}
      </div>
    </main>
  )
}
