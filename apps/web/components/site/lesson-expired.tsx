import { ButtonLink } from "@/components/site/button-link"
import { Wordmark } from "@/components/site/wordmark"

/**
 * An expired or unknown lesson link. Sent with HTTP 200, not 404: chat apps and social sites show no
 * card for a 404, and the expired card is how someone sees the link died before they click.
 */
export function LessonExpired() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 px-6">
      <Wordmark className="self-start" />
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          This lesson isn&apos;t available
        </h1>
        <p className="text-muted-foreground">
          Lessons expire 7 days after they&apos;re published. Ask whoever
          shared it to publish it again for a new link.
        </p>
      </div>
      <ButtonLink href="/" variant="outline" size="sm" className="self-start">
        Make your own
      </ButtonLink>
    </main>
  )
}
