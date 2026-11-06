import { SymbolView } from "expo-symbols"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { Text } from "@/components/ui/text"
import { setLiked } from "@/lib/feed"
import { tap } from "@/lib/haptics"
import { compact } from "@/lib/lesson-row"
import { colors } from "../../../tokens"

export interface Like {
  liked: boolean
  likes: number
  /** Likes or unlikes at once with a light tap, settling on the server's count; signed out, it opens the log-in. */
  toggle: () => void
}

/**
 * A lesson's like, shared by its row's heart and its long-press menu: toggled at once and settled
 * on the server's count (or put back if the server refused), as the web's LikeButton does.
 */
export function useLike({
  id,
  liked,
  likes,
  signedIn,
}: {
  id: string
  liked: boolean
  likes: number
  signedIn: boolean
}): Like {
  const [state, setState] = useState({ liked, likes })
  const [busy, setBusy] = useState(false)
  // A fresh count or like from the server (the feed refreshed: liked on the web, say) replaces
  // what the heart showed, unless a press is on its way.
  useEffect(() => {
    if (!busy) setState({ liked, likes })
    // Only new props, not the end of a press, which settles on the server's own answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liked, likes])
  const toggle = async () => {
    if (!signedIn) {
      router.push("/sign-in")
      return
    }
    if (busy) return
    tap()
    const before = state
    const next = !state.liked
    setState({ liked: next, likes: Math.max(0, state.likes + (next ? 1 : -1)) })
    setBusy(true)
    try {
      setState(await setLiked(id, next))
    } catch {
      setState(before)
    } finally {
      setBusy(false)
    }
  }
  return { ...state, toggle: () => void toggle() }
}

/**
 * The heart with the count, as the web's LikeButton, in the system's own heart (SF Symbols). It
 * bounces when the learner taps it, as iOS's hearts do; only then, so the hearts in a list don't
 * all bounce as they scroll in. The symbol replays its animation whenever it reloads, so the
 * bounce is on only for a moment after the tap: a like that arrives later (a refresh after a like
 * on the web) changes the heart without a bounce.
 */
export function LikeButton({
  like,
  lang,
  t,
}: {
  like: Like
  lang: string
  t: Strings
}) {
  const [tapped, setTapped] = useState(false)
  useEffect(() => {
    if (!tapped) return
    const timer = setTimeout(() => setTapped(false), 1000)
    return () => clearTimeout(timer)
  }, [tapped])
  return (
    <Pressable
      onPress={() => {
        setTapped(true)
        like.toggle()
      }}
      hitSlop={8}
      className="-me-2 flex-row items-center gap-1 rounded-md px-2 py-1 active:bg-accent/50"
      accessibilityRole="button"
      accessibilityLabel={like.liked ? t.liked : t.like}
      accessibilityValue={{ text: t.feed.likes(like.likes) }}
      accessibilityState={{ selected: like.liked }}
    >
      <SymbolView
        name={like.liked ? "heart.fill" : "heart"}
        size={14}
        tintColor={
          like.liked ? colors.destructive.DEFAULT : colors.muted.foreground
        }
        animationSpec={
          tapped ? { effect: { type: "bounce", wholeSymbol: true } } : undefined
        }
      />
      <Text className="text-sm text-muted-foreground tabular-nums">
        {compact(like.likes, lang)}
      </Text>
    </Pressable>
  )
}
