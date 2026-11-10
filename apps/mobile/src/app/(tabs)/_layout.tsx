import { NativeTabs } from "expo-router/native-tabs"

import { QuickActionsEffect } from "@/lib/quick-actions"
import { RemindersEffect } from "@/lib/reminders"
import { useSession } from "@/lib/session"
import { useAppStrings } from "@/lib/use-strings"
import { colors } from "../../../tokens"

// The app's two places, as the system's tab bar (Liquid Glass on iOS 26 and later): Explore, and
// the learner's own profile; development builds add a third, Dev, with the test lessons. A second tap on a tab scrolls it to the top or pops it to its root,
// as every iOS app's tabs do. The bar runs the app's language's way. Lessons and the log-in open over the tabs (the root layout).
// Logged out, there's no bar (but in development builds): Explore is the whole app, with Log in
// at its top, and the profile tab (which would only ask to log in) sends anyone who lands on it
// back there.

export default function TabsLayout() {
  const { t, dir } = useAppStrings()
  const session = useSession()
  return (
    <>
      <QuickActionsEffect />
      <RemindersEffect />
      <NativeTabs
        // Hidden rather than taken out, so logging in or out keeps Explore where it was.
        // Development builds keep it, so the Dev tab's test lessons stay in reach logged out.
        hidden={session.state === "out" && !__DEV__}
        // The app's language's direction for the tab bar and, through UIKit's traits, everything
        // under it: each tab's bar and its large title mirror at once, without a relaunch.
        unstable_nativeProps={{ direction: dir }}
        tintColor={colors.foreground}
        iconColor={{
          default: colors.muted.foreground,
          selected: colors.foreground,
        }}
        labelStyle={{
          default: { color: colors.muted.foreground },
          selected: { color: colors.foreground },
        }}
      >
        <NativeTabs.Trigger name="(explore)">
          <NativeTabs.Trigger.Icon
            sf={{ default: "safari", selected: "safari.fill" }}
          />
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
        <NativeTabs.Trigger name="(dev)" hidden={!__DEV__}>
          <NativeTabs.Trigger.Icon
            sf={{ default: "hammer", selected: "hammer.fill" }}
          />
          <NativeTabs.Trigger.Label>Dev</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  )
}
