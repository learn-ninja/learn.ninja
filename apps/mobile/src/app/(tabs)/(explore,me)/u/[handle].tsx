import { useLocalSearchParams } from "expo-router"

import { ProfileView } from "@/components/profile-view"

// A person's profile at /u/{handle}, the web's path, opened from a row's byline or a link. It's
// in both tabs' stacks, so it opens in whichever tab it was opened from.
export default function Profile() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  return <ProfileView handle={handle} />
}
