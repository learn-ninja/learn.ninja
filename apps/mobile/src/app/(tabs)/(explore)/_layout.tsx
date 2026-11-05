import { TabStack } from "@/components/tab-stack"

// Explore's tab: the feed, and the profiles opened from it.
export const unstable_settings = { initialRouteName: "index" }

export default function ExploreLayout() {
  return <TabStack />
}
