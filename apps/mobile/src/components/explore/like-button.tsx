import { router } from "expo-router"
import { useState } from "react"
import { Pressable } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { HeartIcon } from "@/components/icons"
import { Text } from "@/components/ui/text"
import { setLiked } from "@/lib/feed"
import { tap } from "@/lib/haptics"
import { compact } from "@/lib/lesson-row"
import { colors } from "../../../tokens"

/**
 * The heart with the count, as the web's LikeButton: signed in, it toggles at once with a light
 * tap and settles on the server's count (or goes back if the server refused). Signed out, it
 * opens the log-in.
 */
export function LikeButton({
  id,
  likes,
  liked,
  signedIn,
  lang,
  t,
}: {
  id: string
  likes: number
  liked: boolean
  signedIn: boolean
  lang: string
  t: Strings
}) {
  const [state, setState] = useState({ liked, likes })
  const [busy, setBusy] = useState(false)
  const press = async () => {
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
  const color = state.liked
    ? colors.destructive.DEFAULT
    : colors.muted.foreground
  return (
    <Pressable
      onPress={() => void press()}
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
