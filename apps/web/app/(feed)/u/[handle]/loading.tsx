import { Skeleton } from "@workspace/ui/components/skeleton"

import { FeedSkeleton } from "@/components/explore/feed-skeleton"

/** A profile's shape until it arrives: the handle line, the tabs, then the rows. See explore/loading.tsx. */
export default function ProfileLoading() {
  return (
    <>
      <h1 className="sr-only">Profile</h1>
      {/* The handle line: a 24px picture beside text-sm. */}
      <div aria-hidden="true" className="flex items-center gap-2">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      {/* The tabs: h-8. */}
      <Skeleton className="h-8 w-40 rounded-lg" />
      <FeedSkeleton />
    </>
  )
}
