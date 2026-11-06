import { router } from "expo-router"
import { CallCard, Loading, LogInCard } from "@/components/explore/list-parts"
import { ProfileView } from "@/components/profile-view"
import { useSession } from "@/lib/session"
import { useAppStrings } from "@/lib/use-strings"

// The Profile tab: the learner's own profile, with the gear to their settings; logged out, the
// call to log in; logged in without a handle (the profile lives at /u/{handle}), the call to
// choose one in Settings. All are the same ProfileView, so the tab keeps one list as the learner
// logs in and out, and the large title keeps shrinking as it scrolls (list-parts.tsx says why).

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
          <CallCard
            title={t.account.needsHandleTitle}
            body={t.account.needsHandleBody}
            action={t.settings}
            onPress={() => router.push("/settings")}
          />
        ) : (
          <LogInCard title={t.signIn.title} body={t.signIn.body} t={t} />
        )
      }
    />
  )
}
