import { Redirect, router } from "expo-router"
import { CallCard, Loading } from "@/components/explore/list-parts"
import { ProfileView } from "@/components/profile-view"
import { useSession } from "@/lib/session"
import { useAppStrings } from "@/lib/use-strings"

// The Profile tab: the learner's own profile, with the gear to their settings; logged in without
// a handle (the profile lives at /u/{handle}), the call to choose one in Settings. Both are the
// same ProfileView, so the large title keeps shrinking as it scrolls (list-parts.tsx says why).
// Logged out there's no tab bar, so a way in here (a notification, an old quick action) goes to
// Explore, where Log in is.

export default function Me() {
  const session = useSession()
  const { t } = useAppStrings()
  if (session.state === "out") return <Redirect href="/" />
  const handle =
    session.state === "in" ? (session.account.handle ?? null) : null
  return (
    <ProfileView
      handle={handle}
      title={t.profile.tab}
      placeholder={
        session.state === "loading" ? (
          <Loading />
        ) : (
          <CallCard
            title={t.account.needsHandleTitle}
            body={t.account.needsHandleBody}
            action={t.settings}
            onPress={() => router.push("/settings")}
          />
        )
      }
    />
  )
}
