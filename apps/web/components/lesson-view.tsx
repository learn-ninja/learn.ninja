"use client"

import * as React from "react"
import { FlagIcon, SettingsIcon } from "lucide-react"

import {
  LessonPlayer,
  parseChallenge,
  type Challenge,
  type DayStreak,
  type LessonPlayerProps,
  type NextKind,
} from "@workspace/player"
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu"

import { useAccount } from "@/components/account/account-link"
import { AccountMenuItems } from "@/components/account/account-menu"
import { LessonAccount } from "@/components/account/lesson-account"
import { ReportDialog } from "@/components/explore/report-dialog"
import { FeedbackButton } from "@/components/feedback/feedback-button"
import { GitHubStars } from "@/components/site/github-stars"
import type { AccountInfo } from "@/lib/auth/account-info"
import { exploreApi } from "@/lib/explore/browser"
import { keepFinish, sendFinishes } from "@/lib/explore/finishes"
import type { Visibility } from "@/lib/explore/queries"
import { AGENT_PROMPT } from "@/lib/site"

/** What the wrap-up's Keep learning copies: the site's agent prompt, asking for the kind of lesson picked. */
function nextPrompt(kind: NextKind, topic: string, after: string): string {
  switch (kind) {
    case "next":
      return `${AGENT_PROMPT}${topic}, as a follow-up to my lesson "${after}".`
    case "deeper":
      return `${AGENT_PROMPT}${topic}, going deeper than my lesson "${after}": build on what it taught instead of repeating it.`
    case "harder":
      return `${AGENT_PROMPT}${topic}, at a harder level than my lesson "${after}".`
  }
}

export interface LessonViewProps extends LessonPlayerProps {
  /** The published lesson's id, for the report and the owner's menu. */
  lessonId?: string
  /** Whether to offer "Report lesson" in the lesson menu: listed lessons, to anyone but their owner. */
  canReport?: boolean
  /** When the viewer owns the lesson: how it's listed, with a way to their profile's list once they have a handle. */
  owner?: { visibility: Visibility; hidden: boolean; handle: string | null }
  /**
   * Record finishing the lesson, and how far the viewer gets before that, to their account (logged in
   * only): the check on Explore and their profile's In progress tab. Logged out, a finish is kept in
   * the browser and sent on the first page that's logged in.
   */
  recordCompletion?: boolean
  /** The lesson's likes and the viewer's, for the heart on the wrap-up; logged out, it offers `loginHref`. */
  likes?: { likes: number; liked: boolean; signedIn: boolean }
  /** Where a logged-out viewer logs in to like the lesson; send them back with ?like=1 to make the like. */
  loginHref?: string
  /** The logged-in user, or null when nobody is. Prerendered pages leave it out for the marker cookie. */
  account?: AccountInfo | null
  /** The logged-in learner's streak as it stands, for the header's lantern. */
  currentStreak?: DayStreak
}

/**
 * The lesson player with the site's account controls in its header. A page that doesn't pass
 * `uiLanguage` (the prerendered /lessons pages) still honors ?ui=, read after mounting, the same
 * moment the player loads saved preferences, so the page can stay static. Published lessons add
 * the site's own items to the lesson menu: a report, or the owner's listing status, tell the server
 * how far a logged-in viewer gets and when they reach the wrap-up, and give the wrap-up its heart.
 */
export function LessonView({
  lessonId,
  canReport = false,
  owner,
  recordCompletion = false,
  likes,
  loginHref,
  account: knownAccount,
  currentStreak,
  ...props
}: LessonViewProps) {
  const account = useAccount(knownAccount)
  // The lantern as it stands, until this finish lights it alongside the streak screen.
  const [lantern, setLantern] = React.useState(currentStreak)
  const [urlLanguage, setUrlLanguage] = React.useState<string>()
  const [reportOpen, setReportOpen] = React.useState(false)
  // Kept here, not in the wrap-up, so a replay's wrap-up shows the like the last one made.
  const [like, setLike] = React.useState(likes)
  // Likewise a publish from the wrap-up, which the lesson menu then shows too.
  const [visibility, setVisibility] = React.useState(owner?.visibility)
  // The lesson's link without ?ui= and the like, for the prompt the owner's Make changes copies.
  const [url, setUrl] = React.useState("")
  // A challenge in the link: the server reads it for /l/ pages; prerendered pages read it here.
  const [linkChallenge, setLinkChallenge] = React.useState<Challenge>()
  // The requests to the server, one after another: each waits for the one before it, so a slow
  // progress can't land after a higher one, or after the finish and mark the lesson in progress.
  const sentProgress = React.useRef<Promise<unknown>>(Promise.resolve())
  React.useEffect(() => {
    // Lessons this browser finished logged out, now that it's logged in.
    if (recordCompletion) void sendFinishes()
    setUrl(window.location.origin + window.location.pathname)
    const params = new URLSearchParams(window.location.search)
    if (!props.challenge)
      setLinkChallenge(parseChallenge(params.get("c"), params.get("by")))
    // In a transition, like the player's own language changes: the page stays up while it loads.
    React.startTransition(() => setUrlLanguage(params.get("ui") ?? undefined))
    // Back from logging in to like it (the wrap-up's Log in link adds ?like=1): the player
    // starts the lesson afresh, so the like they asked for is made here.
    if (params.get("like") === "1") {
      params.delete("like")
      const query = params.toString()
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (query ? `?${query}` : "")
      )
      if (lessonId && likes?.signedIn && !likes.liked)
        void exploreApi.like(lessonId).then((result) => {
          if (typeof result.likes === "number")
            setLike({ signedIn: true, liked: true, likes: result.likes })
        })
    }
    // Only on arriving at the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Where it stands is the badge by Share; the menu keeps the way to the rest. Left undefined when
  // there's nothing to add, or the player draws a separator over an empty group.
  const yourLessons = owner?.handle ? `/u/${owner.handle}` : null
  const menuItems =
    lessonId && (yourLessons || canReport) ? (
      <>
        {yourLessons ? (
          <DropdownMenuItem href={yourLessons}>
            <SettingsIcon />
            Your lessons
          </DropdownMenuItem>
        ) : null}
        {canReport ? (
          <DropdownMenuItem onAction={() => setReportOpen(true)}>
            <FlagIcon />
            Report lesson
          </DropdownMenuItem>
        ) : null}
      </>
    ) : undefined
  return (
    <>
      <LessonPlayer
        visualsCss={process.env.NEXT_PUBLIC_VISUALS_CSS}
        docsHref="/docs"
        privacyHref="/privacy"
        termsHref="/terms"
        // Once logged in, Explore is home, as in the site's header.
        homeHref={account ? "/explore" : "/"}
        {...props}
        uiLanguage={props.uiLanguage ?? urlLanguage}
        menuItems={menuItems}
        headerActions={
          <>
            <FeedbackButton
              lessonId={lessonId}
              onReport={canReport ? () => setReportOpen(true) : undefined}
            />
            {/* Guests may not know the site yet; logged in, they're in the app. */}
            {account ? null : <GitHubStars className="max-sm:hidden" />}
          </>
        }
        headerAccount={<LessonAccount account={account} streak={lantern} />}
        phoneAccount={
          account ? <AccountMenuItems account={account} /> : undefined
        }
        nextPrompt={nextPrompt}
        challenge={props.challenge ?? linkChallenge}
        creator={
          lessonId && owner
            ? {
                status: owner.hidden
                  ? "hidden"
                  : visibility === "public"
                    ? "published"
                    : "private",
                onPublish: async () => {
                  const result = await exploreApi.setVisibility(
                    lessonId,
                    "public"
                  )
                  if (!result.error) setVisibility("public")
                  return result
                },
                onUnpublish: async () => {
                  const result = await exploreApi.setVisibility(
                    lessonId,
                    "unlisted"
                  )
                  if (!result.error) setVisibility("unlisted")
                  return result
                },
                profileHref: owner.handle ? `/u/${owner.handle}` : undefined,
                url,
              }
            : undefined
        }
        like={
          lessonId && like
            ? {
                likes: like.likes,
                liked: like.liked,
                onChange: like.signedIn
                  ? async (liked) => {
                      const result = liked
                        ? await exploreApi.like(lessonId)
                        : await exploreApi.unlike(lessonId)
                      if (typeof result.likes === "number")
                        setLike({ signedIn: true, liked, likes: result.likes })
                      return result
                    }
                  : undefined,
                loginHref,
              }
            : undefined
        }
        onProgress={
          lessonId && recordCompletion
            ? (progress) => {
                sentProgress.current = sentProgress.current.then(() =>
                  fetch(`/api/lessons/${lessonId}/progress`, {
                    method: "PUT",
                    keepalive: true,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(progress),
                  }).catch(() => {})
                )
              }
            : undefined
        }
        onComplete={
          !lessonId
            ? undefined
            : recordCompletion
              ? () => {
                  if (props.streak) setLantern(props.streak)
                  sentProgress.current = sentProgress.current.then(() =>
                    fetch(`/api/lessons/${lessonId}/complete`, {
                      method: "POST",
                      keepalive: true,
                      headers: { "content-type": "application/json" },
                      // The day this counts for on the profile is the learner's, not UTC's.
                      body: JSON.stringify({
                        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                      }),
                    }).catch(() => {})
                  )
                }
              : // Logged out: kept in the browser, and sent once it's logged in.
                () => keepFinish(lessonId)
        }
      />
      {lessonId && canReport ? (
        <ReportDialog
          id={lessonId}
          isOpen={reportOpen}
          onOpenChange={setReportOpen}
        />
      ) : null}
    </>
  )
}
