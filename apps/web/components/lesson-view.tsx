"use client"

import * as React from "react"
import {
  EyeOffIcon,
  FlagIcon,
  GlobeIcon,
  LinkIcon,
  SettingsIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import {
  LessonPlayer,
  type LessonPlayerProps,
  type Theme,
} from "@workspace/player"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@workspace/ui/components/dropdown-menu"

import { ReportDialog } from "@/components/explore/report-dialog"
import type { Visibility } from "@/lib/explore/queries"

export interface LessonViewProps extends LessonPlayerProps {
  /** The published lesson's id, for the report and the owner's menu. */
  lessonId?: string
  /** Whether to offer "Report lesson" in the lesson menu: listed lessons, to anyone but their owner. */
  canReport?: boolean
  /** When the viewer owns the lesson: how it's listed, with a way to their profile's list once they have a handle. */
  owner?: { visibility: Visibility; hidden: boolean; handle: string | null }
  /** Record finishing the lesson to the viewer's account (signed in only), for the check on Explore. */
  recordCompletion?: boolean
}

/**
 * The lesson player with the footer's theme setting connected to next-themes. A page that doesn't
 * pass `uiLanguage` (the prerendered /lessons pages) still honors ?ui=, read after mounting, the
 * same moment the player loads saved preferences, so the page can stay static. Published lessons
 * add the site's own items to the lesson menu: a report, or the owner's listing status, and tell
 * the server when a signed-in viewer reaches the wrap-up.
 */
export function LessonView({
  lessonId,
  canReport = false,
  owner,
  recordCompletion = false,
  ...props
}: LessonViewProps) {
  const { theme, setTheme } = useTheme()
  // next-themes only knows the saved theme after mounting; show "System" until then.
  const [mounted, setMounted] = React.useState(false)
  const [urlLanguage, setUrlLanguage] = React.useState<string>()
  const [reportOpen, setReportOpen] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
    setUrlLanguage(
      new URLSearchParams(window.location.search).get("ui") ?? undefined
    )
  }, [])
  const menuItems = lessonId ? (
    <>
      {owner ? (
        <>
          <DropdownMenuLabel className="flex items-center gap-1.5">
            {owner.hidden ? (
              <>
                <EyeOffIcon className="size-3.5" aria-hidden="true" />
                Hidden after a report
              </>
            ) : owner.visibility === "public" ? (
              <>
                <GlobeIcon className="size-3.5" aria-hidden="true" />
                Listed in Explore
              </>
            ) : (
              <>
                <LinkIcon className="size-3.5" aria-hidden="true" />
                Unlisted: link only
              </>
            )}
          </DropdownMenuLabel>
          {owner.handle ? (
            <DropdownMenuItem href={`/u/${owner.handle}#lessons`}>
              <SettingsIcon />
              Your lessons
            </DropdownMenuItem>
          ) : null}
        </>
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
        {...props}
        uiLanguage={props.uiLanguage ?? urlLanguage}
        theme={mounted ? ((theme as Theme | undefined) ?? "system") : "system"}
        onThemeChange={setTheme}
        menuItems={menuItems}
        onComplete={
          lessonId && recordCompletion
            ? () => {
                fetch(`/api/lessons/${lessonId}/complete`, {
                  method: "POST",
                  keepalive: true,
                }).catch(() => {})
              }
            : undefined
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
