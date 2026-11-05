import { Stack } from "expo-router"

import { colors } from "../../tokens"

// The stack inside each tab: the system's navigation bar, with a large title that shrinks into
// the bar as the list scrolls (each screen's list sets contentInsetAdjustmentBehavior so it can),
// the native back button and edge swipe, and the app's dark colors. The bar follows the system's
// direction; a screen's content follows the app's language (components/direction.tsx), and the
// bar catches up from the next launch (lib/direction-effect.ts).

export function TabStack() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground },
        headerLargeTitleStyle: { color: colors.foreground },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  )
}
