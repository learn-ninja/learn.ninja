import { useEffect, useState } from "react"
import { View } from "react-native"
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"

import { initials, type ChatTurn } from "@workspace/player-core/chat"
import type { ChatVisual } from "@workspace/spec"

import { RichText } from "@/components/rich-text"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"
import { fontSize } from "../../../tokens"

// A conversation as chat bubbles, as the web's chat.tsx lays it out: the other people on the
// start side, each named above their run of bubbles with their initials beside it, and the
// learner's own lines on the end side in the accent color. A scenario adds two turns once the
// learner has picked: what they said, then the other person's reply, which waits behind typing
// dots first. The ninja beside the learner's lines comes with phase 3.

// The reply's timing, in ms: the pick lands, a beat, the other person types a while, then the
// reply takes the dots' place.
const PICK = 100
const DOTS = 800
const REPLY = 2300
const ENTER = 450

export function ChatBlock({
  chat,
  extra = [],
  label,
  plain = false,
}: {
  chat: ChatVisual
  /** Turns added after the lesson's own, like a scenario's pick and its reply. */
  extra?: ChatTurn[]
  label?: string
  plain?: boolean
}) {
  const reduced = useReducedMotion()
  const reply = extra.find((x) => x.added === "reply")
  const [typing, setTyping] = useState(false)
  const replyKey = reply ? `${reply.who}:${reply.text}` : null
  useEffect(() => {
    if (!replyKey || reduced) return
    setTyping(true)
    const timer = setTimeout(() => setTyping(false), REPLY)
    return () => clearTimeout(timer)
  }, [replyKey, reduced])
  const turns: ChatTurn[] = [...chat.turns, ...extra]
  const size = fontSize.sm[0]

  return (
    <View
      accessibilityLabel={chat.alt ?? label}
      className={cn(
        "w-full",
        !plain &&
          "min-h-72 justify-center rounded-xl border border-border bg-background px-4 py-4"
      )}
    >
      <View className="w-full gap-1">
        {turns.map((turn, i) => {
          const mine = !turn.who
          const prev = turns[i - 1]
          // A name heads a run of one person's bubbles; the next person's run starts a new group.
          const newRun = !prev || prev.who !== turn.who
          const waiting = turn.added === "reply" && typing
          const delay =
            turn.added === "pick"
              ? PICK
              : turn.added === "reply"
                ? waiting
                  ? DOTS
                  : 0
                : null
          const Wrap = delay === null ? View : Animated.View
          return (
            <Wrap
              key={waiting ? `${i}-typing` : i}
              entering={
                delay === null || reduced
                  ? undefined
                  : FadeInDown.delay(delay).duration(ENTER)
              }
              className={cn(
                "max-w-[85%] gap-1",
                mine ? "items-end self-end" : "items-start self-start",
                newRun && i > 0 && "mt-2"
              )}
            >
              {!mine && newRun ? (
                <Text className="ms-9 text-xs text-muted-foreground">
                  {turn.who}
                </Text>
              ) : null}
              <View className="flex-row items-end gap-2">
                {!mine ? (
                  <View
                    aria-hidden
                    className={cn(
                      "h-7 w-7 items-center justify-center rounded-full bg-muted",
                      // Only the last bubble of a run has the avatar; the rest leave its space.
                      turns[i + 1]?.who === turn.who && "opacity-0"
                    )}
                  >
                    <Text className="text-[10px] font-medium">
                      {initials(turn.who!)}
                    </Text>
                  </View>
                ) : null}
                <View
                  className={cn(
                    "rounded-[18px] px-3.5 py-2",
                    mine ? "rounded-ee-md bg-primary" : "rounded-es-md bg-muted"
                  )}
                >
                  {waiting ? (
                    <TypingDots />
                  ) : (
                    <RichText
                      text={turn.text}
                      size={size}
                      className={cn(
                        "text-lesson-sm",
                        mine && "text-primary-foreground"
                      )}
                    />
                  )}
                </View>
              </View>
            </Wrap>
          )
        })}
      </View>
    </View>
  )
}

/** Three dots that rise in turn, while a reply is "being typed". */
function TypingDots() {
  return (
    <View aria-hidden className="h-5 flex-row items-center gap-1 px-0.5">
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} />
      ))}
    </View>
  )
}

function Dot({ delay }: { delay: number }) {
  const y = useSharedValue(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 300 }),
          withTiming(0, { duration: 300 })
        ),
        -1
      )
    )
  }, [delay, reduced, y])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }))
  return (
    <Animated.View
      className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
      style={style}
    />
  )
}
