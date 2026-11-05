import { Link, router, Stack, useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { AppHeader } from "@/components/app-header"
import { Avatar } from "@/components/avatar"
import { DirectionView } from "@/components/direction"
import { Empty, Hairline } from "@/components/explore/list-parts"
import { LessonRow } from "@/components/explore/lesson-row"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { fetchTestLessons, type TestLesson } from "@/lib/api"
import { fetchExplore, type LessonRowData, type Viewer } from "@/lib/feed"
import { mergeFirstPage } from "@/lib/feed-merge"
import { useSession, type Account } from "@/lib/session"
import { useAppStrings } from "@/lib/use-strings"
import { colors } from "../../tokens"

// The app's home. Signed in, it's Explore, as the web's /explore lists it: the newest lessons
// people kept and shared, a page at a time, pulled down to refresh, with the heart on each row.
// Signed out, it's the call to log in, with the test lessons the web app bundles (examples/)
// under it to play without an account. Development builds keep the test lessons at the foot of
// Explore too.

export default function Home() {
  const { t, lang, dir } = useAppStrings()
  const session = useSession()
  return (
    <DirectionView dir={dir} className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader
        title={session.state === "in" ? t.feed.title : "learn.ninja"}
        end={<AccountButton session={session} t={t} />}
        t={t}
      />
      {session.state === "loading" ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : session.state === "in" ? (
        <Explore account={session.account} lang={lang} t={t} />
      ) : (
        <SignedOut t={t} />
      )}
    </DirectionView>
  )
}

/** The header's end: the learner's picture, to their profile, or Log in. */
function AccountButton({
  session,
  t,
}: {
  session: ReturnType<typeof useSession>
  t: Strings
}) {
  if (session.state === "loading") return null
  if (session.state === "out")
    return (
      <Button size="sm" onPress={() => router.push("/sign-in")}>
        <Text>{t.logIn}</Text>
      </Button>
    )
  const { handle, image } = session.account
  return (
    <Pressable
      hitSlop={8}
      disabled={!handle}
      onPress={() =>
        handle && router.push({ pathname: "/u/[handle]", params: { handle } })
      }
      accessibilityRole="link"
      accessibilityLabel={t.feed.profile}
    >
      <Avatar image={image} handle={handle} size={28} />
    </Pressable>
  )
}

type Feed = {
  lessons: LessonRowData[]
  viewer?: Viewer
  next: string | null
  state: "loading" | "ready" | "error"
}

function Explore({
  account,
  lang,
  t,
}: {
  account: Account
  lang: string
  t: Strings
}) {
  const [feed, setFeed] = useState<Feed>({
    lessons: [],
    next: null,
    state: "loading",
  })
  const [refreshing, setRefreshing] = useState(false)
  const loadingMore = useRef(false)

  /**
   * The first page again. Pulled down, it starts the feed over; coming back into view, it's merged
   * into what's on screen (feed-merge.ts), so the pages scrolled through and the place stay.
   */
  const refresh = useCallback(async (merge = false) => {
    try {
      const page = await fetchExplore()
      setFeed((f) =>
        merge && f.state === "ready"
          ? { ...mergeFirstPage(f, page), state: "ready" }
          : {
              lessons: page.lessons,
              viewer: page.viewer,
              next: page.next,
              state: "ready",
            }
      )
    } catch {
      setFeed((f) => (f.state === "ready" ? f : { ...f, state: "error" }))
    }
  }, [])

  // Fresh each time the feed comes back into view: a lesson just finished shows Done.
  useFocusEffect(
    useCallback(() => {
      void refresh(true)
    }, [refresh])
  )

  const loadMore = async () => {
    if (!feed.next || loadingMore.current) return
    loadingMore.current = true
    try {
      const page = await fetchExplore(feed.next)
      setFeed((f) => ({
        ...f,
        lessons: [
          ...f.lessons,
          ...page.lessons.filter((l) => !f.lessons.some((o) => o.id === l.id)),
        ],
        next: page.next,
        viewer: f.viewer && {
          signedIn: f.viewer.signedIn,
          liked: [...f.viewer.liked, ...page.viewer.liked],
          completed: { ...f.viewer.completed, ...page.viewer.completed },
        },
      }))
    } catch {
      // The next scroll to the end asks again.
    } finally {
      loadingMore.current = false
    }
  }

  if (feed.state === "loading")
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    )
  if (feed.state === "error")
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text className="text-center text-sm text-muted-foreground">
          {t.feed.failed}
        </Text>
        <Button
          variant="outline"
          onPress={() => {
            setFeed((f) => ({ ...f, state: "loading" }))
            void refresh()
          }}
        >
          <Text>{t.tryAgain}</Text>
        </Button>
      </View>
    )
  return (
    <FlatList
      data={feed.lessons}
      keyExtractor={(l) => l.id}
      contentContainerClassName="px-4 pb-12"
      ItemSeparatorComponent={Hairline}
      renderItem={({ item }) => (
        <LessonRow
          lesson={item}
          viewer={feed.viewer}
          viewerId={account.id}
          lang={lang}
          t={t}
        />
      )}
      ListEmptyComponent={<Empty>{t.feed.empty}</Empty>}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.5}
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
      ListFooterComponent={
        <>
          {feed.next ? <ActivityIndicator className="py-6" /> : null}
          {__DEV__ ? <TestLessons t={t} /> : null}
        </>
      }
    />
  )
}

function SignedOut({ t }: { t: Strings }) {
  return (
    <ScrollView contentContainerClassName="mx-auto w-full max-w-lg gap-8 p-6">
      <View className="gap-4 rounded-xl bg-card p-6 shadow-xs">
        <View className="gap-2">
          <Text
            className="text-2xl font-semibold tracking-tight"
            accessibilityRole="header"
          >
            {t.feed.logInTitle}
          </Text>
          <Text className="text-base text-muted-foreground">
            {t.feed.logInBody}
          </Text>
        </View>
        <Button size="lg" onPress={() => router.push("/sign-in")}>
          <Text>{t.logIn}</Text>
        </Button>
      </View>
      <TestLessons t={t} />
    </ScrollView>
  )
}

/** The lessons the web app bundles, opened from GET /api/lessons/{slug} without a database. */
function TestLessons({ t }: { t: Strings }) {
  const [lessons, setLessons] = useState<TestLesson[] | null>(null)
  useEffect(() => {
    let live = true
    fetchTestLessons()
      .then((l) => live && setLessons(l))
      .catch(() => live && setLessons([]))
    return () => {
      live = false
    }
  }, [])
  if (!lessons?.length) return null
  return (
    <View className="gap-3 pt-8">
      <Text className="text-sm font-medium text-muted-foreground">
        {t.feed.testLessons}
      </Text>
      {lessons.map((l) => (
        <Link
          key={l.slug}
          href={{ pathname: "/l/[slugId]", params: { slugId: l.slug } }}
          asChild
        >
          <Button variant="outline" size="lg" className="justify-start">
            <Text numberOfLines={1}>{l.title}</Text>
          </Button>
        </Link>
      ))}
    </View>
  )
}
