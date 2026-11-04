import * as Haptics from "expo-haptics"
import { Stack, router, useLocalSearchParams } from "expo-router"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentRef,
} from "react"
import {
  ActivityIndicator,
  I18nManager,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native"
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { progressAt, questionAt } from "@workspace/player-core/flow"
import {
  fingerprint,
  loadProgress,
  saveProgress,
} from "@workspace/player-core/progress"
import type { State } from "@workspace/player-core/state"
import { stringsFor } from "@workspace/player-core/strings"

import { LessonContext } from "@/components/lesson-context"
import { LessonScreen } from "@/components/screens"
import { LessonHeader, LessonTray, TrayButton } from "@/components/shell"
import { Text } from "@/components/ui/text"
import { fetchLesson, sendToApi, type LoadedLesson } from "@/lib/api"
import { API_BASE_URL } from "@/lib/config"
import { reducer, start } from "@/lib/play"
import { deviceStorage } from "@/lib/progress-storage"
import { createProgressSync } from "@/lib/progress-sync"
import { visualDocument } from "@/lib/visual-frame"
import { measureAhead } from "@/lib/visual-height"

// A lesson at /l/{slug}-{id}, the same path as on the web, or /l/{slug} for a bundled test lesson.
// It plays from the intro to the wrap-up in the shell the web draws on a phone; question katas show
// a placeholder until phase 2 ports them.

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; data: LoadedLesson }

export default function LessonRoute() {
  const { slugId } = useLocalSearchParams<{ slugId: string }>()
  const [load, setLoad] = useState<Load>({ state: "loading" })

  useEffect(() => {
    let live = true
    fetchLesson(slugId)
      .then((data) => live && setLoad({ state: "ready", data }))
      .catch(
        (e: unknown) =>
          live &&
          setLoad({
            state: "error",
            message: e instanceof Error ? e.message : "The lesson didn't load.",
          })
      )
    return () => {
      live = false
    }
  }, [slugId])

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {load.state === "loading" ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : load.state === "error" ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm text-muted-foreground">
            {load.message}
          </Text>
        </View>
      ) : (
        <Player data={load.data} />
      )}
    </>
  )
}

/** How far a concept slides as it arrives and leaves: the web's slide-in-from-end-24 (6rem). */
const SLIDE = 96

function Player({ data }: { data: LoadedLesson }) {
  const { lesson } = data
  // Progress is kept per lesson under the web's key for it (lessons/{slug} or l/{slug}-{id}), and
  // only while the lesson's content stays the same (its fingerprint): reopening the lesson lands on
  // the kata the learner left, as a reload does on the web.
  const key = data.path.replace(/^\//, "")
  const print = useMemo(() => fingerprint(lesson), [lesson])
  const [state, dispatch] = useReducer(
    reducer(lesson),
    lesson,
    (l) => loadProgress(deviceStorage, key, l, print) ?? start(l)
  )
  useEffect(() => {
    saveProgress(deviceStorage, key, lesson, state, print)
    // The lesson is covered by its fingerprint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, print, state])
  // A published lesson also tells the server how far the learner got, as the web's page does.
  const sync = useMemo(
    () =>
      data.path.startsWith("/l/")
        ? createProgressSync(data.id, sendToApi)
        : null,
    [data.path, data.id]
  )
  useEffect(() => sync?.update(state), [sync, state])

  // The next screen's HTML visual is measured while this one is read, so it opens at its height.
  const { width: windowWidth } = useWindowDimensions()
  const ahead = state.items[state.index + 1]
  const aheadVisual = ahead?.kind === "concept" ? ahead.kata.visual : undefined
  useEffect(() => {
    if (aheadVisual?.kind !== "html" || aheadVisual.height) return
    measureAhead(
      visualDocument({
        html: aheadVisual.html,
        css: aheadVisual.css,
        baseCss: data.baseCss,
        visualsCss: data.prepared.visualsCss,
      }),
      `${API_BASE_URL}/`,
      windowWidth
    )
  }, [aheadVisual, data.baseCss, data.prepared.visualsCss, windowWidth])
  const item = state.items[state.index]!
  // The player's own words, in the lesson's language (loaded with the lesson, in fetchLesson).
  const t = stringsFor(lesson.language)
  const lessonContext = useMemo(
    () => ({ mathSvg: data.mathSvg }),
    [data.mathSvg]
  )
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)

  // The clock starts when the learner leaves the intro and stops at the wrap-up.
  const [clock, setClock] = useState<{ start?: number; end?: number }>({})
  useEffect(() => {
    if (item.kind === "intro") setClock({})
    else if (item.kind === "wrap")
      setClock((c) => (c.end ? c : { ...c, end: Date.now() }))
    else setClock((c) => (c.start ? c : { start: Date.now() }))
  }, [item.kind])

  const { style, leave } = useScreenMotion(state)

  const next = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    leave(item.kind === "concept", () => dispatch({ type: "next" }))
  }
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"))

  // Each new screen starts at the top.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [state.index])

  const primary =
    item.kind === "intro"
      ? { label: t.start, onPress: next }
      : item.kind === "wrap"
        ? // The wrap-up's own actions come with it in phase 3; until then it offers a replay.
          { label: t.restart, onPress: () => dispatch({ type: "restart" }) }
        : { label: t.continue, onPress: next }

  return (
    <View className="flex-1 bg-background">
      <LessonHeader
        title={lesson.title}
        showProgress={item.kind !== "intro" && item.kind !== "wrap"}
        progress={progressAt(
          state.items,
          state.index,
          state.results,
          state.fixed
        )}
        count={questionAt(state.items, state.index, state.inFix)}
        startedAt={clock.start}
        endedAt={clock.end}
        onClose={close}
        t={t}
      />
      {/* The window: on a phone, edge to edge between two hairlines. */}
      <ScrollView
        ref={scrollRef}
        // The header and tray already keep clear of the notch and the home bar.
        contentInsetAdjustmentBehavior="never"
        className="flex-1 border-y border-border"
        contentContainerClassName={
          item.kind === "intro" || item.kind === "wrap"
            ? "grow justify-center px-4 py-16"
            : "px-4 py-6"
        }
      >
        <Animated.View style={style} className="mx-auto w-full max-w-2xl">
          <LessonContext value={lessonContext}>
            <LessonScreen data={data} item={item} state={state} t={t} />
          </LessonContext>
        </Animated.View>
      </ScrollView>
      <LessonTray>
        <TrayButton label={primary.label} onPress={primary.onPress} />
      </LessonTray>
    </View>
  )
}

/**
 * The screens' motion, on the UI thread, after the web's (lesson-player.tsx): a concept arrives
 * from the end side and leaves toward it, fading (300 ms in, 200 ms out); every other screen fades
 * up from 4 points below. Nothing moves when the system asks for reduced motion.
 */
function useScreenMotion(state: State) {
  const reduced = useReducedMotion()
  const opacity = useSharedValue(1)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const end = I18nManager.isRTL ? -1 : 1
  const kind = state.items[state.index]?.kind

  // A new screen: placed where it arrives from, then eased in.
  const first = useRef(true)
  // The screen that's leaving, so a second press doesn't leave it twice.
  const leaving = useRef(-1)
  useLayoutEffect(() => {
    leaving.current = -1
    if (first.current || reduced) {
      first.current = false
      opacity.value = 1
      x.value = 0
      y.value = 0
      return
    }
    const concept = kind === "concept"
    const ease = {
      duration: concept ? 300 : 150,
      easing: Easing.out(Easing.cubic),
    }
    opacity.value = 0
    x.value = concept ? SLIDE * end : 0
    y.value = concept ? 0 : 4
    opacity.value = withTiming(1, ease)
    x.value = withTiming(0, ease)
    y.value = withTiming(0, ease)
    // A new run starts with the intro again, which is a new screen too.
  }, [state.index, state.run, kind, reduced, end, opacity, x, y])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }))

  /** Leaves the screen (a concept slides out), then moves on with `then`. Once per screen. */
  const leave = (slide: boolean, then: () => void) => {
    if (leaving.current === state.index) return
    if (!slide || reduced) {
      then()
      return
    }
    leaving.current = state.index
    const ease = { duration: 200, easing: Easing.in(Easing.cubic) }
    x.value = withTiming(SLIDE * end, ease)
    opacity.value = withTiming(0, ease, (finished) => {
      if (finished) runOnJS(then)()
    })
  }

  return { style, leave }
}
