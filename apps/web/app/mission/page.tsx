import {
  ArrowRightIcon,
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
import Link from "next/link"

import { Aura } from "@workspace/player/ninja"
import { Badge } from "@workspace/ui/components/badge"
import { LinkButton } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { UserAvatar } from "@/components/account/user-avatar"
import { MissionNinja } from "@/components/mission/hero-ninja"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { GitHubLogo, XLogo } from "@/components/site/social-icons"
import { loadContributors, type Person } from "@/lib/contributors"
import {
  AREA_GROUPS,
  areaHref,
  CONTRIBUTING_URL,
  GOOD_FIRST_ISSUES_URL,
  MISSION,
  MISSION_STATS,
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

const EYEBROW =
  "text-xs font-medium tracking-widest text-muted-foreground uppercase"

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
        <Steps />
        <People people={people} />
      </main>
      {/* The page ends with the footer ninja's send-off and the two ways to start. */}
      <SiteFooter
        className="max-w-5xl"
        greeting="Pick the part that's yours."
        actions={
          <>
            <LinkButton
              href={SITE.repo}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
            >
              <GitHubLogo />
              Open on GitHub
            </LinkButton>
            <LinkButton
              href={GOOD_FIRST_ISSUES_URL}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="lg"
            >
              Good first issues
            </LinkButton>
          </>
        }
      />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative isolate mx-auto flex max-w-4xl flex-col items-center gap-7 px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-20 sm:pb-24">
        {/* The lesson intro's smoke, lifted (px) to billow around the ninja and the headline. */}
        <Aura shift={-110} />
        <MissionNinja />
        <Badge variant="outline" className="h-7 gap-1.5 px-3 text-sm">
          <GitHubLogo />
          Open source · Apache-2.0
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl sm:leading-[1.05]">
          {MISSION}
        </h1>
        <p className="max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
          {MISSION_SUMMARY}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <LinkButton href="#areas" size="lg">
            Find your part
            <ArrowRightIcon data-icon="inline-end" className="rtl:-scale-x-100" />
          </LinkButton>
          <LinkButton href="#note" variant="outline" size="lg">
            Read Colin&apos;s note
          </LinkButton>
        </div>
      </div>
      <dl className="relative mx-auto grid max-w-5xl grid-cols-2 px-4 sm:grid-cols-4 sm:border-t sm:px-6">
        {MISSION_STATS.map((s) => (
          <div
            key={s.value}
            className="flex flex-col gap-1.5 border-t py-6 sm:border-t-0 sm:border-s sm:ps-6 sm:first:border-s-0 sm:first:ps-0"
          >
            <dt className="order-2 text-sm text-muted-foreground">{s.label}</dt>
            <dd className="order-1 text-3xl font-semibold tracking-tight">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Letter({ picture }: { picture: string | null }) {
  return (
    <section
      id="note"
      className="mx-auto flex w-full max-w-2xl scroll-mt-16 flex-col gap-10 px-4 pt-24 sm:px-6 sm:pt-32"
    >
      <div className="flex flex-col gap-4 text-center">
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
          Duolingo, Brilliant, and Mimo know: people learn from short,
          hands-on lessons that answer back.
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
  return (
    <section
      id="areas"
      className="mx-auto flex w-full max-w-5xl scroll-mt-16 flex-col gap-16 px-4 pt-28 sm:gap-20 sm:px-6 sm:pt-36"
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <p className={EYEBROW}>Where help goes furthest</p>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Nine parts. Each its own craft.
        </h2>
        <p className="text-base text-pretty text-muted-foreground sm:text-lg">
          A lesson is only as good as its weakest part. Pick the one you know
          best. Three of them reach every lesson ever published, so they start
          as a proposal rather than a pull request.
        </p>
      </div>
      {AREA_GROUPS.map((group, i) => (
        <div
          key={group.title}
          className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10"
        >
          <div className="flex flex-col gap-3">
            <span
              aria-hidden="true"
              className="text-4xl font-semibold tracking-tight text-muted-foreground tabular-nums"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="text-2xl font-semibold tracking-tight">
              {group.title}
            </h3>
            <p className="text-sm text-pretty text-muted-foreground">
              {group.lead}
            </p>
          </div>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            {group.areas.map((area) => (
              <li
                key={area.title}
                className={cn("flex", area.wide && "sm:col-span-2")}
              >
                <AreaCard area={area} />
              </li>
            ))}
          </ul>
        </div>
      ))}
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
      className="group/area flex w-full flex-col gap-4 rounded-xl bg-card p-6 shadow-xs ring-1 ring-foreground/10 outline-none hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition motion-safe:hover:-translate-y-0.5"
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-lg bg-muted"
      >
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col gap-2">
        <h4 className="text-lg font-semibold tracking-tight">{area.title}</h4>
        <p className="max-w-xl text-sm text-pretty text-muted-foreground">
          <span className="font-medium text-foreground">{area.who}.</span>{" "}
          {area.ask}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="flex gap-1.5">
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
        </span>
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground group-hover/area:text-foreground">
          {area.proposal ? "Open an idea" : "See open issues"}
          <ArrowRightIcon
            aria-hidden="true"
            className="size-3.5 rtl:-scale-x-100"
          />
        </span>
      </div>
    </a>
  )
}

const STEPS = [
  {
    title: "Read the guide",
    body: (
      <>
        <ExternalLink href={CONTRIBUTING_URL}>CONTRIBUTING.md</ExternalLink>{" "}
        and the code of conduct. Ten minutes.
      </>
    ),
  },
  {
    title: "Play a lesson",
    body: (
      <>
        Open one from{" "}
        <Link
          href="/explore"
          className="rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Explore
        </Link>{" "}
        and find something you&apos;d make better.
      </>
    ),
  },
  {
    title: "Pick a small task",
    body: (
      <>
        Issues labelled{" "}
        <ExternalLink href={GOOD_FIRST_ISSUES_URL}>good first issue</ExternalLink>{" "}
        are sized for a first evening.
      </>
    ),
  },
  {
    title: "Send a pull request",
    body: "Say what changed and why, with a screenshot for anything visible.",
  },
]

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

function Steps() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pt-28 sm:px-6 sm:pt-36">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          New here? Four steps.
        </h2>
        <p className="text-base text-pretty text-muted-foreground">
          Colin and Yan answer every pull request and issue within a week, even
          if the answer is &ldquo;not yet&rdquo;.
        </p>
      </div>
      <ol className="grid grid-cols-[minmax(0,1fr)] border-t sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-2.5 pt-7 pe-6 pb-2">
            <span
              aria-hidden="true"
              className="text-4xl font-semibold tracking-tight text-muted-foreground tabular-nums"
            >
              {i + 1}
            </span>
            <span className="text-base font-semibold">{step.title}</span>
            <span className="text-sm text-pretty text-muted-foreground">
              {step.body}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function People({ people }: { people: Person[] }) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-4 pt-28 text-center sm:px-6 sm:pt-36">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Built in the open, by people like you.
        </h2>
        <p className="text-base text-pretty text-muted-foreground">
          Everyone who has landed a change on GitHub, and everyone helping
          without one. The next circle is yours.
        </p>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-2 gap-y-6 pt-2">
        {people.map((p) => (
          <li key={p.id} className="flex w-32 flex-col items-center gap-2">
            <Face person={p} />
          </li>
        ))}
        <li className="flex w-32 flex-col items-center gap-2">
          <a
            href={CONTRIBUTING_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Add yourself"
            className="flex size-16 items-center justify-center rounded-full border border-dashed border-foreground/30 text-sm font-medium text-muted-foreground outline-none hover:border-foreground/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            You
          </a>
          <span className="text-sm text-muted-foreground">Add yourself</span>
        </li>
      </ul>
      <p className="text-sm text-muted-foreground">
        {people.length} contributors ·{" "}
        <ExternalLink href={`${SITE.repo}/graphs/contributors`}>
          See everyone on GitHub
        </ExternalLink>
      </p>
    </section>
  )
}

/** A contributor's picture, linked to their profile, with their name and X link under it. */
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
    <>
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
        avatar
      )}
      <span className="flex max-w-full items-center gap-0.5">
        <span className="truncate text-sm font-medium" title={person.name}>
          {person.name}
        </span>
        {person.x && person.login ? (
          <LinkButton
            href={person.x}
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="icon-xs"
            aria-label={`${person.name} on X`}
            className="shrink-0 text-muted-foreground"
          >
            <XLogo />
          </LinkButton>
        ) : null}
      </span>
    </>
  )
}
