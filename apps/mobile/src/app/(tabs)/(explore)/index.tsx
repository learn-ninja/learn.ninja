import { Link, router, Stack, useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { DirectionProvider } from "@/components/direction"
import {
  Empty,
  Failed,
  Hairline,
  Loading,
  LogInCard,
  LTR,
} from "@/components/explore/list-parts"
import { LessonRow } from "@/components/explore/lesson-row"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { fetchTestLessons, type TestLesson } from "@/lib/api"
import { fetchExplore, type LessonRowData, type Viewer } from "@/lib/feed"
import { mergeFirstPage } from "@/lib/feed-merge"
import { useSession, type Account } from "@/lib/session"
import { useAppStrings } from "@/lib/use-strings"
import { cn } from "@/lib/utils"
import { colors } from "../../../../tokens"

// The app's home. Signed in, it's Explore, as the web's /explore lists it: the newest lessons
// people kept and shared, a page at a time, pulled down to refresh, with the heart on each row.
// Signed out, it's the call to log in, with the test lessons the web app bundles (examples/)
// under it to play without an account. Development builds keep the test lessons at the foot of
// Explore too.

export default function Home() {
  const { t, lang, dir } = useAppStrings()
  const session = useSession()
  const account = session.state === "in" ? session.account : null
  const { feed, refresh, retry, loadMore } = useExplore(account)
  const [refreshing, setRefreshing] = useState(false)
  return (
    <DirectionProvider value={dir}>
      {/* The system's bar: a large title that shrinks into it as the feed scrolls (TabStack). */}
      <Stack.Screen
        options={{ title: account ? t.feed.title : "learn.ninja" }}
      />
      {session.state === "out" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button onPress={() => router.push("/sign-in")}>
            {t.logIn}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      {/* The screen's root, from the first render, logged in or out (list-parts.tsx says why). */}
      <FlatList
        // The list itself runs left to right and what scrolls in it runs the screen's way: on iOS 26
        // the large title is drawn inside the scroll view, and React Native mirrors a right-to-left
        // scroll view (for sideways lists), which would mirror the title's letters too.
        className="flex-1"
        style={LTR}
        contentContainerStyle={{ direction: dir }}
        data={account && feed.state === "ready" ? feed.lessons : []}
        contentInsetAdjustmentBehavior="automatic"
        keyExtractor={(l) => l.id}
        contentContainerClassName={cn(
          "px-4 pb-12",
          (!account || feed.state !== "ready") && "grow"
        )}
        ItemSeparatorComponent={Hairline}
        ListHeaderComponent={
          session.state === "out" ? (
            <LogInCard
              title={t.feed.logInTitle}
              body={t.feed.logInBody}
              t={t}
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <LessonRow
            lesson={item}
            viewer={feed.viewer}
            viewerId={account?.id}
            lang={lang}
            t={t}
          />
        )}
        ListEmptyComponent={
          session.state === "out" ? undefined : session.state === "loading" ||
            feed.state === "loading" ? (
            <Loading />
          ) : feed.state === "error" ? (
            <Failed
              message={t.feed.failed}
              retry={{ label: t.tryAgain, onPress: retry }}
            />
          ) : (
            <Empty>{t.feed.empty}</Empty>
          )
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        refreshControl={
          account ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.muted.foreground}
              onRefresh={async () => {
                setRefreshing(true)
                await refresh()
                setRefreshing(false)
              }}
            />
          ) : undefined
        }
        ListFooterComponent={
          <>
            {account && feed.next ? (
              <ActivityIndicator className="py-6" />
            ) : null}
            {/* Logged out, or in a development build: the bundled test lessons to play. */}
            {session.state === "out" || (account && __DEV__) ? (
              <TestLessons t={t} />
            ) : null}
          </>
        }
      />
    </DirectionProvider>
  )
}

type Feed = {
  lessons: LessonRowData[]
  viewer?: Viewer
  next: string | null
  state: "loading" | "ready" | "error"
}

const START: Feed = { lessons: [], next: null, state: "loading" }

/** Explore's pages for the logged-in account; nothing (and no requests) while logged out. */
function useExplore(account: Account | null) {
  const [feed, setFeed] = useState<Feed>(START)
  const loadingMore = useRef(false)
  const signedIn = account !== null

  // Logging out (or in as someone else) starts the feed over.
  const id = account?.id ?? null
  const [shown, setShown] = useState(id)
  if (shown !== id) {
    setShown(id)
    setFeed(START)
  }

  /**
   * The first page again. Pulled down, it starts the feed over; coming back into view, it's merged
   * into what's on screen (feed-merge.ts), so the pages scrolled through and the place stay.
   */
  const refresh = useCallback(
    async (merge = false) => {
      if (!signedIn) return
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
    },
    [signedIn]
  )

  // Fresh each time the feed comes back into view: a lesson just finished shows Done.
  useFocusEffect(
    useCallback(() => {
      void refresh(true)
    }, [refresh])
  )

  const loadMore = async () => {
    if (!signedIn || !feed.next || loadingMore.current) return
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

  const retry = () => {
    setFeed((f) => ({ ...f, state: "loading" }))
    void refresh()
  }

  return { feed, refresh: () => refresh(), retry, loadMore }
}

/** Logged out: what Explore is, and the way in. */

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
