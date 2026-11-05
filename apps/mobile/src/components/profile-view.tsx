import { router, Stack, useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { Avatar } from "@/components/avatar"
import { DirectionView } from "@/components/direction"
import { ActivityGrid } from "@/components/explore/activity-grid"
import { LessonRow } from "@/components/explore/lesson-row"
import { Empty, Hairline } from "@/components/explore/list-parts"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { FeedError, fetchProfile, type ProfileData } from "@/lib/feed"
import { tap } from "@/lib/haptics"
import { useSession } from "@/lib/session"
import { useAppStrings } from "@/lib/use-strings"
import { cn } from "@/lib/utils"
import { colors } from "../../tokens"

// A person's profile (/u/{handle}, the web's path, and the learner's own in the Profile tab), as
// its page draws it on a phone: the handle as the bar's large title, the picture and when they
// joined, then one box with the year of activity on a card and the tabs
// under it, and the open tab's lessons below. On your own profile the first tab is My lessons
// (everything you own, private and hidden ones marked), In progress follows it, and the gear at
// the bar's end opens the account settings.

type Tab = "lessons" | "progress" | "likes"

type Load =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "error" }
  | { state: "ready"; data: ProfileData }

export function ProfileView({ handle }: { handle: string }) {
  const { t, lang, dir } = useAppStrings()
  const session = useSession()
  const [load, setLoad] = useState<Load>({ state: "loading" })
  const [tab, setTab] = useState<Tab>("lessons")
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchProfile(handle)
      setLoad({ state: "ready", data })
    } catch (e) {
      setLoad((l) =>
        l.state === "ready"
          ? l
          : e instanceof FeedError && e.status === 404
            ? { state: "missing" }
            : { state: "error" }
      )
    }
  }, [handle])
  // Fresh when it comes back into view: a lesson just finished moves from In progress.
  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh])
  )
  const viewerId = session.state === "in" ? session.account.id : undefined

  const data = load.state === "ready" ? load.data : null
  const list = !data
    ? []
    : tab === "lessons"
      ? data.lessons
      : tab === "progress"
        ? (data.inProgress ?? [])
        : data.likes
  const empty = !data
    ? ""
    : tab === "lessons"
      ? data.own
        ? t.profile.noLessonsOwn
        : t.profile.noLessons
      : tab === "progress"
        ? t.profile.noProgress
        : data.own
          ? t.profile.noLikesOwn
          : t.profile.noLikes

  return (
    <DirectionView dir={dir} className="flex-1 bg-background">
      {/* A profile goes by its handle alone: no display name, no @. */}
      <Stack.Screen options={{ title: data?.profile.handle ?? handle }} />
      {data?.own ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="gearshape"
            accessibilityLabel={t.settings}
            onPress={() => router.push("/settings")}
          >
            {t.settings}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      {load.state === "loading" ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : load.state !== "ready" ? (
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="text-center text-sm text-muted-foreground">
            {load.state === "missing" ? t.profile.missing : t.feed.failed}
          </Text>
          {load.state === "error" ? (
            <Button
              variant="outline"
              onPress={() => {
                setLoad({ state: "loading" })
                void refresh()
              }}
            >
              <Text>{t.tryAgain}</Text>
            </Button>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={list}
          contentInsetAdjustmentBehavior="automatic"
          keyExtractor={(l) => l.id}
          contentContainerClassName="px-4 pb-12"
          ItemSeparatorComponent={Hairline}
          ListHeaderComponent={
            <Head
              data={load.data}
              tab={tab}
              setTab={setTab}
              lang={lang}
              t={t}
            />
          }
          renderItem={({ item }) => (
            <LessonRow
              lesson={item}
              viewer={load.data.viewer}
              viewerId={viewerId}
              lang={lang}
              t={t}
            />
          )}
          ListEmptyComponent={<Empty>{empty}</Empty>}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.muted.foreground}
              onRefresh={async () => {
                setRefreshing(true)
                await refresh()
                setRefreshing(false)
              }}
            />
          }
        />
      )}
    </DirectionView>
  )
}

function Head({
  data,
  tab,
  setTab,
  lang,
  t,
}: {
  data: ProfileData
  tab: Tab
  setTab: (tab: Tab) => void
  lang: string
  t: Strings
}) {
  const { profile } = data
  const joined = new Intl.DateTimeFormat(lang, {
    month: "long",
    year: "numeric",
  }).format(profile.joinedAt)
  const tabs: { id: Tab; label: string; count: number }[] = [
    {
      id: "lessons",
      label: data.own ? t.profile.myLessons : t.profile.lessons,
      count: data.lessons.length,
    },
    ...(data.inProgress
      ? [
          {
            id: "progress" as const,
            label: t.profile.inProgress,
            count: data.inProgress.length,
          },
        ]
      : []),
    { id: "likes", label: t.profile.likes, count: data.likes.length },
  ]
  return (
    <View className="gap-5 pt-2 pb-2">
      {/* The handle is the bar's large title; the picture and when they joined sit under it. */}
      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          <Avatar image={profile.image} handle={profile.handle} size={32} />
          <Text className="text-sm text-muted-foreground">
            {t.profile.joined(joined)}
          </Text>
        </View>
        {profile.bio ? <Text className="text-base">{profile.bio}</Text> : null}
      </View>
      {/* The year of activity on a card, the tabs in a muted strip under it, in one box. */}
      <View className="rounded-xl border border-border bg-muted">
        <View className="-m-px rounded-xl border border-border bg-card px-4 py-5">
          <ActivityGrid grid={data.grid} lang={lang} t={t} />
        </View>
        <View className="p-3">
          <View
            className="flex-row self-start rounded-lg bg-muted p-[3px]"
            accessibilityRole="tablist"
          >
            {tabs.map((item) => {
              const on = item.id === tab
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (!on) tap()
                    setTab(item.id)
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  className={cn(
                    "h-8 flex-row items-center gap-1.5 rounded-md border border-transparent px-3",
                    on && "border-input bg-input/30"
                  )}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      !on && "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Text>
                  <Text className="text-sm text-muted-foreground tabular-nums">
                    {item.count}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>
    </View>
  )
}
