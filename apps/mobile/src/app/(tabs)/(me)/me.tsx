import { router, Stack } from "expo-router"
import { ActivityIndicator, ScrollView, View } from "react-native"

import { DirectionView } from "@/components/direction"
import { ProfileView } from "@/components/profile-view"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { useSession } from "@/lib/session"
import { useAppStrings } from "@/lib/use-strings"

// The Profile tab: the learner's own profile, with the gear to their settings; logged out, the
// call to log in.

export default function Me() {
  const session = useSession()
  const { t, dir } = useAppStrings()
  if (session.state === "in" && session.account.handle)
    return <ProfileView handle={session.account.handle} />
  return (
    <DirectionView dir={dir} className="flex-1 bg-background">
      <Stack.Screen options={{ title: t.profile.tab }} />
      {session.state === "loading" ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="mx-auto w-full max-w-lg p-6"
        >
          <View className="gap-4 rounded-xl bg-card p-6 shadow-xs">
            <View className="gap-2">
              <Text
                className="text-2xl font-semibold tracking-tight"
                accessibilityRole="header"
              >
                {t.signIn.title}
              </Text>
              <Text className="text-base text-muted-foreground">
                {t.signIn.body}
              </Text>
            </View>
            <Button size="lg" onPress={() => router.push("/sign-in")}>
              <Text>{t.logIn}</Text>
            </Button>
          </View>
        </ScrollView>
      )}
    </DirectionView>
  )
}
