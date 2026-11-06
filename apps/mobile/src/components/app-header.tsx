import { router } from "expo-router"
import type { ReactNode } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { Strings } from "@workspace/player-core/strings"

import { BackIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

// The header over the app's own screens (Explore, a profile, settings), 56 points tall under the
// status bar like the lesson's: the way back at the start when there's somewhere to go back to,
// the screen's title, and its controls at the end.

export function AppHeader({
  title,
  back,
  end,
  t,
}: {
  title?: ReactNode
  /** Shows the way back (to where it was opened from, or home). */
  back?: boolean
  end?: ReactNode
  t: Strings
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ paddingTop: insets.top }} className="bg-background">
      <View className="h-14 flex-row items-center gap-3 px-4">
        {back ? (
          <Button
            variant="ghost"
            size="icon"
            className="-ms-2 h-8 w-8"
            hitSlop={6}
            accessibilityLabel={t.home}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          >
            <BackIcon />
          </Button>
        ) : null}
        <View className="min-w-0 flex-1">
          {typeof title === "string" ? (
            <Text
              numberOfLines={1}
              className="text-base font-semibold"
              accessibilityRole="header"
            >
              {title}
            </Text>
          ) : (
            title
          )}
        </View>
        {end}
      </View>
    </View>
  )
}
