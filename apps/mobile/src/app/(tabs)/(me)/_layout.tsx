import { TabStack } from "@/components/tab-stack"

// The profile tab: the learner's own profile (or the log-in call), its settings, and the profiles
// opened from it.
export const unstable_settings = { initialRouteName: "me" }

export default function MeLayout() {
  return <TabStack />
}
