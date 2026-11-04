import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  BotIcon,
  BrainIcon,
  FlameIcon,
  LanguagesIcon,
  MessageCircleQuestionMarkIcon,
  RouteIcon,
  ShapesIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react"
import type { Metadata } from "next"

import { Aura } from "@workspace/player/ninja"
import { Badge } from "@workspace/ui/components/badge"
import { LinkButton } from "@workspace/ui/components/button"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"

import { UserAvatar } from "@/components/account/user-avatar"
import { SectionDivider } from "@/components/home/section-divider"
import { MissionNinja } from "@/components/mission/hero-ninja"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { XLogo } from "@/components/site/social-icons"
import { loadContributors, type Person } from "@/lib/contributors"
import {
  AREAS,
  areaHref,
  CONTRIBUTING_URL,
  GOOD_FIRST_ISSUES_URL,
  MISSION,
  MISSION_SUMMARY,
  type Area,
  type AreaIcon,
} from "@/lib/mission"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Mission",
  description: `${MISSION} ${SITE.name} is open source, and every part of a lesson needs people who know it best.`,
  alternates: { canonical: "/mission" },
}

/** The contributor wall comes from GitHub, read again once a day. */
export const revalidate = 86400

const ICONS: Record<AreaIcon, LucideIcon> = {
  subjects: BookOpenIcon,
  languages: LanguagesIcon,
  katas: TargetIcon,
  rich: ShapesIcon,
  tutor: MessageCircleQuestionMarkIcon,
  memory: BrainIcon,
  paths: RouteIcon,
  motivation: FlameIcon,
  agents: BotIcon,
}

// Matches the player's ScreenLabel above each kata
const EYEBROW = "font-mono text-sm text-muted-foreground"

export default async function MissionPage() {
  const people = await loadContributors()
  const maker = SITE.makerGithub.toLowerCase()
  const colin = people.find((p) => p.id === maker)

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Hero />
        <Letter picture={colin?.image ?? null} />
        <Areas />
        <People people={people} />
      </main>
      <div className="pt-28 sm:pt-36">
        <SectionDivider />
      </div>
      {/* The page ends with the footer ninja's send-off. */}
      <SiteFooter
        className="max-w-3xl"
        greeting="Pick the part that's yours."
      />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative isolate mx-auto flex max-w-3xl flex-col items-center gap-7 px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-20 sm:pb-24">
        {/* The lesson intro's smoke, lifted (px) to billow around the ninja and the headline. */}
        <Aura shift={-110} />
        <MissionNinja />
        <h1 className="font-mono text-3xl font-semibold tracking-tight text-balance sm:text-5xl sm:leading-[1.05]">
          {MISSION}
        </h1>
        <p className="max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
          {MISSION_SUMMARY}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <LinkButton href="#areas" size="lg">
            Find your part
            <ArrowRightIcon
              data-icon="inline-end"
              className="rtl:-scale-x-100"
            />
          </LinkButton>
          <LinkButton href="#note" variant="outline" size="lg">
            Read Colin&apos;s note
          </LinkButton>
        </div>
      </div>
    </section>
  )
}

function Letter({ picture }: { picture: string | null }) {
  return (
    <section
      id="note"
      className="mx-auto flex w-full max-w-3xl scroll-mt-16 flex-col gap-10 px-4 pt-24 sm:px-6 sm:pt-32"
    >
      <div className="flex flex-col gap-4">
        <p className={EYEBROW}>A note from Colin</p>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          The expensive part of great learning just disappeared.
        </h2>
      </div>
      {/* A sheet of paper on the dark page: its own colors (site.css), the one light surface here. */}
      <article className="mission-paper flex flex-col gap-5 rounded-sm px-6 py-8 text-base leading-relaxed text-pretty sm:px-12 sm:py-12 sm:text-lg sm:leading-relaxed">
        <p>
          Hi, I&apos;m Colin. For seven years I&apos;ve been building Uxcel, an
          interactive design-education platform that grew to half a million
          learners and Fortune 500 teams around the world. It taught me what
          Duolingo, Brilliant, and Mimo know: people learn from short, hands-on
          lessons that answer back.
        </p>
        <p>
          It also taught me the cost. One great lesson takes a writer, a
          designer, an engineer, and weeks. So interactive learning stays behind
          a subscription, and only for the subjects a company can sell.
        </p>
        <p>
          Agents change that. Your agent writes the lesson on your side, so
          there&apos;s nothing for us to charge for. What&apos;s left is making
          every part of a lesson great: the katas, the visuals, the
          translations, the examples the agent learns from. No one company can
          do all of that. {SITE.name} is at its best as the sum of its parts,
          each built by the people who know it best.
        </p>
        <p>Pick the part that&apos;s yours. I answer every pull request.</p>
        <footer className="mt-4 flex items-center gap-3.5">
          <UserAvatar image={picture} handle="Colin" size="signature" />
          <div className="flex flex-col text-sm leading-normal">
            <span className="flex items-center gap-1 font-semibold">
              Colin Pace
              <LinkButton
                href={SITE.makerUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="ghost"
                size="icon-xs"
                aria-label={`Colin Pace on X (${SITE.maker})`}
                className="mission-paper-muted"
              >
                <XLogo />
              </LinkButton>
            </span>
            <span className="mission-paper-muted">Founder, {SITE.name}</span>
          </div>
        </footer>
      </article>
    </section>
  )
}

function Areas() {
  // The cards are wider than the page's column, like the home page's bento; the text keeps the
  // column (max-w-3xl less the other sections' sm:px-6, 45rem, so their edges line up).
  return (
    <section
      id="areas"
      className="mx-auto flex w-full max-w-[1032px] scroll-mt-16 flex-col gap-16 px-4 pt-28 sm:gap-20 sm:px-6 sm:pt-36"
    >
      <div className="mx-auto flex w-full max-w-[45rem] flex-col gap-4">
        <p className={EYEBROW}>Where help goes furthest</p>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Nine parts. Each its own craft.
        </h2>
        <p className="text-base text-pretty text-muted-foreground sm:text-lg">
          Pick the one you know best. The three marked Proposal first touch
          every lesson, so they start as an idea, not a pull request.
        </p>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 min-[60rem]:grid-cols-3">
        {AREAS.map((area) => (
          <li key={area.title} className="flex">
            <AreaCard area={area} />
          </li>
        ))}
      </ul>
      <p className="mx-auto -mt-8 w-full max-w-[45rem] text-sm text-pretty text-muted-foreground sm:-mt-12">
        Read{" "}
        <ExternalLink href={CONTRIBUTING_URL}>CONTRIBUTING.md</ExternalLink> and
        pick a{" "}
        <ExternalLink href={GOOD_FIRST_ISSUES_URL}>
          good first issue
        </ExternalLink>
        . We answer every pull request within a week.
      </p>
    </section>
  )
}

function AreaCard({ area }: { area: Area }) {
  const Icon = ICONS[area.icon]
  return (
    <a
      href={areaHref(area)}
      target="_blank"
      rel="noopener noreferrer"
      className="group/area flex w-full flex-col gap-4 rounded-xl bg-card p-6 shadow-xs ring-1 ring-foreground/10 outline-none hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-4">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-lg bg-muted"
        >
          <Icon className="size-5" />
        </span>
        <ArrowUpRightIcon
          aria-hidden="true"
          className="size-4 text-muted-foreground opacity-0 group-hover/area:opacity-100 group-focus-visible/area:opacity-100 motion-safe:transition-opacity rtl:-scale-x-100"
        />
        <span className="sr-only">(opens in a new tab)</span>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold tracking-tight">{area.title}</h3>
        <p className="max-w-xl text-sm text-pretty text-muted-foreground">
          <span className="font-medium text-foreground">{area.who}.</span>{" "}
          {area.ask}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        <Badge variant="outline" className="border-foreground/15">
          {area.level}
        </Badge>
        {area.proposal ? (
          <Badge
            variant="outline"
            className="border-dashed border-foreground/30 text-muted-foreground"
          >
            Proposal first
          </Badge>
        ) : null}
      </div>
    </a>
  )
}

function ExternalLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </a>
  )
}

function People({ people }: { people: Person[] }) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-28 sm:px-6 sm:pt-36">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Built in the open, by people like you.
        </h2>
        <p className="text-base text-pretty text-muted-foreground">
          Everyone who has landed a change on GitHub, and everyone helping
          without one. The next circle is yours.
        </p>
      </div>
      <ul className="flex flex-wrap gap-2 pt-2">
        {people.map((p) => (
          <li key={p.id}>
            <Face person={p} />
          </li>
        ))}
        <li>
          <TooltipTrigger>
            <a
              href={CONTRIBUTING_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Add yourself"
              className="flex size-10 items-center justify-center rounded-full border border-dashed border-foreground/30 text-xs font-medium text-muted-foreground outline-none hover:border-foreground/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              You
            </a>
            <Tooltip>Add yourself</Tooltip>
          </TooltipTrigger>
        </li>
      </ul>
    </section>
  )
}

/** A contributor's picture, linked to their profile, with their name on hover. */
function Face({ person }: { person: Person }) {
  const avatar = (
    <UserAvatar
      image={person.image}
      handle={person.name}
      size="wall"
      className="ring-4 ring-background"
    />
  )
  return (
    <TooltipTrigger>
      {person.href ? (
        <a
          href={person.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={
            person.login
              ? `${person.name} on GitHub (${person.login})`
              : `${person.name} on X`
          }
          className="block rounded-full outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition motion-safe:hover:-translate-y-0.5"
        >
          {avatar}
        </a>
      ) : (
        <span
          tabIndex={0}
          aria-label={person.name}
          className="block rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {avatar}
        </span>
      )}
      <Tooltip>{person.name}</Tooltip>
    </TooltipTrigger>
  )
}
