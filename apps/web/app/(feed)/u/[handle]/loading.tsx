import { Skeleton } from "@workspace/ui/components/skeleton"

import { FeedSkeleton } from "@/components/explore/feed-skeleton"

/** A profile's shape until it arrives: the picture, the name, the handle line, the tabs, then the rows. See explore/loading.tsx. */
export default function ProfileLoading() {
  return (
    <>
      <h1 className="sr-only">Profile</h1>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="flex items-center gap-4 sm:gap-5">
          <Skeleton className="size-16 shrink-0 rounded-full sm:size-20" />
          {/* The name: one line of text-3xl (36px), text-4xl (40px) from sm. */}
          <Skeleton className="my-1.5 h-6 w-48 sm:my-2 sm:h-7" />
        </div>
        {/* The handle line: text-base, 24px. */}
        <Skeleton className="my-1 h-4 w-48 max-w-full" />
      </div>
      {/* The tabs: h-8. */}
      <Skeleton className="my-1.5 h-5 w-40" />
      <FeedSkeleton />
    </>
  )
}
