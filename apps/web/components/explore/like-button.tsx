"use client"

import * as React from "react"
import { HeartIcon } from "lucide-react"

import { Button, LinkButton } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { compact, exploreApi, type ExploreApi } from "@/lib/explore/browser"

/**
 * A heart with the count. Logged in, it toggles the like at once and settles on the server's
 * answer. Logged out, pressing it turns it into a "Log in to like" link in place: no modal.
 */
export function LikeButton({
  id,
  likes,
  liked = false,
  signedIn,
  api = exploreApi,
  className,
}: {
  id: string
  likes: number
  liked?: boolean
  signedIn: boolean
  api?: ExploreApi
  className?: string
}) {
  const [state, setState] = React.useState({ liked, likes })
  const [asked, setAsked] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!signedIn && asked) {
    const here =
      typeof window === "undefined"
        ? "/explore"
        : window.location.pathname + window.location.search
    return (
      <LinkButton
        href={`/login?callback=${encodeURIComponent(here)}`}
        variant="link"
        size="xs"
        className={cn("px-0", className)}
        autoFocus
      >
        <HeartIcon data-icon="inline-start" />
        Log in to like
      </LinkButton>
    )
  }

  async function toggle() {
    if (!signedIn) return setAsked(true)
    if (busy) return
    const was = state
    const next = {
      liked: !was.liked,
      likes: Math.max(0, was.likes + (was.liked ? -1 : 1)),
    }
    setState(next)
    setBusy(true)
    setError(null)
    const result = next.liked ? await api.like(id) : await api.unlike(id)
    setBusy(false)
    if (result.error) {
      setState(was)
      setError(result.error)
      return
    }
    if (typeof result.likes === "number")
      setState({ liked: next.liked, likes: result.likes })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        aria-pressed={state.liked}
        aria-label={`${state.likes} ${state.likes === 1 ? "like" : "likes"}${state.liked ? ", liked" : ""}`}
        onPress={() => void toggle()}
        className={cn(
          "tabular-nums",
          state.liked && "text-destructive hover:text-destructive",
          className
        )}
      >
        <HeartIcon
          data-icon="inline-start"
          className={cn(state.liked && "fill-current")}
        />
        {compact(state.likes)}
      </Button>
      {error ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}
    </>
  )
}
