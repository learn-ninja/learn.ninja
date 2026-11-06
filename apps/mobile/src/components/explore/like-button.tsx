import { router } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { HeartIcon } from "@/components/icons"
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

/** The heart with the count, as the web's LikeButton. */
export function LikeButton({
  like,
  lang,
  t,
}: {
  like: Like
  lang: string
  t: Strings
}) {
  const state = like
  const color = state.liked
    ? colors.destructive.DEFAULT
    : colors.muted.foreground
  return (
    <Pressable
      onPress={like.toggle}
      hitSlop={8}
      className="-me-2 flex-row items-center gap-1 rounded-md px-2 py-1 active:bg-accent/50"
      accessibilityRole="button"
      accessibilityLabel={state.liked ? t.liked : t.like}
      accessibilityValue={{ text: t.feed.likes(state.likes) }}
      accessibilityState={{ selected: state.liked }}
    >
      <HeartIcon
        size={14}
        color={color}
        fill={state.liked ? colors.destructive.DEFAULT : "none"}
      />
      <Text className="text-sm text-muted-foreground tabular-nums">
        {compact(state.likes, lang)}
      </Text>
    </Pressable>
  )
}
