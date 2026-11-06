import { Stack } from "expo-router"
import { Platform } from "react-native"
import { LocaleDirContext } from "expo-router/react-navigation"

import { useAppStrings } from "@/lib/use-strings"
import { colors } from "../../tokens"

// The stack inside each tab: the system's navigation bar, with a large title that shrinks into
// the bar as the list scrolls (each screen's list is its root view and sets
// contentInsetAdjustmentBehavior so it can), the native back button and edge swipe, and the app's
// dark colors. The bar runs the app's language's way at once: React Navigation's direction is what
// react-native-screens sets on the bar and the back swipe, and the tabs (app/(tabs)/_layout.tsx)
// pass the same direction to UIKit, where the large title takes it from.

export function TabStack() {
  const { dir } = useAppStrings()
  return (
    <LocaleDirContext value={dir}>
      <Stack
        screenOptions={{
          headerLargeTitle: true,
          // See-through, as iOS's own large-title screens are: the list runs under the bar (its
          // contentInsetAdjustmentBehavior keeps the first row clear) and the system's scroll-edge
          // effect shades the bar as content passes beneath. An opaque bar makes
          // react-native-screens wrap the screen in its own safe-area view, and the large title
          // then never draws. iOS only: Android has no large title, and its lists don't inset
          // themselves under a see-through bar.
          headerTransparent: Platform.OS === "ios",
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          headerTintColor: colors.foreground,
          headerTitleStyle: { color: colors.foreground },
          headerLargeTitleStyle: { color: colors.foreground },
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </LocaleDirContext>
  )
}
