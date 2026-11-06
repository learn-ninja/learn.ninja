import { router, Stack, useFocusEffect } from "expo-router"
import { useCallback, useState, type ReactElement } from "react"
import { FlatList, Pressable, RefreshControl, View } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { Avatar } from "@/components/avatar"
import { DirectionProvider } from "@/components/direction"
import { ActivityGrid } from "@/components/explore/activity-grid"
import { LessonRow } from "@/components/explore/lesson-row"
import {
  Empty,
  Failed,
  Hairline,
  Loading,
  LTR,
} from "@/components/explore/list-parts"
import { Text } from "@/components/ui/text"
import { FeedError, fetchProfile, type ProfileData } from "@/lib/feed"
import { selection, tap } from "@/lib/haptics"
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

export function ProfileView({
  handle,
  title,
  placeholder,
}: {
  /** Whose profile; null while there's no one to show (the Profile tab, logged out). */
  handle: string | null
  /** The bar's title while there's no handle. */
  title?: string
  /** What the list holds while there's no handle: the call to log in, or a spinner. */
  placeholder?: ReactElement
}) {
  const { t, lang, dir } = useAppStrings()
  const session = useSession()
  const [load, setLoad] = useState<Load>({ state: "loading" })
  const [tab, setTab] = useState<Tab>("lessons")
  const [refreshing, setRefreshing] = useState(false)

  // Someone else's profile (or the learner's, just logged in) starts from its spinner.
  const [shown, setShown] = useState(handle)
  if (shown !== handle) {
    setShown(handle)
    setLoad({ state: "loading" })
  }

  const refresh = useCallback(async () => {
    if (!handle) return
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

  const data = handle && load.state === "ready" ? load.data : null
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
    <DirectionProvider value={dir}>
      {/* A profile goes by its handle alone: no display name, no @. */}
      <Stack.Screen
        options={{ title: data?.profile.handle ?? handle ?? title ?? "" }}
      />
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
      {/* The screen's root, from the first render, whatever it holds (list-parts.tsx says why). */}
      <FlatList
        // The list itself runs left to right and what scrolls in it runs the screen's way: on iOS 26
        // the large title is drawn inside the scroll view, and React Native mirrors a right-to-left
        // scroll view (for sideways lists), which would mirror the title's letters too.
        className="flex-1"
        style={LTR}
        contentContainerStyle={{ direction: dir }}
        data={list}
        contentInsetAdjustmentBehavior="automatic"
        keyExtractor={(l) => l.id}
        contentContainerClassName={cn("px-4 pb-12", !data && "grow")}
        ItemSeparatorComponent={Hairline}
        ListHeaderComponent={
          data ? (
            <Head data={data} tab={tab} setTab={setTab} lang={lang} t={t} />
          ) : !handle ? (
            placeholder
          ) : undefined
        }
        renderItem={({ item }) => (
          <LessonRow
            lesson={item}
            viewer={data?.viewer}
            viewerId={viewerId}
            lang={lang}
            t={t}
          />
        )}
        ListEmptyComponent={
          data ? (
            <Empty>{empty}</Empty>
          ) : !handle ? undefined : load.state === "loading" ? (
            <Loading />
          ) : (
            <Failed
              message={
                load.state === "missing" ? t.profile.missing : t.feed.failed
              }
              retry={
                load.state === "error"
                  ? {
                      label: t.tryAgain,
                      onPress: () => {
                        setLoad({ state: "loading" })
                        void refresh()
                      },
                    }
                  : undefined
              }
            />
          )
        }
        refreshControl={
          data ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.muted.foreground}
              onRefresh={async () => {
                tap()
                setRefreshing(true)
                await refresh()
                setRefreshing(false)
              }}
            />
          ) : undefined
        }
      />
    </DirectionProvider>
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
                    if (!on) selection()
                    setTab(item.id)
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  className={cn(
                    "min-h-8 flex-row items-center gap-1.5 rounded-md border border-transparent px-3 py-1",
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
