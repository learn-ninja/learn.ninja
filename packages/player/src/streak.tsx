"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

import { usePlayer } from "./context"
import { calm } from "./motion"

// The day streak, drawn as a paper lantern (chōchin): lit on a day with a finished lesson, red in
// outline on a rest day, unlit on a missed one. The header shows it with the count (apps/web), and
// the streak screen lights today's on the day's first lesson. Logged-in learners only, since their
// days are kept on the server, which also keeps the rules (apps/web/lib/activity/activity.ts):
// every third learning day saves a rest day, up to two, and a missed day spends one.

/** How a day stands in the streak: learned, kept by a rest day, missed, or today and still open. */
export type DayState = "lit" | "rest" | "missed" | "open"

/** One calendar day ("2026-10-26") and how it stands. */
export interface StreakDay {
  day: string
  state: DayState
}

/** The learner's streak, as of today. */
export interface DayStreak {
  /** Learning days in the run (rest days keep it going without adding to it). */
  current: number
  /** The longest run ever, `current` included. */
  longest: number
  /** Rest days saved, for days without a lesson. */
  rest: number
  /** The last seven days, oldest first, ending today. */
  days: StreakDay[]
}

/** How a lantern is drawn: lit, a rest day's red outline, unlit, or a day still to come. */
export type LanternLook = "lit" | "rest" | "unlit" | "ahead"

const LOOKS: Record<LanternLook, string> = {
  // A small lit lantern is a yellow outline; a big one is in the foreground color, lit from inside.
  lit: "text-amber-600 dark:text-amber-400",
  rest: "text-red-500",
  unlit: "text-muted-foreground",
  // Faded as a whole, not through a see-through color, so lines that cross don't show darker.
  ahead: "text-muted-foreground opacity-40",
}

// The lantern's lines on a 24px grid, after the design system's icon: the paper (flat where the
// caps sit on it, so no line runs through them), three stripes down it from cap to cap (one down
// the middle and two bowing out like a globe's meridians), and the caps.
const PAPER =
  "M7.75 4.67h8.5c2.54 1.46 4.25 4.2 4.25 7.33s-1.71 5.87-4.25 7.33h-8.5C5.21 17.87 3.5 15.13 3.5 12s1.71-5.87 4.25-7.33z"
const STRIPES =
  "M12 4.67v14.66M9.6 4.67C8 7 7.3 9.3 7.3 12s.7 5 2.3 7.33M14.4 4.67c1.6 2.33 2.3 4.63 2.3 7.33s-.7 5-2.3 7.33"
const CAPS =
  "M7.75 4.67V2.54C7.75 1.69 8.44 1 9.29 1h5.42c.85 0 1.54.69 1.54 1.54v2.13M7.75 19.33v2.13c0 .85.69 1.54 1.54 1.54h5.42c.85 0 1.54-.69 1.54-1.54v-2.13"

// The light, like a candle's: the paper yellow-white in the middle and orange at the edges, and a
// halo of the same orange around it.
const PAPER_LIGHT = [
  [0, "#fffbeb"],
  [0.5, "#fde68a"],
  [0.82, "#fb923c"],
  [1, "#ea580c"],
] as const
const HALO = "#f97316"
/** The paper's radius from the middle of the grid, where the halo starts. */
const EDGE = 8.6
/** How far the halo reaches from the middle, on the 24px grid. */
const REACH = 16

/**
 * The halo's stops: full at the paper's edge, then falling off as light does, roughly as
 * 1 / (1 + d²) and not in a straight line, which is what makes a glow look like light rather than
 * a gradient. It thins to nothing at `REACH`.
 */
const HALO_STOPS = Array.from({ length: 10 }, (_, k) => {
  const t = k / 9
  const start = EDGE / REACH
  const d = t * (REACH - EDGE)
  const spread = (REACH - EDGE) * 0.22
  return {
    offset: start + t * (1 - start),
    alpha: (1 / (1 + (d / spread) ** 2)) * (1 - t),
  }
})

/**
 * A paper lantern (chōchin): 24px grid, 2px round strokes, outline only, in `currentColor`, so it
 * sits with the app's other icons. A small one stays an outline, lit or not (its color says which).
 * `lit` fills a `big` one's paper with candlelight under its stripes, and the light spills past
 * its outline as a halo (drawn outside the 24px box, so nothing around it needs room for it). The
 * light is the same in both themes, as light is; on a light page the halo is fainter, since a lamp
 * in a bright room barely shows past itself.
 */
export const LanternIcon = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement> & {
    lit?: boolean
    /** A big lantern: lit, it fills with candlelight and throws a halo. A small one is clearer without either. */
    big?: boolean
    strokeWidth?: number
  }
>(function LanternIcon(
  { lit = false, big = false, strokeWidth = 2, className, ...props },
  ref
) {
  const id = React.useId()
  const ids = {
    paper: `${id}-paper`,
    clip: `${id}-clip`,
    halo: `${id}-halo`,
  }
  const lightOn = cn(
    "transition-opacity duration-700",
    lit ? "opacity-100" : "opacity-0"
  )
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      overflow="visible"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("lucide lucide-lantern overflow-visible", className)}
      {...props}
    >
      <defs>
        <clipPath id={ids.clip}>
          <path d={PAPER} />
        </clipPath>
        {/* Brightest a little below the middle, where the candle sits. */}
        <radialGradient
          id={ids.paper}
          gradientUnits="userSpaceOnUse"
          cx="12"
          cy="12.6"
          r="9"
        >
          {PAPER_LIGHT.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </radialGradient>
        <radialGradient
          id={ids.halo}
          gradientUnits="userSpaceOnUse"
          cx="12"
          cy="12.4"
          r={REACH}
        >
          {HALO_STOPS.map(({ offset, alpha }) => (
            <stop
              key={offset}
              offset={offset}
              stopColor={HALO}
              stopOpacity={alpha}
            />
          ))}
        </radialGradient>
      </defs>
      {/* A big lantern's light: the halo it throws on what's around it, and the lit paper. */}
      {big ? (
        <>
          <g className={lightOn}>
            <circle
              cx="12"
              cy="12.4"
              r={REACH}
              fill={`url(#${ids.halo})`}
              stroke="none"
              className="opacity-35 dark:opacity-60"
            />
          </g>
          <path
            d={PAPER}
            fill={`url(#${ids.paper})`}
            stroke="none"
            className={lightOn}
          />
        </>
      ) : null}
      <path d={STRIPES} clipPath={`url(#${ids.clip})`} />
      <path d={PAPER} />
      <path d={CAPS} />
    </svg>
  )
})

/**
 * The streak's lantern. Lit, a small one is a yellow outline, and a `big` one is in the foreground
 * color with candlelight in its paper and a halo around it; a rest day is a red outline, unlit the
 * muted color, and a day ahead fainter still. Its colors fade, so lighting it needs only `look` to
 * change.
 */
export function Lantern({
  look,
  big,
  strokeWidth,
  className,
}: {
  look: LanternLook
  /** The big lantern on the streak screen: lit, it keeps its stripes and throws a halo. */
  big?: boolean
  /** Thinner for a big lantern, as Lucide's large icons are drawn. */
  strokeWidth?: number
  className?: string
}) {
  return (
    <LanternIcon
      aria-hidden="true"
      lit={look === "lit"}
      big={big}
      strokeWidth={strokeWidth}
      className={cn(
        "size-4 shrink-0 transition-colors duration-500",
        big && look === "lit" ? "text-foreground" : LOOKS[look],
        className
      )}
    />
  )
}

const DAY_MS = 864e5
const dateOf = (day: string) => new Date(`${day}T00:00:00Z`)
const addDay = (day: string, n: number) =>
  new Date(dateOf(day).getTime() + n * DAY_MS).toISOString().slice(0, 10)

/** The weekday a week starts on in `lang`'s region, 0 for Sunday; Monday where the browser can't say. */
function weekStart(lang: string): number {
  try {
    const locale = new Intl.Locale(lang) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    const first = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay
    if (first) return first % 7
  } catch {
    // An unknown language: Monday, as most of the world counts.
  }
  return 1
}

const LOOK_OF: Record<DayState | "ahead", LanternLook> = {
  lit: "lit",
  rest: "rest",
  missed: "unlit",
  open: "unlit",
  ahead: "ahead",
}

/**
 * This calendar week as a row of lanterns over their weekday letters, starting on the day the
 * language's region starts its week: the days so far from `days` (the last seven, ending today),
 * today's letter in the foreground, and the days still to come faint.
 */
export function StreakWeek({
  days,
  className,
}: {
  days: StreakDay[]
  className?: string
}) {
  const { t, lang = "en" } = usePlayer()
  const today = days.at(-1)?.day
  if (!today) return null
  const sinceStart = (dateOf(today).getUTCDay() - weekStart(lang) + 7) % 7
  const week: { day: string; state: DayState | "ahead" }[] = [
    ...days.slice(days.length - 1 - sinceStart),
    ...Array.from({ length: 6 - sinceStart }, (_, i) => ({
      day: addDay(today, i + 1),
      state: "ahead" as const,
    })),
  ]
  const name = (day: string, weekday: "narrow" | "long") =>
    new Intl.DateTimeFormat(lang, { weekday, timeZone: "UTC" }).format(
      dateOf(day)
    )
  const said = {
    lit: t.streakDayLit,
    rest: t.streakDayRest,
    missed: t.streakDayUnlit,
    open: t.streakDayOpen,
    ahead: t.streakDayOpen,
  }
  return (
    <ol
      aria-label={t.streakWeek}
      className={cn("grid grid-cols-7 gap-1 text-xs", className)}
    >
      {week.map((d) => (
        <li
          key={d.day}
          className={cn(
            "flex flex-col items-center gap-1",
            d.day === today
              ? "font-medium text-foreground"
              : "text-muted-foreground"
          )}
        >
          <Lantern look={LOOK_OF[d.state]} className="size-5" />
          <span aria-hidden="true">{name(d.day, "narrow")}</span>
          <span className="sr-only">
            {name(d.day, "long")}: {said[d.state]}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** How long the screen waits before lighting today's lantern, so the learner sees it happen. */
const LIGHT_DELAY = 500

/**
 * The screen between the lesson's last brick and the wrap-up on the day's first finished lesson,
 * laid out like Duolingo's and Brilliant's: a big lantern that lights and swings once, the count
 * ticking up under it, then the week with today's lantern lit and a line under it. Day 1 says the
 * streak starts, or starts again after one broke. Still for reduced motion: it opens lit. Continue
 * is in the tray (ActionArea).
 */
export function StreakScreen({ streak }: { streak: DayStreak }) {
  const { t } = usePlayer()
  const [lit, setLit] = React.useState(false)
  React.useEffect(() => {
    if (calm()) {
      setLit(true)
      return
    }
    const id = setTimeout(() => setLit(true), LIGHT_DELAY)
    return () => clearTimeout(id)
  }, [])

  const { current, longest } = streak
  // Until it lights, the count and the week are yesterday's.
  const shown = lit ? current : Math.max(current - 1, 0)
  const days = lit
    ? streak.days
    : streak.days.map((d, i) =>
        i === streak.days.length - 1 ? { ...d, state: "open" as const } : d
      )
  const line =
    current > 1 ? t.streakLit : longest > 1 ? t.streakAgain : t.streakStarts
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <Lantern
        look={lit ? "lit" : "unlit"}
        big
        strokeWidth={1.25}
        className={cn("size-28", lit && "lantern-sway")}
      />
      <h1 className="flex flex-col items-center">
        {/* Said once, as the finished count; the ticking number is only for the eyes. */}
        <span className="sr-only">{t.streakDays(current)}</span>
        <span
          aria-hidden="true"
          className={cn(
            "text-4xl font-bold tabular-nums transition-colors duration-500",
            lit
              ? "text-orange-600 dark:text-orange-500"
              : "text-muted-foreground"
          )}
        >
          {shown}
        </span>
        <span aria-hidden="true" className="text-2xl font-semibold">
          {t.streakUnit(current)}
        </span>
      </h1>
      <div className="flex w-full max-w-xs flex-col gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
        <StreakWeek days={days} />
        <p className="text-sm font-medium text-muted-foreground">{line}</p>
        {streak.rest > 0 ? (
          <p className="flex items-center justify-center gap-1.5 border-t pt-3 text-sm font-medium">
            <Lantern look="rest" />
            {t.streakRest(streak.rest)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
