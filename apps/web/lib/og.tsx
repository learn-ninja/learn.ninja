import { readFileSync } from "node:fs"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { plainText, stringsFor, type Strings } from "@workspace/player"
import type { Lesson } from "@workspace/spec"

import { AGENTS, INSTALL_COMMAND, SITE } from "./site"

// Link preview images (Open Graph), drawn with next/og: the site's card, one per lesson, and one for
// expired links. They mirror the player: a bordered window showing the lesson's first question.
// The site's card also renders at other sizes for the files in brand/ (scripts/build-share-images.tsx).

export const OG_SIZE = { width: 1200, height: 630 }

export type Size = { width: number; height: number }

// The dark theme's tokens, as fixed colors (next/og can't read CSS variables).
const C = {
  page: "#171717",
  window: "#1f1f1f",
  card: "#262626",
  chip: "#303030",
  border: "#2e2e33",
  borderStrong: "#3f3f46",
  ring: "rgba(250,250,250,0.12)",
  foreground: "#fafafa",
  body: "#d4d4d8",
  muted: "#a1a1aa",
  faint: "#52525b",
  primary: "#fafafa",
}

// ---------- fonts ----------

// The site's fonts (Inter, and Geist Mono for the tagline and the command), fetched from Google Fonts as
// TTF (the only format next/og reads) and kept for the life of the process. If the fetch fails,
// next/og falls back to its bundled font.
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Geist+Mono:wght@500;600"
/** An old browser, so Google serves TTF instead of woff2. */
const TTF_USER_AGENT =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1"

type Weight = 400 | 500 | 600
type Font = { name: string; data: ArrayBuffer; weight: Weight; style: "normal" }

let fonts: Promise<Font[]> | undefined

function loadFonts(): Promise<Font[]> {
  fonts ??= (async () => {
    try {
      const css = await fetch(FONT_CSS, {
        headers: { "user-agent": TTF_USER_AGENT },
      }).then((r) => r.text())
      const faces = [
        ...css.matchAll(
          /font-family:\s*'([^']+)';[^}]*?font-weight:\s*(400|500|600);[^}]*?url\(([^)]+)\)/g
        ),
      ]
      return await Promise.all(
        faces.map(async ([, name, weight, url]) => ({
          name: name!,
          data: await fetch(url!).then((r) => r.arrayBuffer()),
          weight: Number(weight) as Weight,
          style: "normal" as const,
        }))
      )
    } catch {
      return []
    }
  })()
  return fonts
}

async function respond(element: React.ReactElement, size: Size = OG_SIZE) {
  const loaded = await loadFonts()
  return new ImageResponse(element, {
    ...size,
    fonts: loaded.length ? loaded : undefined,
  })
}

// ---------- pieces ----------

const row = { display: "flex", alignItems: "center" } as const
const column = { display: "flex", flexDirection: "column" } as const

function Mark({
  size,
  color = C.foreground,
}: {
  size: number
  color?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <g stroke={color} strokeWidth="5" strokeLinejoin="round">
        <path d="M7.01 24.83A26 26 0 0 1 56.99 24.83Q32 15.17 7.01 24.83Z" />
        <path d="M56.99 39.17Q32 48.83 7.01 39.17A26 26 0 0 0 56.99 39.17Z" />
      </g>
      <ellipse cx="25" cy="32" rx="2.9" ry="4.6" fill={color} />
      <ellipse cx="39" cy="32" rx="2.9" ry="4.6" fill={color} />
    </svg>
  )
}

/** The page: the dark stage, with the content padded in. */
function Page({
  children,
  dir = "ltr",
  padding = "52px 64px",
}: {
  children: React.ReactNode
  dir?: "ltr" | "rtl"
  padding?: string
}) {
  return (
    <div
      style={{
        ...column,
        width: "100%",
        height: "100%",
        padding,
        background: C.page,
        color: C.foreground,
        fontFamily: "Inter",
        direction: dir,
      }}
    >
      {children}
    </div>
  )
}

function Header({ k = 1 }: { k?: number }) {
  return (
    <div style={{ ...row, gap: 12 * k }}>
      <Mark size={36 * k} />
      <div
        style={{
          display: "flex",
          fontSize: 28 * k,
          fontWeight: 600,
          letterSpacing: -0.5 * k,
        }}
      >
        {SITE.name}
      </div>
    </div>
  )
}

function Pill({ children, k = 1 }: { children: string; k?: number }) {
  return (
    <div
      style={{
        display: "flex",
        padding: `${8 * k}px ${16 * k}px`,
        borderRadius: 999,
        border: `1.5px solid ${C.borderStrong}`,
        background: C.card,
        fontSize: 20 * k,
        fontWeight: 500,
        color: C.body,
      }}
    >
      {children}
    </div>
  )
}

/** The install command, as the terminal line it is. */
function Command({ k = 1 }: { k?: number }) {
  return (
    <div
      style={{
        ...row,
        alignSelf: "flex-start",
        gap: 12 * k,
        padding: `${12 * k}px ${20 * k}px`,
        borderRadius: 12 * k,
        border: `1.5px solid ${C.borderStrong}`,
        background: C.card,
        fontFamily: "Geist Mono",
        fontSize: 21 * k,
        fontWeight: 500,
        color: C.body,
      }}
    >
      <span style={{ color: C.faint }}>$</span>
      {INSTALL_COMMAND}
    </div>
  )
}

/** The first few agents from the home page, as the muted marks shown there. */
const SHOWN_AGENTS = AGENTS.slice(0, 6)

/**
 * An agent's logo as a data URL for an <img>, in the given color. The SVGs are drawn with
 * currentColor, which an image can't inherit. Read from public/agents (traced into the image route
 * by next.config.ts); if a file is missing, the logo is skipped.
 */
function agentLogo(logo: string, color: string): string | null {
  try {
    const svg = readFileSync(
      join(process.cwd(), "public", "agents", `${logo}.svg`),
      "utf8"
    ).replaceAll("currentColor", color)
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  } catch {
    return null
  }
}

/** A quiet row of agent marks, shown over the chat: it could be any of them. */
function Agents({ k = 1 }: { k?: number }) {
  const logos = SHOWN_AGENTS.map((a) => agentLogo(a.logo, C.muted)).filter(
    (src): src is string => src !== null
  )
  if (!logos.length) return null
  return (
    <div
      style={{ ...row, justifyContent: "center", gap: 24 * k, opacity: 0.8 }}
    >
      {logos.map((src, i) => (
        <img key={i} src={src} width={26 * k} height={26 * k} alt="" />
      ))}
    </div>
  )
}

/** The player's progress bar: four parts, the first under way. */
function Progress({ k }: { k: number }) {
  const dot = { height: 8 * k, borderRadius: 999, background: C.border }
  return (
    <div style={{ ...row, gap: 6 * k }}>
      <div style={{ display: "flex", width: 150 * k, ...dot }}>
        <div
          style={{
            display: "flex",
            width: 40 * k,
            height: 8 * k,
            borderRadius: 999,
            background: C.primary,
          }}
        />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", width: 8 * k, ...dot }} />
      ))}
    </div>
  )
}

/**
 * A lesson's first question, as the player shows it: a bordered window with option rows.
 * `k` scales every measure, so the same window fits a 630px card and a 1080px square.
 */
function Window({
  prompt,
  options,
  t,
  k = 1,
  width = 420,
}: {
  prompt: string
  options: string[]
  t: Strings
  k?: number
  width?: number
}) {
  return (
    <div
      style={{
        ...column,
        width,
        padding: 26 * k,
        gap: 20 * k,
        borderRadius: 28 * k,
        border: `1.5px solid ${C.borderStrong}`,
        background: C.window,
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
      }}
    >
      <Progress k={k} />
      <div
        style={{
          display: "flex",
          fontSize: 22 * k,
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: -0.3 * k,
          lineClamp: 3,
        }}
      >
        {prompt}
      </div>
      <div style={{ ...column, gap: 10 * k }}>
        {options.map((text, i) => (
          <div
            key={i}
            style={{
              ...row,
              justifyContent: "space-between",
              gap: 12 * k,
              padding: `${11 * k}px ${14 * k}px`,
              borderRadius: 10 * k,
              border: `1.5px solid ${C.border}`,
              background: C.card,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 18 * k,
                fontWeight: 500,
                color: C.body,
                lineClamp: 1,
              }}
            >
              {text}
            </div>
            <div
              style={{
                ...row,
                justifyContent: "center",
                width: 24 * k,
                height: 24 * k,
                borderRadius: 6 * k,
                border: `1px solid ${C.borderStrong}`,
                fontSize: 13 * k,
                color: C.muted,
              }}
            >
              {i + 1}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignSelf: "flex-start",
          padding: `${9 * k}px ${16 * k}px`,
          borderRadius: 8 * k,
          background: C.primary,
          color: C.page,
          fontSize: 16 * k,
          fontWeight: 600,
        }}
      >
        {t.check}
      </div>
    </div>
  )
}

/** The hook's prompt and option texts, if it has text options to show. */
function peek(lesson: Lesson) {
  const options = lesson.hook.options
    .map((o) => (o.text ? plainText(o.text) : ""))
    .filter(Boolean)
    .slice(0, 3)
  return options.length >= 2
    ? { prompt: plainText(lesson.hook.prompt), options }
    : null
}

function Headline({
  title,
  text,
  size = 64,
}: {
  title: string
  text?: string
  size?: number
}) {
  return (
    <div style={{ ...column, gap: 20 }}>
      <div
        style={{
          display: "flex",
          fontSize: size,
          fontWeight: 600,
          lineHeight: 1.08,
          letterSpacing: -2,
          lineClamp: 3,
        }}
      >
        {title}
      </div>
      {text ? (
        <div
          style={{
            display: "flex",
            fontSize: 26,
            lineHeight: 1.4,
            color: C.muted,
            lineClamp: 3,
          }}
        >
          {text}
        </div>
      ) : null}
    </div>
  )
}

/** The hero's headline, "Vibe learn [anything] with your agent", the word in the hero's pill. */
function Tagline({ size }: { size: number }) {
  const text = {
    display: "flex",
    fontSize: size,
    fontWeight: 600,
    lineHeight: 1.05,
    letterSpacing: -size * 0.02,
    whiteSpace: "nowrap",
    fontFamily: "Geist Mono",
  } as const
  return (
    <div style={{ ...column, alignItems: "flex-start", gap: size * 0.1 }}>
      <div style={text}>Vibe learn</div>
      <div
        style={{
          ...text,
          padding: `${size * 0.08}px ${size * 0.14}px`,
          borderRadius: size * 0.2,
          background: C.chip,
          border: `2px solid ${C.ring}`,
        }}
      >
        anything
      </div>
      <div style={text}>with your agent</div>
    </div>
  )
}

/** The lesson the site's card pretends to have made. */
const EXAMPLE = {
  ask: "How can I get started with vibe coding?",
  reply: "I made you a short lesson to get you started:",
  title: "How vibe coding works",
  link: "learn.ninja/l/vibe-coding-k3x9a2mq",
  minutes: 6,
  level: "beginner",
} as const

/**
 * The ask and the answer: you tell your agent what to teach, it replies with the lesson's link.
 * `k` scales every measure.
 */
function Chat({
  t,
  k = 1,
  width = 420,
}: {
  t: Strings
  k?: number
  width?: number
}) {
  const facts = [t.minutes(EXAMPLE.minutes), t.levels[EXAMPLE.level]]
  return (
    <div
      style={{
        ...column,
        width,
        gap: 22 * k,
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            display: "flex",
            maxWidth: 400 * k,
            padding: `${12 * k}px ${16 * k}px`,
            borderRadius: 18 * k,
            borderBottomRightRadius: 6 * k,
            border: `1.5px solid ${C.border}`,
            background: C.card,
            fontSize: 17 * k,
            fontWeight: 500,
            lineHeight: 1.35,
          }}
        >
          {EXAMPLE.ask}
        </div>
      </div>
      <div style={{ ...column, gap: 14 * k }}>
        <div
          style={{
            display: "flex",
            fontSize: 17 * k,
            lineHeight: 1.35,
            color: C.body,
          }}
        >
          {EXAMPLE.reply}
        </div>
        <div
          style={{
            ...column,
            maxWidth: 520 * k,
            gap: 16 * k,
            padding: 20 * k,
            borderRadius: 16 * k,
            border: `1.5px solid ${C.border}`,
            background: C.card,
          }}
        >
          <div style={{ ...row, gap: 8 * k }}>
            <Mark size={18 * k} color={C.muted} />
            <div
              style={{
                display: "flex",
                fontFamily: "Geist Mono",
                fontSize: 13 * k,
                color: C.muted,
                whiteSpace: "nowrap",
              }}
            >
              {EXAMPLE.link}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 20 * k,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: -0.3 * k,
              lineClamp: 2,
            }}
          >
            {EXAMPLE.title}
          </div>
          <div style={{ ...row, gap: 10 * k }}>
            {facts.map((f) => (
              <Pill key={f} k={0.8 * k}>
                {f}
              </Pill>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginTop: 4 * k,
              padding: `${10 * k}px ${16 * k}px`,
              borderRadius: 8 * k,
              background: C.primary,
              color: C.page,
              fontSize: 15 * k,
              fontWeight: 600,
            }}
          >
            {t.start}
          </div>
        </div>
      </div>
    </div>
  )
}

/** The agent marks over the chat. */
function Demo({ k, width }: { k: number; width: number }) {
  const t = stringsFor("en")
  return (
    <div style={{ ...column, alignItems: "center", gap: 20 * k }}>
      <Agents k={k} />
      <Chat t={t} k={k} width={width} />
    </div>
  )
}

// ---------- cards ----------

/**
 * The site's card: the tagline beside the ask-and-answer chat. Wide sizes put the chat beside the
 * tagline; a square stacks them.
 */
export function siteImage(size: Size = OG_SIZE) {
  const aspect = size.width / size.height
  const stacked = aspect < 1.4
  const banner = aspect > 2.5
  const k = size.width / 1200

  if (stacked) {
    return respond(
      <Page padding={`${60 * k}px ${72 * k}px`}>
        <Header k={k} />
        <div
          style={{ ...column, flex: 1, justifyContent: "center", gap: 44 * k }}
        >
          <Tagline size={76 * k} />
          <Demo k={1.3 * k} width={size.width - 144 * k} />
          <Command k={k} />
        </div>
      </Page>,
      size
    )
  }

  return respond(
    <Page padding={banner ? "40px 72px" : `${48 * k}px ${56 * k}px`}>
      <Header k={banner ? 1 : k} />
      <div style={{ ...row, flex: 1, gap: 40 * k }}>
        <div style={{ ...column, flex: 1, gap: 32 * k }}>
          <Tagline size={banner ? 60 : 64 * k} />
          <Command k={banner ? 1 : k} />
        </div>
        <Demo k={banner ? 1.05 : 1.18 * k} width={banner ? 440 : 500 * k} />
      </div>
    </Page>,
    size
  )
}

/** A lesson's card: title and summary, with its first question in the player's window. */
export function lessonImage(lesson: Lesson) {
  const t = stringsFor(lesson.language)
  const dir = /^(ar|he|fa|ur)\b/i.test(lesson.language) ? "rtl" : "ltr"
  const shown = peek(lesson)
  // The first two tags (the lesson's label, then its product or field), then length and level.
  const facts = [
    ...lesson.tags.slice(0, 2),
    t.minutes(lesson.estimatedMinutes),
    t.levels[lesson.level],
  ]
  return respond(
    <Page dir={dir}>
      <Header />
      <div style={{ ...row, flex: 1, gap: 56 }}>
        <div style={{ ...column, flex: 1, gap: 28 }}>
          <Headline title={lesson.title} text={lesson.summary} />
          <div style={{ ...row, gap: 10, flexWrap: "wrap" }}>
            {facts.map((f, i) => (
              <Pill key={i}>{f}</Pill>
            ))}
          </div>
        </div>
        {shown ? (
          <Window {...shown} t={t} />
        ) : (
          <Mark size={220} color={C.border} />
        )}
      </div>
    </Page>
  )
}

/** The card for a link whose lesson has expired. */
export function expiredImage() {
  return respond(
    <Page>
      <Header />
      <div style={{ ...row, flex: 1, gap: 56 }}>
        <div style={{ ...column, flex: 1 }}>
          <Headline
            title="This lesson has expired"
            text="Lessons last 7 days. Ask for a fresh link."
          />
        </div>
        <Mark size={220} color={C.border} />
      </div>
    </Page>
  )
}
