import { router } from "expo-router"
import { View } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { Loading } from "@/components/explore/list-parts"
import { ProfileView } from "@/components/profile-view"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { useSession } from "@/lib/session"
import { useAppStrings } from "@/lib/use-strings"

// The Profile tab: the learner's own profile, with the gear to their settings; logged out, the
// call to log in; logged in without a handle (the profile lives at /u/{handle}), the call to
// choose one in Settings. Both are the same ProfileView, so the tab keeps one list as the learner logs in
// and out, and the large title keeps shrinking as it scrolls (list-parts.tsx says why).

export default function Me() {
  const session = useSession()
  const { t } = useAppStrings()
  const handle =
    session.state === "in" ? (session.account.handle ?? null) : null
  return (
    <ProfileView
      handle={handle}
      title={t.profile.tab}
      placeholder={
        session.state === "loading" ? (
          <Loading />
        ) : session.state === "in" ? (
          <NeedsHandleCard t={t} />
        ) : (
          <LogInCard t={t} />
        )
      }
    />
  )
}

function LogInCard({ t }: { t: Strings }) {
  return (
    <View className="mx-auto w-full max-w-lg py-6">
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
    </View>
  )
}

function NeedsHandleCard({ t }: { t: Strings }) {
  return (
    <View className="mx-auto w-full max-w-lg py-6">
      <View className="gap-4 rounded-xl bg-card p-6 shadow-xs">
        <View className="gap-2">
          <Text
            className="text-2xl font-semibold tracking-tight"
            accessibilityRole="header"
          >
            {t.account.needsHandleTitle}
          </Text>
          <Text className="text-base text-muted-foreground">
            {t.account.needsHandleBody}
          </Text>
        </View>
        <Button size="lg" onPress={() => router.push("/settings")}>
          <Text>{t.settings}</Text>
        </Button>
      </View>
    </View>
  )
}
