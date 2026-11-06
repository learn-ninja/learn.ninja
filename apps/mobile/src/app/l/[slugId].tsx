import * as Haptics from "expo-haptics"
import { Stack, router, useIsFocused, useLocalSearchParams } from "expo-router"
import {
  useCallback,
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

import {
  progressAt,
  questionAt,
  scoredQuestions,
} from "@workspace/player-core/flow"
import {
  fingerprint,
  loadProgress,
  saveProgress,
} from "@workspace/player-core/progress"
import type { Mark } from "@workspace/player-core/check"
import type { State } from "@workspace/player-core/state"
import { challengeFor, parseChallenge } from "@workspace/player-core/challenge"
import { directionOf, uiLanguageFor } from "@workspace/player-core/strings"

import { createLinePicker } from "@workspace/player-core/voices"

import { AnswerMarksContext } from "@/components/answer-marks"
import { DirectionView, type Direction } from "@/components/direction"
import { LessonContext } from "@/components/lesson-context"
import { LessonMenu } from "@/components/lesson-menu"
import { LessonScreen } from "@/components/screens"
import { Aura, useIntroVanish } from "@/components/smoke"
import { StageContext } from "@/components/stage-context"
import { LessonTextSize } from "@/components/text-size"
import {
  BareHeader,
  LessonHeader,
  LessonTray,
  TrayButton,
  TrayFeedback,
} from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import {
  fetchLesson,
  LessonError,
  sendToApi,
  type LoadedLesson,
} from "@/lib/api"
import { createAnswerMarks, revealBy } from "@/lib/answer-marks"
import { markWord } from "@/lib/mark-words"
import { OfflineError } from "@/lib/api-fetch"
import { API_BASE_URL } from "@/lib/config"
import { feedbackFor } from "@/lib/feedback"
import { result as resultHaptic, tap as tapHaptic } from "@/lib/haptics"
import { reducer, start, type AppAction } from "@/lib/play"
import { settled } from "@/lib/screen-guard"
import { deviceStorage } from "@/lib/progress-storage"
import { createProgressSync } from "@/lib/progress-sync"
import { useSession } from "@/lib/session"
import { forgetLastLesson, useLastLesson } from "@/lib/quick-actions"
import { askForReviewAt } from "@/lib/review"
import { lessonLink } from "@/lib/share"
import { shareChallenge, shareLesson } from "@/lib/share-sheet"
import { ninjaOf, soundOf, type Preferences } from "@/lib/preferences"
import { playEffect, preloadEffects } from "@/lib/sound"
import { usePreferences } from "@/lib/use-preferences"
import { useStreak } from "@/lib/use-streak"
import { lessonUiLanguage } from "@/lib/ui-language"
import { useAppStrings, useStringsFor } from "@/lib/use-strings"
import { useNinjaVoice } from "@/lib/use-voice"
import { effectsOn, speaks } from "@/lib/voice"
import { visualDocument } from "@/lib/visual-frame"
import { cn } from "@/lib/utils"
import { measureAhead } from "@/lib/visual-height"
import { visualsAhead } from "@/lib/visuals-ahead"
import { useHandoff } from "../../../modules/handoff"
import { useSafeAreaInsets } from "react-native-safe-area-context"

// A lesson at /l/{slug}-{id}, the same path as on the web, or /l/{slug} for a bundled test lesson.
// It plays from the intro to the wrap-up in the shell the web draws on a phone: every kata, with
// the feedback in the tray.

type Load =
  | { state: "loading" }
  /**
   * `retry`: asking again could help (no connection, a server error), unlike a lesson that's gone.
   * `offline`: the server couldn't be reached, or didn't answer in time.
   */
  | { state: "error"; status: number; retry: boolean; offline: boolean }
  | { state: "ready"; data: LoadedLesson }

/** Back to where the lesson was opened from, or home when it was opened by a link. */
function closeLesson() {
  if (router.canGoBack()) router.back()
  else router.replace("/")
}

export default function LessonRoute() {
  // The link's query, as the web's page reads it: a friend's challenge (?c=4-5&by=handle) and the
  // player's language for this visit (?ui=).
  const { slugId, c, by, ui } = useLocalSearchParams<{
    slugId: string
    c?: string
    by?: string
    ui?: string
  }>()
  const [load, setLoad] = useState<Load>({ state: "loading" })
  // Try again after a failed load asks for the lesson once more.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setLoad({ state: "loading" })
    fetchLesson(slugId)
      .then((data) => live && setLoad({ state: "ready", data }))
      .catch(
        (e: unknown) =>
          live &&
          setLoad({
            state: "error",
            status: e instanceof LessonError ? e.status : 0,
            retry: !(e instanceof LessonError) || e.status >= 500,
            offline: e instanceof OfflineError,
          })
      )
    return () => {
      live = false
    }
  }, [slugId, attempt])

  // Before the lesson (and its language) is known, the player's words are the app's.
  const { t, dir } = useAppStrings()
  // A lesson that's gone (or never opens) is no longer the app icon's Continue.
  const gone = load.state === "error" && !load.retry
  useEffect(() => {
    if (gone) forgetLastLesson(`/l/${slugId}`, t)
  }, [gone, slugId, t])
  const message =
    load.state !== "error"
      ? ""
      : load.offline
        ? t.offline
        : load.status === 404 || load.status === 410
          ? t.lessonErrors.missing
          : load.status === 422
            ? t.lessonErrors.broken
            : t.lessonErrors.failed
  return (
    <DirectionView dir={dir} className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      {load.state !== "ready" ? (
        <BareHeader onClose={closeLesson} label={t.home} />
      ) : null}
      {load.state === "loading" ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : load.state === "error" ? (
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="text-center text-sm text-muted-foreground">
            {message}
          </Text>
          {load.retry ? (
            <Button variant="outline" onPress={() => setAttempt((n) => n + 1)}>
              <Text>{t.tryAgain}</Text>
            </Button>
          ) : null}
        </View>
      ) : (
        <Player data={load.data} link={{ c, by, ui }} />
      )}
    </DirectionView>
  )
}

/** How far a concept slides as it arrives and leaves: the web's slide-in-from-end-24 (6rem). */
const SLIDE = 96

function Player({
  data,
  link,
}: {
  data: LoadedLesson
  link: { c?: string; by?: string; ui?: string }
}) {
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
  useEffect(() => () => sync?.close(), [sync])

  // The next screen's HTML visuals (a concept's, a question's, its option cards and order items, a
  // hotspot's parts) are measured while this one is read, so they open at their height.
  const { width: windowWidth } = useWindowDimensions()
  const ahead = state.items[state.index + 1]
  useEffect(() => {
    for (const v of visualsAhead(ahead, windowWidth))
      measureAhead(
        visualDocument({
          html: v.html,
          css: v.css,
          height: v.height,
          baseCss: data.baseCss,
          visualsCss: data.prepared.visualsCss,
        }),
        `${API_BASE_URL}/`,
        v.width,
        { height: !v.height, spots: v.spots }
      )
  }, [ahead, data.baseCss, data.prepared.visualsCss, windowWidth])
  const item = state.items[state.index]!
  // The player's own words: the language the learner chose in the menu, else the lesson's (the
  // web's rule; the lesson's is loaded with it, in fetchLesson). The screen runs its way.
  const [prefs, savePrefs] = usePreferences()
  // ?ui= wins for this visit, until the learner picks a language in the menu (the web's order).
  const [linkUi, setLinkUi] = useState(() =>
    link.ui && uiLanguageFor(link.ui) ? link.ui : undefined
  )
  const updatePrefs = useCallback(
    (patch: Partial<Preferences>) => {
      if (patch.uiLanguage) setLinkUi(undefined)
      savePrefs(patch)
    },
    [savePrefs]
  )
  const ui = linkUi ?? lessonUiLanguage(prefs, lesson.language)
  const challenge = useMemo(
    () =>
      challengeFor(
        parseChallenge(link.c, link.by),
        scoredQuestions(lesson).length
      ),
    [link.c, link.by, lesson]
  )
  const t = useStringsFor(ui)
  const dir = directionOf(ui)
  const lessonContext = useMemo(
    () => ({
      prepared: data.prepared,
      mathSvg: data.mathSvg,
      baseCss: data.baseCss,
      lang: lesson.language,
    }),
    [data.prepared, data.mathSvg, data.baseCss, lesson.language]
  )
  // One line picker for the whole run, so the ninja's lines don't repeat; a replay reseeds it.
  const pickLine = useMemo(
    () => createLinePicker(`${lesson.title}:${state.run}`),
    [lesson.title, state.run]
  )
  // The ninja's character from the learner's preferences (the web's, on the device).
  const ninja = ninjaOf(prefs)
  const soundOn = soundOf(prefs)
  const sfx = effectsOn(soundOn, lesson.language)
  // After a right answer, Why? adds the explanation to the feedback; each screen starts closed.
  const [whyOpen, setWhyOpen] = useState(false)
  useEffect(() => setWhyOpen(false), [state.index])
  const feedback = feedbackFor({
    item,
    state,
    t,
    lang: lesson.language,
    pickLine,
    whyOpen,
    level: ninja,
  })
  // The system's success or error tap as an answer is checked (not a resumed one).
  const q = state.question
  const checked = q?.result && q.phase !== "answering" ? q.result.correct : null
  const checkedKey = `${state.run}:${state.index}:${q?.attempts ?? 0}:${q?.phase ?? ""}`
  const lastHaptic = useRef<string | null>(checkedKey)
  useEffect(() => {
    if (checked === null || lastHaptic.current === checkedKey) return
    lastHaptic.current = checkedKey
    resultHaptic(checked)
  }, [checked, checkedKey])
  // Phase 3: he says the line heading the feedback, once per check (not a resumed one).
  // His body for the question feedback: on a phone the web shows him only in a screen's slot (the
  // intro, the wrap-up), so the tray shows his line without him. To show him reacting there, render
  // <Ninja size={40} level={ninja} cue={{ kind: cueKindFor(state, item), key: checkedKey }} />
  // (src/components/ninja.tsx, cueKindFor from @workspace/player-core/ninja) beside TrayFeedback.
  useNinjaVoice({
    line: feedback.title,
    key: checkedKey,
    lang: lesson.language,
    level: ninja,
    pickLine,
    on: speaks(ninja, soundOn, lesson.language),
  })
  // The whoosh is loaded ahead, so it starts with the press.
  useEffect(() => {
    if (sfx) preloadEffects(["vanish"])
  }, [sfx])
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  // The window the screens scroll in, and how far they're scrolled.
  const windowRef = useRef<ComponentRef<typeof View>>(null)
  const scrollY = useRef(0)
  // After a check the tray grows to show the feedback, which can cover the marked answers: once it
  // has settled, the lowest of them scrolls back into view (the web's phone layout does the same).
  // Why? adding the explanation grows the tray again, so it runs then too.
  const answerMarks = useMemo(() => createAnswerMarks(), [])
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!q?.result || q.phase === "answering") return
    let live = true
    const timer = setTimeout(() => {
      void answerMarks.lowest().then((low) => {
        const view = windowRef.current
        if (!live || !low || !view) return
        view.measureInWindow((_x, top, _w, height) => {
          // Clear of the tray by a gap, but never past the answer's own top.
          const overlap = revealBy(low, { top, height })
          if (live && overlap > 0)
            scrollRef.current?.scrollTo({
              y: scrollY.current + overlap,
              animated: !reduced,
            })
        })
      })
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [q?.result, q?.phase, whyOpen, answerMarks, reduced])

  // The clock starts when the learner leaves the intro and stops at the wrap-up.
  const [clock, setClock] = useState<{ start?: number; end?: number }>({})
  useEffect(() => {
    if (item.kind === "intro") setClock({})
    else if (item.kind === "wrap")
      setClock((c) => (c.end ? c : { ...c, end: Date.now() }))
    else setClock((c) => (c.start ? c : { start: Date.now() }))
  }, [item.kind])

  const { style, leave } = useScreenMotion(state, dir)
  // Phase 3: Start makes the intro vanish into smoke before the first kata arrives.
  const { vanishing, vanish } = useIntroVanish()
  // Phase 3: the finish kept for the day streak, with the streak screen first on the day's first.
  const session = useSession()
  const { streak, streakScreen, leaveStreak } = useStreak({
    atWrap: item.kind === "wrap",
    run: state.run,
    // A published lesson's finish is kept for sign-in only while logged out, as the web keeps it
    // (lesson-view.tsx); signed in, progress-sync tells the server itself.
    id:
      data.path.startsWith("/l/") && session.state === "out"
        ? data.id
        : undefined,
  })
  const by = session.state === "in" ? session.account.handle : null
  // Only while the lesson is on screen: a row's peek in Explore loads this screen out of sight
  // (expo-router preloads the route), and a peeked lesson isn't an opened one.
  const focused = useIsFocused()
  // Handoff: while the lesson is open, a nearby Mac or iPad offers its web page.
  useHandoff(focused ? lessonLink(API_BASE_URL, data.path) : null, lesson.title)
  // The app icon's Continue quick action opens this lesson until it's finished.
  const { slugId } = useLocalSearchParams<{ slugId: string }>()
  useLastLesson(`/l/${slugId}`, lesson.title, item.kind === "wrap", focused)
  const onShare = useCallback(
    (first: number, total: number) =>
      void shareChallenge({
        title: lesson.title,
        path: data.path,
        first,
        total,
        by,
        t,
      }),
    [lesson.title, data.path, by, t]
  )
  const stage = useMemo(
    () => ({
      ninja,
      vanishing,
      streak,
      streakScreen,
      sound: sfx,
      onShare,
      uiLang: ui,
      challenge,
      markWord: (mark: Mark | undefined) => markWord(t, mark),
    }),
    [ninja, vanishing, streak, streakScreen, sfx, onShare, ui, challenge, t]
  )

  // When this screen came up: a quick second tap of Continue lands on nothing (screen-guard.ts).
  const shownAt = useRef(0)
  useLayoutEffect(() => {
    shownAt.current = Date.now()
  }, [state.index, state.run])
  const next = () => {
    if (!settled(shownAt.current, Date.now())) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (item.kind === "intro") {
      if (sfx) playEffect("vanish")
      vanish(() => dispatch({ type: "next" }))
    } else leave(item.kind === "concept", () => dispatch({ type: "next" }))
  }
  /** The tray's main action: a move to the next screen leaves this one first. */
  const run = (action: AppAction) => {
    if (action.type === "next") next()
    else {
      if (action.type !== "check")
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      dispatch(action)
    }
  }
  const close = closeLesson

  // Each new screen starts at the top (the wrap-up after the streak screen too).
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    scrollY.current = 0
  }, [state.index, streakScreen])

  const whyLabel = feedback.why?.everyPath ? t.everyPath : t.why
  // On a phone the tray holds only the screen's actions, and the wrap-up has none there (its
  // actions are in its own boxes), so the web hides it; the streak screen before it keeps its Continue.
  const trayShown = item.kind !== "wrap" || streakScreen
  const insets = useSafeAreaInsets()

  return (
    <DirectionView dir={dir} className="flex-1 bg-background">
      <LessonTextSize size={prefs.textSize} className="flex-1">
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
          end={
            <LessonMenu
              title={lesson.title}
              expiresAt={data.expiresAt}
              lessonLanguage={lesson.language}
              uiLanguage={ui}
              prefs={prefs}
              onPrefs={updatePrefs}
              onShare={() => void shareLesson(lesson.title, data.path)}
              onRestart={() => dispatch({ type: "restart" })}
              t={t}
            />
          }
          t={t}
        />
        {/* The window: on a phone, edge to edge between two hairlines. */}
        <View ref={windowRef} className="flex-1">
          {/* Phase 3: the smoke behind the intro; without the ninja it follows the title up. */}
          {item.kind === "intro" ? (
            <Aura shift={ninja === "off" ? -54 : 0} vanishing={vanishing} />
          ) : null}
          <ScrollView
            ref={scrollRef}
            // The header and tray already keep clear of the notch and the home bar.
            contentInsetAdjustmentBehavior="never"
            onScroll={(e) => {
              scrollY.current = e.nativeEvent.contentOffset.y
            }}
            scrollEventThrottle={16}
            className={cn(
              "flex-1 border-border",
              trayShown ? "border-y" : "border-t"
            )}
            contentContainerClassName={
              item.kind === "intro" || item.kind === "wrap"
                ? "grow justify-center px-4 py-16"
                : "px-4 py-6"
            }
            // Without the tray, the end of the wrap-up keeps clear of the home bar.
            contentContainerStyle={
              trayShown ? undefined : { paddingBottom: 64 + insets.bottom }
            }
          >
            <Animated.View style={style} className="mx-auto w-full max-w-2xl">
              {/* The lesson's content runs its own language's way, as the web's LessonContent:
                  an Arabic lesson reads right to left under the English interface, while the
                  header and the tray keep the interface's direction. */}
              <DirectionView
                // The intro and the wrap-up (and the streak screen before it) are the player's
                // own, in its language's direction; their lesson text (the title and summary, the
                // takeaways) runs the lesson's way itself (intro.tsx, wrap-up.tsx).
                dir={
                  item.kind === "wrap" || item.kind === "intro"
                    ? dir
                    : directionOf(lesson.language)
                }
              >
                <LessonContext value={lessonContext}>
                  <StageContext value={stage}>
                    <AnswerMarksContext value={answerMarks}>
                      <LessonScreen
                        // Each screen is its own: two katas of a kind in a row (an order after an order,
                        // two sorts in the fix round) mustn't share what the first one kept.
                        key={`${state.run}:${state.index}`}
                        data={data}
                        item={item}
                        state={state}
                        dispatch={dispatch}
                        feedback={feedback}
                        whyOpen={whyOpen}
                        t={t}
                      />
                    </AnswerMarksContext>
                  </StageContext>
                </LessonContext>
              </DirectionView>
            </Animated.View>
          </ScrollView>
        </View>
        {trayShown ? (
          <LessonTray
            tone={
              feedback.title || feedback.message ? feedback.tone : undefined
            }
            feedback={
              // The ninja's line and the notes are in the lesson's language, so they run its way.
              <DirectionView dir={directionOf(lesson.language)}>
                <TrayFeedback
                  title={feedback.title}
                  message={feedback.message}
                  why={
                    feedback.why
                      ? {
                          label: whyLabel,
                          open: feedback.why.open,
                          onPress: () => setWhyOpen((open) => !open),
                        }
                      : null
                  }
                />
              </DirectionView>
            }
          >
            {streakScreen ? (
              // Phase 3: the streak screen's Continue goes on to the wrap-up itself.
              <TrayButton
                label={t.continue}
                onPress={() => {
                  tapHaptic()
                  leaveStreak()
                  // A week, a month, a hundred days: the moment to ask for a rating.
                  if (streak) void askForReviewAt(streak.streak.current)
                }}
              />
            ) : feedback.primary ? (
              <TrayButton
                label={feedback.primary.label}
                variant={feedback.primary.variant}
                disabled={feedback.primary.disabled}
                onPress={() => run(feedback.primary!.action)}
              />
            ) : null}
            {feedback.hint ? (
              <TrayButton
                label={t.hint}
                variant="outline"
                pressed={feedback.hint.open}
                onPress={() => run({ type: "hint" })}
              />
            ) : null}
          </LessonTray>
        ) : null}
      </LessonTextSize>
    </DirectionView>
  )
}

/**
 * The screens' motion, on the UI thread, after the web's (lesson-player.tsx): a concept arrives
 * from the end side and leaves toward it, fading (300 ms in, 200 ms out); every other screen fades
 * up from 4 points below. Nothing moves when the system asks for reduced motion.
 */
function useScreenMotion(state: State, dir: Direction) {
  const reduced = useReducedMotion()
  const opacity = useSharedValue(1)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const end = dir === "rtl" ? -1 : 1
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
    // Moves on even when the slide is cut short (another animation took over), or the screen would
    // stay faded with its Continue spent.
    opacity.value = withTiming(0, ease, () => {
      runOnJS(then)()
    })
  }

  return { style, leave }
}
