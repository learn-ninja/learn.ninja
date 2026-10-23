import { Skeleton } from "@workspace/ui/components/skeleton"

import { FeedSkeleton } from "@/components/explore/feed-skeleton"

/** A profile's shape until it arrives: the handle line, the box of activity and tabs, then the rows. See explore/loading.tsx. */
export default function ProfileLoading() {
  return (
    <>
      <h1 className="sr-only">Profile</h1>
      {/* The handle line: a 24px picture beside text-sm. */}
      <div aria-hidden="true" className="flex items-center gap-2">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      {/* The box of activity and tabs, as wide as a hovered row. */}
      <Skeleton className="-mx-3 h-56 rounded-xl sm:-mx-4" />
      {/* The rows sit closer to the box than main's gap: ProfileTabs' gap-4. */}
      <FeedSkeleton className="-mt-4" />
    </>
  )
}
