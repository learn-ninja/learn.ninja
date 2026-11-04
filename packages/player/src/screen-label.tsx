import { cn } from "@workspace/ui/lib/utils"

/**
 * The quiet eyebrow above a screen's content ("Warm-up" over the hook, "Scenario" over the ninja's
 * brief): mono, one size down, muted. One definition, so every screen's label looks the same; the
 * site's section eyebrows (`apps/web/app/mission/page.tsx`) copy these classes.
 */
export function ScreenLabel({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <p className={cn("font-mono text-sm text-muted-foreground", className)}>
      {text}
    </p>
  )
}
