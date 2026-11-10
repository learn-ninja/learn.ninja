import { router, Stack, useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl } from "react-native"

import { DirectionProvider } from "@/components/direction"
import {
  Empty,
  Failed,
  Hairline,
  Loading,
  LTR,
} from "@/components/explore/list-parts"
import { LessonRow } from "@/components/explore/lesson-row"
import { SavedLessons } from "@/components/explore/saved-lessons"
import { OfflineError } from "@/lib/api-fetch"
import { fetchExplore, type LessonRowData, type Viewer } from "@/lib/feed"
import { mergeFirstPage } from "@/lib/feed-merge"
import { onBlockChange } from "@/lib/moderation"
import { useSession, type Account } from "@/lib/session"
import { tap } from "@/lib/haptics"
import { useAppStrings } from "@/lib/use-strings"
import { cn } from "@/lib/utils"
import { colors } from "../../../../tokens"

// The app's home: Explore, as the web's /explore lists it, logged in or out: the newest lessons
// people kept and shared, a page at a time, pulled down to refresh, with the heart on each row
// (logged out, the heart and the block action lead to logging in). The test lessons are in the
// Dev tab, which only development builds show.

export default function Home() {
  const { t, lang, dir } = useAppStrings()
  const session = useSession()
  const account = session.state === "in" ? session.account : null
  const { feed, refresh, retry, loadMore } = useExplore(
    session.state === "loading" ? undefined : account
  )
  const [refreshing, setRefreshing] = useState(false)
  return (
    <DirectionProvider value={dir}>
      {/* The system's bar: a large title that shrinks into it as the feed scrolls (TabStack). */}
      <Stack.Screen options={{ title: t.feed.title }} />
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
        data={feed.state === "ready" ? feed.lessons : []}
        contentInsetAdjustmentBehavior="automatic"
        keyExtractor={(l) => l.id}
        contentContainerClassName={cn(
          "px-4 pb-12",
          feed.state !== "ready" && "grow"
        )}
        ItemSeparatorComponent={Hairline}
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
          feed.state === "loading" ? (
            <Loading />
          ) : feed.state === "error" ? (
            <>
              <Failed
                message={feed.offline ? t.offline : t.feed.failed}
                retry={{ label: t.tryAgain, onPress: retry }}
              />
              {feed.offline ? <SavedLessons t={t} /> : null}
            </>
          ) : (
            <Empty>{t.feed.empty}</Empty>
          )
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.muted.foreground}
            onRefresh={async () => {
              // A light tap as the pull catches, as iOS's own lists give one.
              tap()
              setRefreshing(true)
              await refresh()
              setRefreshing(false)
            }}
          />
        }
        ListFooterComponent={
          <>{feed.next ? <ActivityIndicator className="py-6" /> : null}</>
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
  /** The last failure was the server not answering (no connection, or too slow). */
  offline?: boolean
}

const START: Feed = { lessons: [], next: null, state: "loading" }

/**
 * Explore's pages, for the logged-in account or for anyone. `undefined` while the session is still
 * being read: no requests yet, so the first page knows what the viewer liked and finished.
 */
function useExplore(account: Account | null | undefined) {
  const [feed, setFeed] = useState<Feed>(START)
  const loadingMore = useRef(false)
  const ready = account !== undefined

  // Logging in or out (or in as someone else) starts the feed over.
  const id = account === undefined ? undefined : (account?.id ?? null)
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
      if (!ready) return
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
      } catch (e) {
        setFeed((f) =>
          f.state === "ready"
            ? f
            : { ...f, state: "error", offline: e instanceof OfflineError }
        )
      }
    },
    [ready, id]
  )

  // Someone blocked: their lessons leave at once, the pages scrolled through included. Unblocked:
  // the feed starts over, so theirs come back in their places.
  useEffect(
    () =>
      onBlockChange(({ userId, blocked }) => {
        if (!blocked) return void refresh()
        setFeed((f) => ({
          ...f,
          lessons: f.lessons.filter((l) => l.author?.id !== userId),
        }))
      }),
    [refresh]
  )

  // Fresh each time the feed comes back into view: a lesson just finished shows Done.
  useFocusEffect(
    useCallback(() => {
      void refresh(true)
    }, [refresh])
  )

  const loadMore = async () => {
    if (!ready || !feed.next || loadingMore.current) return
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
