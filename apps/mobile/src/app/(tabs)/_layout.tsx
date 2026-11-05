import { NativeTabs } from "expo-router/native-tabs"

import { useAppStrings } from "@/lib/use-strings"
import { colors } from "../../../tokens"

// The app's two places, as the system's tab bar (Liquid Glass on iOS 26 and later): Explore, and
// the learner's own profile. A second tap on a tab scrolls it to the top or pops it to its root,
// as every iOS app's tabs do. Lessons and the log-in open over the tabs (the root layout).

export default function TabsLayout() {
  const { t } = useAppStrings()
  return (
    <NativeTabs
      tintColor={colors.foreground}
      iconColor={{ default: colors.muted.foreground, selected: colors.foreground }}
      labelStyle={{
        default: { color: colors.muted.foreground },
        selected: { color: colors.foreground },
      }}
    >
      <NativeTabs.Trigger name="(explore)">
        <NativeTabs.Trigger.Icon sf={{ default: "safari", selected: "safari.fill" }} />
        <NativeTabs.Trigger.Label>{t.feed.title}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(me)">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
        />
        <NativeTabs.Trigger.Label>{t.profile.tab}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
