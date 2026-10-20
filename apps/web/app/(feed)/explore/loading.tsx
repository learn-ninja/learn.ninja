import { FeedSkeleton } from "@/components/explore/feed-skeleton"

/**
 * What Explore shows until its list arrives. Next prefetches this with the route and swaps it in
 * the instant a link to Explore is followed, so a click answers at once even though the list
 * itself is rendered on the server for every request.
 */
export default function ExploreLoading() {
  return (
    <>
      <h1 className="sr-only">Explore</h1>
      <FeedSkeleton />
    </>
  )
}
