import { router } from "expo-router"
import { ActivityIndicator, View, type ViewStyle } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

// The pieces of a tab's list. A tab screen's list is its root view (no View around it; the
// screen's direction goes on the list itself), there from the first render, and what's waiting,
// failed or logged out is drawn inside it, never in place of it: iOS shrinks the bar's large
// title only for a scroll view at the very start of the screen's views, and finds it once, as the
// screen appears. The list then sets `contentContainerClassName` with `grow` so these sit in the
// middle of the screen.

/** A tab list's own direction (its content takes the screen's): see the screens for why. */
export const LTR: ViewStyle = { direction: "ltr" }

/** The hairline between two rows of a lesson list. */
export function Hairline() {
  return <View className="h-px bg-border" />
}

/** An empty list's dashed box, as the web's Explore and profiles draw it. */
export function Empty({ children }: { children: string }) {
  return (
    <View className="mt-4 rounded-xl border border-dashed border-border p-8">
      <Text className="text-center text-sm text-muted-foreground">
        {children}
      </Text>
    </View>
  )
}

/** The spinner while a list's first page loads, in the middle of the screen. */
export function Loading() {
  return (
    <View className="flex-1 items-center justify-center py-12">
      <ActivityIndicator />
    </View>
  )
}

/** Why a list couldn't load, with Try again when asking again could help. */
export function Failed({
  message,
  retry,
}: {
  message: string
  retry?: { label: string; onPress: () => void }
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 py-12">
      <Text className="text-center text-sm text-muted-foreground">
        {message}
      </Text>
      {retry ? (
        <Button variant="outline" onPress={retry.onPress}>
          <Text>{retry.label}</Text>
        </Button>
      ) : null}
    </View>
  )
}

/**
 * A card in the middle of an empty tab that asks for one step: a title, a line on why, and the
 * button that takes it (log in, or choose a handle).
 */
export function CallCard({
  title,
  body,
  action,
  onPress,
}: {
  title: string
  body: string
  action: string
  onPress: () => void
}) {
  return (
    <View className="mx-auto w-full max-w-lg py-6">
      <View className="gap-4 rounded-xl bg-card p-6 shadow-xs">
        <View className="gap-2">
          <Text
            className="text-2xl font-semibold tracking-tight"
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text className="text-base text-muted-foreground">{body}</Text>
        </View>
        <Button size="lg" onPress={onPress}>
          <Text>{action}</Text>
        </Button>
      </View>
    </View>
  )
}

/** The call to log in, with what logging in gives on this tab. */
export function LogInCard({
  title,
  body,
  t,
}: {
  title: string
  body: string
  t: Strings
}) {
  return (
    <CallCard
      title={title}
      body={body}
      action={t.logIn}
      onPress={() => router.push("/sign-in")}
    />
  )
}
