import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

/** Row widths cycle so the placeholder reads as text rather than a grid. */
const TITLE_WIDTHS = ["w-3/5", "w-2/3", "w-1/2", "w-3/4"]
const LINE_WIDTHS = ["w-4/5", "w-2/3", "w-11/12", "w-3/5"]

/**
 * The feed's shape while its rows load: hairlines and line heights match LessonRow, so nothing
 * shifts when the rows arrive. Decorative: the page's loading state names itself in its heading.
 */
export function FeedSkeleton({
  rows = 8,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="not-first:border-t">
          {/* LessonRow's transparent border, kept for its hover tile. */}
          <div className="flex flex-col border-y border-transparent py-5">
            {/* The byline: a 20px picture and handle, the age at the end. */}
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-3.5 w-16" />
              </span>
              <Skeleton className="h-3.5 w-20" />
            </div>
            {/* The title: one 22px line of text-base. */}
            <Skeleton
              className={cn("my-[3px] mt-2 h-4", TITLE_WIDTHS[i % 4])}
            />
            {/* The summary: two 20px lines of text-sm. */}
            <Skeleton className="my-[3px] mt-1 h-3.5 w-full" />
            <Skeleton className={cn("my-[3px] h-3.5", LINE_WIDTHS[i % 4])} />
            {/* The meta line, as tall as the like button. */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <Skeleton className="my-[5px] h-3.5 w-1/3" />
              <Skeleton className="my-[5px] h-3.5 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
