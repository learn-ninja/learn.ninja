import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
} from "react-native-reanimated"
import Svg, { Ellipse, G, Path } from "react-native-svg"

import {
  ANTIC_EVERY,
  ANTICS,
  ENTRANCE,
  IDLE,
  NINJA_ENERGY,
  NINJA_GAZE,
  reactionFor,
  WRAP,
  type Beat,
  type CueKind,
  type NinjaEnergy,
  type NinjaMood,
} from "@workspace/player-core/ninja"

import {
  BREATHING,
  CHANNELS,
  CLOSED,
  ENTRANCE_MOVES,
  gazeMs,
  moodLook,
  moves,
  REST,
  segments,
  TWEAK,
  type Channel,
  type Ease,
  type Pose,
  type Track,
} from "@/lib/ninja-moves"
import { colors } from "../../tokens"

// The ninja: the logo as a character, drawn with react-native-svg from the web's own shapes
// (packages/player/src/ninja.tsx), and moved by Reanimated on the UI thread with the web's moods,
// reactions, entrance, and idle life (the tables in @workspace/player-core/ninja, the keyframes in
// src/lib/ninja-moves.ts). Nothing moves under reduced motion: his moods still change his eyes and
// how he holds his head, as they do on the web, but no keyframes, entrance, or idle life play.
//
// The question feedback can call him too: pass `cue` (cueKindFor in player-core/ninja.ts, keyed per
// check) or hold a ref and call `play(reactionFor(...).beats)`. On a phone the web shows him only in
// a screen's slot (the intro, the wrap-up), so the app does the same for now.

export interface NinjaCue {
  kind: CueKind
  /** Changes once per thing worth reacting to (a check, a reveal). */
  key: string
}

export interface NinjaHandle {
  /** Plays a reaction's beats, then settles back to idle. */
  play: (beats: Beat[]) => Promise<void>
  /** Points the eyes: ±5 sideways, about -2 to 2.5 up and down, in the mark's own units. */
  look: (x: number, y: number) => void
}

/** The open eyes' centres in the drawing, start one first. */
const EYES = [25, 39] as const
const EYE = { rx: 2.9, ry: 4.6, cy: 32 }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

function easing(ease: Ease): EasingFunction | EasingFunctionFactory {
  if (ease === "linear") return Easing.linear
  if (ease === "step") return Easing.steps(1, false)
  return Easing.bezier(...ease)
}

/** The head's own easing when it changes pose without keyframes (the web's 0.45 s transition). */
const HEAD_EASE = Easing.bezier(0.3, 1.3, 0.5, 1)
const GAZE_EASE = Easing.bezier(0.2, 0.7, 0.2, 1)
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1)

type Pose5 = Record<Channel, SharedValue<number>>

function usePose(): Pose5 {
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const rot = useSharedValue(0)
  const sx = useSharedValue(1)
  const sy = useSharedValue(1)
  return useMemo(() => ({ tx, ty, rot, sx, sy }), [tx, ty, rot, sx, sy])
}

/** Runs a track on a pose's channels, `scale` turning mark units into points, from and back to `held`. */
function runTrack(pose: Pose5, track: Track, held: Pose, scale: number): void {
  const ease = easing(track.ease)
  for (const c of CHANNELS) {
    const sv = pose[c]
    if (!moves(track, c) && sv.value === held[c] * unit(c, scale)) continue
    const steps = segments(track, c, held[c]).map((s) =>
      withTiming(s.to * unit(c, scale), { duration: s.ms, easing: ease })
    )
    const once = steps.length > 1 ? withSequence(...steps) : steps[0]!
    sv.value = track.loop ? withRepeat(once, -1) : once
  }
}

/** Moves and turns are in mark units or degrees; scales have none. */
const unit = (c: Channel, scale: number) =>
  c === "tx" || c === "ty" ? scale : 1

function holdPose(pose: Pose5, held: Pose, scale: number, ms = 450) {
  for (const c of CHANNELS)
    pose[c].value = withTiming(held[c] * unit(c, scale), {
      duration: ms,
      easing: HEAD_EASE,
    })
}

function poseStyle(pose: Pose5) {
  "worklet"
  return [
    { translateX: pose.tx.value },
    { translateY: pose.ty.value },
    { rotate: `${pose.rot.value}deg` },
    { scaleX: pose.sx.value },
    { scaleY: pose.sy.value },
  ]
}

export const Ninja = forwardRef<
  NinjaHandle,
  {
    /** His box, in points: 88 in a screen's slot, as on the web. */
    size?: number
    /** Which character he is. */
    level?: NinjaEnergy
    /** Plays the intro's entrance, in character, when he first shows. */
    entrance?: boolean
    /** The wrap-up's send-off, with more for a perfect run. */
    celebrate?: "done" | "perfect"
    /** The last answer worth a reaction. */
    cue?: NinjaCue | null
    /** He goes up in smoke with the intro. */
    vanishing?: boolean
    /** He turns up out of a wisp of smoke (the wrap-up, as he does on the web after vanishing). */
    appear?: boolean
  }
>(function Ninja(
  {
    size = 88,
    level = "sensei",
    entrance = false,
    celebrate,
    cue,
    vanishing = false,
    appear = false,
  },
  ref
) {
  const reduced = useReducedMotion()
  const u = size / 64
  const energy = NINJA_ENERGY[level]
  const gaze = gazeMs(NINJA_GAZE[level])

  const body = usePose()
  const head = usePose()
  const shown = useSharedValue(1)
  const enter = usePose()
  // Hidden from the first frame when he is about to enter or turn up, so he never flashes in place.
  const enterOpacity = useSharedValue((entrance || appear) && !reduced ? 0 : 1)
  const ex = useSharedValue(0)
  const ey = useSharedValue(0)
  const sx0 = useSharedValue(1)
  const sx1 = useSharedValue(1)
  const sy0 = useSharedValue(1)
  const sy1 = useSharedValue(1)
  // Stable, so the callbacks and his idle life aren't set up again on every render.
  const eyeSx = useMemo(() => [sx0, sx1] as const, [sx0, sx1])
  const eyeSy = useMemo(() => [sy0, sy1] as const, [sy0, sy1])
  const open = useSharedValue(1)
  const happy = useSharedValue(0)
  const sad = useSharedValue(0)

  const mood = useRef<NinjaMood>("idle")
  const held = useRef(false)
  const alive = useRef(true)
  const breathing = IDLE[level].breathing && !reduced
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const look = useCallback(
    (x: number, y: number, ms = gaze) => {
      ex.value = withTiming(x * u, { duration: ms, easing: GAZE_EASE })
      ey.value = withTiming(y * u, { duration: ms, easing: GAZE_EASE })
    },
    [ex, ey, u, gaze]
  )

  /** His resting body: still, or the sensei's breathing. */
  const settleBody = useCallback(() => {
    if (breathing) runTrack(body, BREATHING, REST, u)
    else holdPose(body, REST, u, 200)
  }, [body, breathing, u])

  const setMood = useCallback(
    (next: NinjaMood) => {
      mood.current = next
      const look_ = moodLook(next, energy)
      const fade = (sv: SharedValue<number>, to: number, ms: number) => {
        sv.value = withTiming(to, { duration: ms, easing: CSS_EASE })
      }
      fade(open, look_.eyes === "open" ? 1 : 0, 250)
      fade(happy, look_.eyes === "happy" ? 1 : 0, 220)
      fade(sad, look_.eyes === "sad" ? 1 : 0, 220)
      for (const i of [0, 1] as const) {
        const [sx, sy] = look_.squash[i]
        if (look_.eyeTrack && !reduced) {
          for (const [sv, c] of [
            [eyeSx[i], "sx"],
            [eyeSy[i], "sy"],
          ] as const) {
            const ease = easing(look_.eyeTrack.ease)
            sv.value = withSequence(
              ...segments(look_.eyeTrack, c, 1).map((s) =>
                withTiming(s.to, { duration: s.ms, easing: ease })
              )
            )
          }
        } else {
          eyeSx[i].value = withTiming(sx, { duration: 130, easing: CSS_EASE })
          eyeSy[i].value = withTiming(sy, { duration: 130, easing: CSS_EASE })
        }
      }
      if (look_.look) look(...look_.look)
      if (look_.headTrack && !reduced)
        runTrack(head, look_.headTrack, look_.head, u)
      else holdPose(head, look_.head, u)
      if (look_.bodyTrack && !reduced) {
        runTrack(body, look_.bodyTrack, REST, u)
        // Back to breathing once the move is over.
        if (breathing)
          setTimeout(() => {
            if (alive.current && mood.current === next) settleBody()
          }, look_.bodyTrack.ms)
      } else if (next === "idle") settleBody()
    },
    [
      energy,
      open,
      happy,
      sad,
      eyeSx,
      eyeSy,
      look,
      head,
      body,
      u,
      reduced,
      breathing,
      settleBody,
    ]
  )

  const play = useCallback(
    async (beats: Beat[]) => {
      held.current = true
      for (const [m, ms, x, y] of beats) {
        if (!alive.current) return
        setMood(m)
        if (x !== undefined) look(x, y ?? 0)
        await sleep(reduced ? Math.min(ms, 600) : ms)
      }
      if (!alive.current) return
      setMood("idle")
      look(0, 0)
      held.current = false
    },
    [setMood, look, reduced]
  )

  useImperativeHandle(ref, () => ({ play, look }), [play, look])

  // His idle life: blinks, glances, and at the livelier settings a stunt now and then; the
  // sensei breathes and sometimes closes his eyes for a while. The phone has no pointer to follow.
  useEffect(() => {
    if (reduced) return
    let on = true
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t)
        if (on) fn()
      }, ms)
      timers.add(t)
    }
    const idle = IDLE[level]
    let meditating = false
    const blinkOnce = (ms: number) => {
      if (moodLook(mood.current).eyes !== "open") return
      for (const i of [0, 1] as const) {
        const [sx, sy] = moodLook(mood.current, energy).squash[i]
        eyeSx[i].value = withSequence(
          withTiming(CLOSED[0], { duration: Math.min(130, ms) }),
          withTiming(sx, { duration: 130 })
        )
        eyeSy[i].value = withSequence(
          withTiming(CLOSED[1], { duration: Math.min(130, ms) }),
          withTiming(sy, { duration: 130 })
        )
      }
    }
    const blink = () => {
      if (!held.current && !meditating) {
        blinkOnce(idle.blinkMs)
        if (Math.random() < idle.doubleBlink) later(() => blinkOnce(110), 280)
      }
      later(blink, rnd(...idle.blink))
    }
    const wander = () => {
      if (!held.current && !meditating) {
        if (Math.random() < idle.center) look(0, 0)
        else look(rnd(-4.5, 4.5), rnd(-1.6, 2.2))
      }
      later(wander, rnd(...idle.wander))
    }
    const meditate = () => {
      const m = idle.meditate
      if (!m) return
      if (!held.current) {
        meditating = true
        setMood("closed")
        later(
          () => {
            meditating = false
            if (!held.current) setMood("idle")
          },
          rnd(...m.lasting)
        )
      }
      later(meditate, rnd(...m.every))
    }
    const stunts = ANTICS[level]
    const antic = () => {
      if (!held.current && stunts.length)
        void play(stunts[Math.floor(Math.random() * stunts.length)]!)
      later(antic, rnd(...ANTIC_EVERY[level]))
    }
    const tremor = () => {
      if (!held.current) {
        runTrack(body, TWEAK, REST, u)
        later(
          () => {
            if (!held.current) settleBody()
          },
          rnd(1500, 3000)
        )
      }
      later(tremor, rnd(6000, 12000))
    }
    later(blink, rnd(2000, 4000))
    later(wander, 600)
    if (stunts.length) later(antic, rnd(...ANTIC_EVERY[level]))
    if (level === "unhinged") later(tremor, rnd(2500, 6000))
    if (idle.meditate) later(meditate, rnd(...idle.meditate.every))
    settleBody()
    return () => {
      on = false
      timers.forEach(clearTimeout)
      for (const c of CHANNELS) cancelAnimation(body[c])
    }
  }, [
    reduced,
    level,
    energy,
    eyeSx,
    eyeSy,
    look,
    setMood,
    play,
    body,
    u,
    settleBody,
  ])

  // The intro's entrance, in character: the wrapper bounces or settles in, and the moods play along.
  useEffect(() => {
    if (!entrance || reduced) return
    const { className, beats, ends } = ENTRANCE[level]
    const move = ENTRANCE_MOVES[className as keyof typeof ENTRANCE_MOVES]
    if (!move) return
    held.current = true
    const ease = easing(move.ease)
    const run = (
      sv: SharedValue<number>,
      c: Channel | "opacity",
      from: number
    ) => {
      sv.value = withSequence(
        ...segments(move, c, from).map((s) =>
          withTiming(s.to, { duration: s.ms, easing: ease })
        )
      )
    }
    run(enterOpacity, "opacity", 1)
    for (const c of CHANNELS) run(enter[c], c, REST[c])
    const timers = beats.map(([at, m]) => setTimeout(() => setMood(m), at))
    timers.push(
      setTimeout(() => {
        setMood("idle")
        held.current = false
      }, ends)
    )
    return () => {
      timers.forEach(clearTimeout)
      held.current = false
    }
    // The entrance plays once, when he first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrance, reduced, level])

  // Turning up out of smoke: in from a little bigger, fading up (the web's smoke-appear).
  useEffect(() => {
    if (!appear || reduced) return
    const ease = Easing.bezier(0.2, 0.7, 0.2, 1)
    enterOpacity.value = 0
    enter.sx.value = 1.4
    enter.sy.value = 1.4
    enterOpacity.value = withTiming(1, { duration: 500, easing: ease })
    enter.sx.value = withTiming(1, { duration: 500, easing: ease })
    enter.sy.value = withTiming(1, { duration: 500, easing: ease })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appear, reduced])

  // Going up in smoke with the intro (the web's smoke-fade): he thins and drifts up.
  useEffect(() => {
    if (!vanishing || reduced) return
    const ease = Easing.in(Easing.ease)
    shown.value = withTiming(0, { duration: 400, easing: ease })
    enter.ty.value = withTiming(-12, { duration: 400, easing: ease })
  }, [vanishing, reduced, shown, enter])

  // Reactions to answers, once per cue, never the same one twice in a row.
  const lastName = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!cue) return
    const { name, beats } = reactionFor(
      cue.kind,
      cue.key,
      level,
      lastName.current
    )
    lastName.current = name
    void play(beats)
    // A cue is its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue?.key, cue?.kind, level])

  // The wrap-up's send-off, once he has turned up.
  useEffect(() => {
    if (!celebrate) return
    const id = setTimeout(
      () => void play(WRAP[level][celebrate]),
      appear && !reduced ? 500 : 0
    )
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate, level])

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value * shown.value,
    transform: poseStyle(enter),
  }))
  const bodyStyle = useAnimatedStyle(() => ({ transform: poseStyle(body) }))
  const headStyle = useAnimatedStyle(() => ({ transform: poseStyle(head) }))
  const eyesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ex.value }, { translateY: ey.value }],
  }))
  const openStyle = useAnimatedStyle(() => ({ opacity: open.value }))
  const happyStyle = useAnimatedStyle(() => ({ opacity: happy.value }))
  const sadStyle = useAnimatedStyle(() => ({ opacity: sad.value }))
  const eye0 = useAnimatedStyle(() => ({
    transform: [{ scaleX: eyeSx[0].value }, { scaleY: eyeSy[0].value }],
  }))
  const eye1 = useAnimatedStyle(() => ({
    transform: [{ scaleX: eyeSx[1].value }, { scaleY: eyeSy[1].value }],
  }))

  const fill = { position: "absolute", inset: 0 } as const
  const ink = colors.foreground
  return (
    <Animated.View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width: size, height: size }, enterStyle]}
    >
      <Animated.View style={[fill, bodyStyle]}>
        {/* The head turns about the web's transform-origin, 32 36 in the drawing. */}
        <Animated.View
          style={[fill, { transformOrigin: "50% 56.25%" }, headStyle]}
        >
          <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
            <G stroke={ink} strokeWidth={5} strokeLinejoin="round">
              <Path d="M7.01 24.83A26 26 0 0 1 56.99 24.83Q32 15.17 7.01 24.83Z" />
              <Path d="M56.99 39.17Q32 48.83 7.01 39.17A26 26 0 0 0 56.99 39.17Z" />
            </G>
          </Svg>
          <Animated.View style={[fill, eyesStyle]}>
            <Animated.View style={[fill, openStyle]}>
              {EYES.map((cx, i) => (
                <Animated.View
                  key={cx}
                  style={[
                    {
                      position: "absolute",
                      left: (cx - EYE.rx) * u,
                      top: (EYE.cy - EYE.ry) * u,
                      width: 2 * EYE.rx * u,
                      height: 2 * EYE.ry * u,
                    },
                    i === 0 ? eye0 : eye1,
                  ]}
                >
                  <Svg
                    width={2 * EYE.rx * u}
                    height={2 * EYE.ry * u}
                    viewBox={`0 0 ${2 * EYE.rx} ${2 * EYE.ry}`}
                  >
                    <Ellipse
                      cx={EYE.rx}
                      cy={EYE.ry}
                      rx={EYE.rx}
                      ry={EYE.ry}
                      fill={ink}
                    />
                  </Svg>
                </Animated.View>
              ))}
            </Animated.View>
            <Animated.View style={[fill, happyStyle]}>
              <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
                <G stroke={ink} strokeWidth={3.4} strokeLinecap="round">
                  <Path d="M21 34.4Q25 28.6 29 34.4" />
                  <Path d="M35 34.4Q39 28.6 43 34.4" />
                </G>
              </Svg>
            </Animated.View>
            <Animated.View style={[fill, sadStyle]}>
              <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
                <G stroke={ink} strokeWidth={3.4} strokeLinecap="round">
                  <Path d="M21.5 30.2Q25 34.6 28.5 31.6" />
                  <Path d="M42.5 30.2Q39 34.6 35.5 31.6" />
                </G>
              </Svg>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  )
})
