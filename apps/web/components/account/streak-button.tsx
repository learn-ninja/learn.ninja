"use client"

import { ArrowRightIcon } from "lucide-react"
import { useState } from "react"

import {
  Lantern,
  RestDays,
  StreakWeek,
  type DayStreak,
} from "@workspace/player"
import { Button } from "@workspace/ui/components/button"
import { Popover, PopoverTrigger } from "@workspace/ui/components/popover"

import { ButtonLink } from "@/components/site/button-link"

/**
 * The header's streak, before the profile picture: a lantern and the days in a row. The lantern is
 * lit once today has a finished lesson and unlit until then, so the header says whether today
 * still needs one. Pressing it opens the last seven days, the best streak, the rest days and how
 * close the next one is, and the way to the profile's activity grid.
 */
export function StreakButton({
  streak,
  profileHref,
  defaultOpen,
}: {
  streak: DayStreak
  /** The learner's profile, where the activity grid is; left out for a learner without a handle. */
  profileHref?: string
  /** For stories: start with the popover open. */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const today = streak.days.at(-1)?.state === "lit"
  const { current, longest, rest } = streak
  const title = `${current}-day streak`
  const hint =
    current === 0
      ? "Finish a lesson to light your first lantern."
      : today
        ? "Today's lantern is lit."
        : rest > 0
          ? "Finish a lesson today, or a rest day will keep your streak."
          : "Finish a lesson today to keep your streak."
  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${title}. ${hint}`}
        className="gap-1.5 px-2 tabular-nums"
      >
        <Lantern look={today ? "lit" : "unlit"} />
        {current}
      </Button>
      <Popover placement="bottom end" className="w-72 gap-0 p-0">
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium">{title}</p>
            {longest > 0 ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                Best {longest}
              </p>
            ) : null}
          </div>
          <StreakWeek days={streak.days} />
          <p className="text-muted-foreground">{hint}</p>
        </div>
        <RestDays streak={streak} className="border-t p-3" />
        {profileHref ? (
          <div className="border-t p-1">
            <ButtonLink
              href={profileHref}
              variant="ghost"
              size="sm"
              className="w-full justify-between"
              onClick={() => setOpen(false)}
            >
              Your activity
              <ArrowRightIcon
                data-icon="inline-end"
                className="rtl:-scale-x-100"
              />
            </ButtonLink>
          </div>
        ) : null}
      </Popover>
    </PopoverTrigger>
  )
}
