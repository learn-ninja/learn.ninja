"use client"

import * as React from "react"

import type {
  ChartVisual,
  ChessVisual,
  DiagramVisual,
  MapVisual,
  MoleculeVisual,
  Visual as VisualSpec,
} from "@workspace/spec"
import { Selectable } from "@workspace/ui/components/selectable"
import { cn } from "@workspace/ui/lib/utils"

import type { Mark } from "@workspace/player-core/check"

import { ChatBlock, type ChatTurn } from "./chat"
import { useIsDark, usePlayer } from "./context"
import { markStyles, visualWindow } from "./controls"
import { countryName } from "@workspace/player-core/country-names"
import { inStyle, VISUAL_CSP } from "@workspace/player-core/visual-frame"
import { Clock, Fractions, NumberLine } from "./figures"
import { shortcutBlocked } from "./keys"
import {
  chartKey,
  codeKey,
  diagramKey,
  mathKey,
  moleculeKey,
  type CodeLines,
} from "@workspace/player-core/prepared"
import { markSpots, SPOT_CSS } from "./spots"

/** Hotspot wiring for interactive visuals: which regions are selected or marked, and what a tap does. */
export interface HotspotControl {
  selected: string[]
  marks: Record<string, Mark>
  onToggle: (id: string) => void
  disabled: boolean
}

export function Visual({
  visual,
  hotspots,
  turns,
  label,
  plain = false,
}: {
  visual: VisualSpec
  hotspots?: HotspotControl
  /** On a chat, turns the player adds after the lesson's own: a scenario's pick and its reply. */
  turns?: ChatTurn[]
  label?: string
  /** No box of its own: the visual sits on a surface that already frames it, like an option card's panel. */
  plain?: boolean
}) {
  if (visual.kind === "html")
    return (
      <HtmlFrame
        html={visual.html}
        alt={visual.alt}
        css={visual.css}
        height={visual.height}
        hotspots={hotspots}
        label={label}
        plain={plain}
      />
    )
  if (visual.kind === "code")
    return (
      <CodeBlock
        code={visual.code}
        language={visual.language}
        highlight={visual.highlight}
        spots={visual.hotspots}
        hotspots={hotspots}
        plain={plain}
      />
    )
  if (visual.kind === "math")
    return <MathBlock tex={visual.tex} plain={plain} />
  if (visual.kind === "diagram")
    return <DiagramBlock diagram={visual} label={label} plain={plain} />
  if (
    visual.kind === "numberline" ||
    visual.kind === "fraction" ||
    visual.kind === "clock"
  )
    return <FigureBlock figure={visual} label={label} plain={plain} />
  if (visual.kind === "chess")
    return (
      <ChessBlock
        board={visual}
        hotspots={hotspots}
        label={label}
        plain={plain}
      />
    )
  if (visual.kind === "map")
    return (
      <MapBlock map={visual} hotspots={hotspots} label={label} plain={plain} />
    )
  if (visual.kind === "molecule")
    return <MoleculeBlock molecule={visual} label={label} plain={plain} />
  if (visual.kind === "chat")
    return <ChatBlock chat={visual} extra={turns} label={label} plain={plain} />
  return <ChartBlock chart={visual} label={label} plain={plain} />
}

// ---------- HTML: a sandboxed iframe with no scripts ----------

/**
 * The frame's sandbox. Only allow-same-origin, so the player can measure the document and find its
 * hotspots. Never add allow-scripts: with both flags, lesson HTML could run code with the site's origin.
 */
export const VISUAL_SANDBOX = "allow-same-origin"

/** The tallest an HTML visual's frame grows, in pixels. */
const MAX_VISUAL_HEIGHT = 2400

export { VISUAL_CSP }

/**
 * The heights HTML visuals measured at, by frame width and document. A frame seen before, or drawn
 * ahead out of sight (VisualsAhead in lesson-player.tsx), starts at its height instead of at 120px
 * and jumping once it has loaded and been measured.
 */
const knownHeights = new Map<string, number>()
/** Enough for every visual in a few lessons at a few widths; past it the map starts over. */
const KNOWN_HEIGHTS_MAX = 500

/**
 * A short key for a visual's document. The document inlines the lesson's stylesheet, so keying by
 * it whole kept a copy of the page per width. A collision only starts a frame at the wrong height,
 * which its first measurement corrects.
 */
function documentKey(doc: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < doc.length; i++) {
    const c = doc.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193)
    b = Math.imul(b ^ c, 0x5bd1e995)
  }
  return `${doc.length}:${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`
}

function rememberHeight(key: string, height: number) {
  if (knownHeights.size >= KNOWN_HEIGHTS_MAX && !knownHeights.has(key))
    knownHeights.clear()
  knownHeights.set(key, height)
}

function HtmlFrame({
  html,
  alt,
  css,
  height,
  hotspots,
  label,
  plain,
}: {
  html: string
  alt?: string
  css?: string
  height?: number
  hotspots?: HotspotControl
  label?: string
  plain: boolean
}) {
  const { visualsCss, dir, prepared, t, keyScope } = usePlayer()
  const dark = useIsDark()
  const ref = React.useRef<HTMLIFrameElement>(null)
  const [measured, setMeasured] = React.useState<number | null>(null)
  const [loaded, setLoaded] = React.useState(0)
  const interactive = Boolean(hotspots)

  // The document is fixed per lesson visual; the theme is applied after load without reloading. Its
  // direction is its own (dir="auto"), like lesson text: the interface's language doesn't mirror it.
  const srcDoc = React.useMemo(
    () =>
      // Without an explicit height the body keeps its natural size, so the player can measure it.
      `<!doctype html><html dir="auto"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${VISUAL_CSP}"><link rel="stylesheet" href="${visualsCss}"><style>${inStyle(prepared.visualsCss)}</style><style>html,body{background:transparent}body{margin:0;padding:16px;display:flex;justify-content:center;align-items:center;box-sizing:border-box${height ? ";min-height:100vh" : ""}}${inStyle(css ?? "")}${interactive ? SPOT_CSS : ""}</style></head><body>${html}</body></html>`,
    [html, css, visualsCss, height, prepared.visualsCss, interactive]
  )
  const docKey = React.useMemo(() => documentKey(srcDoc), [srcDoc])

  // A height known from before, set ahead of the first paint: the frame has its width by now.
  React.useLayoutEffect(() => {
    const width = ref.current?.clientWidth
    if (height || !width) return
    const known = knownHeights.get(`${width}:${docKey}`)
    if (known) setMeasured(known)
  }, [docKey, height])

  // Size the frame to its content. allow-same-origin (without allow-scripts) lets the player measure it.
  // Not before the visual has loaded: the blank document a frame starts with would set a wrong
  // height, over a known one.
  React.useEffect(() => {
    const doc = ref.current?.contentDocument
    if (!loaded || !doc?.body || height) return
    // Capped, so content tied to the frame's own height (which the checker refuses) can't grow it forever.
    const measure = () => {
      const measured = Math.min(
        MAX_VISUAL_HEIGHT,
        Math.ceil(doc.body.getBoundingClientRect().height)
      )
      setMeasured(measured)
      // Remembered for the next frame that shows this visual at this width.
      const width = ref.current?.clientWidth
      if (width && measured > 0) rememberHeight(`${width}:${docKey}`, measured)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(doc.body)
    return () => observer.disconnect()
  }, [loaded, height, docKey])

  // Drawings sit in the middle of their own canvas: a viewBox with empty space on one side would
  // push the drawing off-center however the frame lays it out. Runs before the hotspots are measured.
  React.useEffect(() => {
    const doc = ref.current?.contentDocument
    if (!doc?.body) return
    for (const svg of doc.body.querySelectorAll<SVGSVGElement>("svg")) {
      if (svg.parentElement?.closest("svg")) continue
      const box = svg.viewBox.baseVal
      if (!box || !box.width || !box.height) continue
      const centered = centeredViewBox(box, svg.getBBox())
      if (centered) svg.setAttribute("viewBox", centered)
    }
  }, [loaded])

  React.useEffect(() => {
    const doc = ref.current?.contentDocument
    // Before the srcDoc loads, the frame's document can be empty; this runs again on load.
    if (!doc?.documentElement) return
    doc.documentElement.classList.toggle("dark", dark)
  }, [loaded, dark])

  // Hotspots: Safari won't run event listeners inside a sandbox without allow-scripts, so the taps
  // land on buttons the player lays over each [data-hotspot] element instead. That also keeps focus
  // in the page, so Enter still checks the answer.
  const [spots, setSpots] = React.useState<SpotBox[]>([])
  React.useEffect(() => {
    const doc = ref.current?.contentDocument
    if (!doc?.body || !interactive) return
    const elements = [...doc.querySelectorAll<HTMLElement>("[data-hotspot]")]
    const measure = () =>
      setSpots(
        elements.map((el) => {
          const r = el.getBoundingClientRect()
          return {
            id: el.dataset.hotspot!,
            label:
              el.getAttribute("aria-label") ||
              el.textContent?.trim() ||
              el.dataset.hotspot!,
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          }
        })
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(doc.body)
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [loaded, dark, dir, interactive])

  // Number keys pick the parts, as they pick answer options: 1 for the first part's keycap, 2 for…
  const control = React.useRef(hotspots)
  control.current = hotspots
  const order = spots.map((s) => s.id).join(",")
  React.useEffect(() => {
    if (!interactive || !order) return
    const ids = order.split(",")
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const el = e.target as HTMLElement | null
      if (keyScope && !keyScope.current?.contains(el)) return
      if (shortcutBlocked(e)) return
      const n = Number(e.key)
      const c = control.current
      if (!c || c.disabled || !Number.isInteger(n) || n < 1 || n > ids.length)
        return
      e.preventDefault()
      c.onToggle(ids[n - 1]!)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [interactive, order, keyScope])

  // Every part shows its tile when the kata arrives, and while a finger holds the stage: phones have
  // no hover to find the parts with.
  const [reveal, setReveal] = React.useState(interactive)
  const hold = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    if (!interactive) return
    const timer = setTimeout(() => setReveal(false), 1800)
    return () => clearTimeout(timer)
  }, [interactive])
  const letGo = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
    setReveal(false)
  }

  // What's marked in the frame: the parts picked or checked, and the one the pointer is on.
  const [hovered, setHovered] = React.useState<string | null>(null)
  const lit = new Map<string, "on" | Mark>()
  if (hovered) lit.set(hovered, "on")
  hotspots?.selected.forEach((id) => lit.set(id, "on"))
  Object.entries(hotspots?.marks ?? {}).forEach(([id, m]) => lit.set(id, m))
  const litKey = JSON.stringify([...lit])
  React.useEffect(() => {
    const doc = ref.current?.contentDocument
    if (!doc?.body || !interactive) return
    markSpots(doc, {
      lit: new Map(JSON.parse(litKey) as [string, "on" | Mark][]),
      hint: reveal,
    })
  }, [loaded, interactive, litKey, reveal])

  const picked = hotspots
    ? spots.filter((s) => hotspots.selected.includes(s.id)).map((s) => s.label)
    : []

  const stage = (
    // The frame is inert (nothing inside is read), so the stage itself is what screen readers get: an
    // image named by the alt, or on a hotspot the group of parts to pick.
    <div
      role={interactive ? "group" : "img"}
      aria-label={alt ?? label ?? t.visual}
      onPointerDown={
        interactive
          ? (e) => {
              if (e.pointerType !== "touch") return
              hold.current = setTimeout(() => setReveal(true), 350)
            }
          : undefined
      }
      onPointerUp={interactive ? letGo : undefined}
      onPointerCancel={interactive ? letGo : undefined}
      onPointerLeave={interactive ? letGo : undefined}
      className={cn(
        "visual-stage",
        // Its own window: at least the shared minimum tall, with a short visual in the middle.
        !plain && [visualWindow, "flex flex-col justify-center"],
        interactive
          ? // A hotspot's visual sits on a filled stage: no frame around it, so nothing boxes it twice.
            !plain &&
              "overflow-hidden rounded-2xl bg-muted py-3 select-none dark:bg-input/30"
          : // On the page's own surface, like the lesson around it, with room above and below.
            !plain && "overflow-hidden rounded-xl border bg-background py-6"
      )}
    >
      <div className="relative">
        <iframe
          ref={ref}
          title={alt ?? label ?? t.visual}
          sandbox={VISUAL_SANDBOX}
          srcDoc={srcDoc}
          onLoad={() => setLoaded((n) => n + 1)}
          tabIndex={-1}
          inert
          className="pointer-events-none block w-full border-0"
          style={{ height: height ?? measured ?? 120 }}
        />
        {hotspots
          ? spots.map((spot) => (
              <HotspotButton
                key={spot.id}
                spot={spot}
                control={hotspots}
                onHover={setHovered}
              />
            ))
          : null}
      </div>
    </div>
  )
  if (!hotspots) return stage
  return (
    <div className="flex flex-col gap-3">
      {stage}
      {/* What's picked, in words: confirms the tap, and screen readers hear it. */}
      <p
        aria-live="polite"
        className="min-h-5 truncate text-sm text-muted-foreground"
      >
        {picked.length ? t.picked(picked.join(", ")) : ""}
      </p>
    </div>
  )
}

/** Where a [data-hotspot] element sits inside the frame, measured from the player. */
interface SpotBox {
  id: string
  label: string
  top: number
  left: number
  width: number
  height: number
}

type Box = { x: number; y: number; width: number; height: number }

/**
 * The viewBox that keeps the canvas's size and scale but moves its drawing to the middle, or null when
 * it's already there, empty, or larger than the canvas (moving it would only change what's cut off).
 */
export function centeredViewBox(view: Box, drawing: Box): string | null {
  if (!drawing.width || !drawing.height) return null
  if (drawing.width > view.width || drawing.height > view.height) return null
  const x = drawing.x + drawing.width / 2 - view.width / 2
  const y = drawing.y + drawing.height / 2 - view.height / 2
  const tolerance = Math.max(view.width, view.height) / 200
  if (Math.abs(x - view.x) < tolerance && Math.abs(y - view.y) < tolerance)
    return null
  const round = (n: number) => Math.round(n * 100) / 100
  return [x, y, view.width, view.height].map(round).join(" ")
}

/**
 * A tappable part of a visual: an empty button over the part, since Safari won't run listeners
 * inside the sandbox. The part's look is drawn in the frame (spots.ts).
 */
function HotspotButton({
  spot,
  control,
  onHover,
}: {
  spot: SpotBox
  control: HotspotControl
  onHover: (id: string | null) => void
}) {
  return (
    <Selectable
      aria-label={spot.label}
      isSelected={control.selected.includes(spot.id)}
      onChange={() => control.onToggle(spot.id)}
      onHoverStart={() => onHover(spot.id)}
      onHoverEnd={() => onHover(null)}
      isDisabled={control.disabled}
      data-status={control.marks[spot.id]}
      className="absolute cursor-pointer rounded-md"
      // Measured positions inside the frame, so physical edges are right in both directions.
      style={{
        top: spot.top,
        left: spot.left,
        width: spot.width,
        height: spot.height,
      }}
    />
  )
}

// ---------- code: highlighted on the server, lines tappable for code hotspots ----------

function CodeBlock({
  code,
  language,
  highlight,
  spots,
  hotspots,
  plain,
}: {
  code: string
  language: string
  highlight?: number[]
  spots?: { id: string; line: number }[]
  hotspots?: HotspotControl
  plain: boolean
}) {
  const { prepared } = usePlayer()
  const lines: CodeLines =
    prepared.code[codeKey(language, code)] ??
    code.split("\n").map((l) => [{ content: l }])
  const spotByLine = new Map((spots ?? []).map((s) => [s.line, s.id]))

  return (
    <div
      dir="ltr"
      className={cn(
        "overflow-x-auto text-start",
        !plain && [
          visualWindow,
          "flex flex-col justify-center rounded-xl border bg-muted/40",
        ]
      )}
    >
      {/* On phones a long line wraps under its own start instead of scrolling, so every line (and
          every tappable one in a hotspot) shows whole. */}
      <pre className="m-0 flex flex-col py-3 font-mono text-sm leading-7 sm:min-w-max">
        {lines.map((tokens, i) => {
          const n = i + 1
          const id = hotspots ? spotByLine.get(n) : undefined
          const body = (
            <>
              <span
                aria-hidden="true"
                className="w-6 shrink-0 text-end text-muted-foreground/70 select-none"
              >
                {n}
              </span>
              <span className="min-w-0 wrap-anywhere whitespace-pre-wrap sm:whitespace-pre">
                {tokens.length === 0 ||
                (tokens.length === 1 && tokens[0]!.content === "")
                  ? " "
                  : tokens.map((t, j) => (
                      <span
                        key={j}
                        className="shiki-token"
                        style={t.style as React.CSSProperties}
                      >
                        {t.content}
                      </span>
                    ))}
              </span>
            </>
          )
          const lineClass = cn(
            "flex gap-4 border-s-[3px] border-transparent px-4",
            highlight?.includes(n) && "bg-primary/5"
          )
          if (!id || !hotspots)
            return (
              <span key={n} className={lineClass}>
                {body}
              </span>
            )
          const mark = hotspots.marks[id]
          return (
            <Selectable
              key={n}
              aria-label={`Line ${n}`}
              isSelected={hotspots.selected.includes(id)}
              onChange={() => hotspots.onToggle(id)}
              isDisabled={hotspots.disabled}
              data-status={mark}
              className={cn(
                lineClass,
                "w-full cursor-pointer text-start hover:bg-primary/5 data-selected:border-primary data-selected:bg-primary/10",
                markStyles
              )}
            >
              {body}
            </Selectable>
          )
        })}
      </pre>
    </div>
  )
}

// ---------- math: rendered by KaTeX on the server ----------

// KaTeX's display mode adds 1em above and below the formula; the box's padding is enough. KaTeX's
// stylesheet is unlayered, so it beats Tailwind's utilities layer without the !.
// ---------- Chart: SVG drawn on the server from the lesson's data ----------

/**
 * The server draws charts (prepare.ts) at two sizes: full, and compact for the option and item
 * cards, which show their visuals `plain`. Before it's drawn (a lesson without prepared data),
 * the alt stands in.
 */
function ChartBlock({
  chart,
  label,
  plain,
}: {
  chart: ChartVisual
  label?: string
  plain: boolean
}) {
  const { prepared, t } = usePlayer()
  const alt = chart.alt ?? label ?? t.visual
  const svg = prepared.charts?.[chartKey(chart, plain)]
  return (
    <div
      role="img"
      aria-label={alt}
      dir="ltr"
      className={cn(
        "flex justify-center overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full",
        !plain && [
          visualWindow,
          "items-center rounded-xl border bg-background px-4 py-6",
        ]
      )}
    >
      {svg ? (
        <div
          className={cn("w-full", plain ? "max-w-xs" : "max-w-[480px]")}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {alt}
        </p>
      )}
    </div>
  )
}

// ---------- Diagram: laid out and drawn by D2 on the server ----------

/**
 * The server draws the D2 into SVG in theme tokens (diagram.ts). It goes in the same sandboxed
 * frame as HTML visuals, since D2's Markdown labels can carry HTML. Before it's drawn (a lesson
 * without prepared data), the alt stands in.
 */
function DiagramBlock({
  diagram,
  label,
  plain,
}: {
  diagram: DiagramVisual
  label?: string
  plain: boolean
}) {
  const { prepared, t } = usePlayer()
  const svg = prepared.diagrams?.[diagramKey(diagram.d2)]
  if (svg)
    return (
      <HtmlFrame html={svg} alt={diagram.alt} label={label} plain={plain} />
    )
  return (
    <div
      role="img"
      aria-label={diagram.alt ?? label ?? t.visual}
      className={cn(
        !plain && [
          visualWindow,
          "flex items-center justify-center rounded-xl border bg-background",
        ]
      )}
    >
      <p className="px-4 py-6 text-center text-sm text-muted-foreground">
        {diagram.alt ?? label ?? t.visual}
      </p>
    </div>
  )
}

// ---------- Chess: a position drawn from its FEN ----------

// The pieces are most of the board's code, so a lesson without a board never loads them.
const ChessBoard = React.lazy(() => import("./chess"))

function ChessBlock({
  board,
  hotspots,
  label,
  plain,
}: {
  board: ChessVisual
  hotspots?: HotspotControl
  label?: string
  plain: boolean
}) {
  return (
    <TappableStage
      alt={board.alt ?? label}
      hotspots={hotspots}
      plain={plain}
      name={(square) => square}
    >
      <div
        className={cn("aspect-square w-full", plain ? "max-w-40" : "max-w-sm")}
      >
        <React.Suspense
          fallback={<div className="size-full rounded-md bg-muted" />}
        >
          <ChessBoard board={board} plain={plain} hotspots={hotspots} />
        </React.Suspense>
      </div>
    </TappableStage>
  )
}

/**
 * A drawing whose every part can be tapped on a hotspot (a board's squares, a map's countries).
 * There it's a group named by its alt on a filled stage, like an HTML hotspot's visual, with the
 * parts picked named under it: that confirms the tap, and screen readers hear it. Elsewhere it's an
 * image in a framed box.
 */
function TappableStage({
  alt,
  hotspots,
  plain,
  name,
  children,
}: {
  alt?: string
  hotspots?: HotspotControl
  plain: boolean
  /** A picked part's name, from its id. */
  name: (id: string) => string
  children: React.ReactNode
}) {
  const { t } = usePlayer()
  const block = (
    <div
      role={hotspots ? "group" : "img"}
      aria-label={alt ?? t.visual}
      dir="ltr"
      className={cn(
        "flex justify-center",
        !plain && [
          visualWindow,
          "items-center",
          hotspots
            ? "rounded-2xl bg-muted px-4 py-6 dark:bg-input/30"
            : "rounded-xl border bg-background px-4 py-6",
        ]
      )}
    >
      {children}
    </div>
  )
  if (!hotspots) return block
  return (
    <div className="flex flex-col gap-3">
      {block}
      <p
        aria-live="polite"
        className="min-h-5 truncate text-sm text-muted-foreground"
      >
        {hotspots.selected.length
          ? t.picked(hotspots.selected.map(name).join(", "))
          : ""}
      </p>
    </div>
  )
}

// ---------- Figures: number lines, fractions, and clocks ----------

type Figure = Extract<VisualSpec, { kind: "numberline" | "fraction" | "clock" }>

/** A small math figure, drawn here from its numbers (figures.tsx), in the box charts use. */
function FigureBlock({
  figure,
  label,
  plain,
}: {
  figure: Figure
  label?: string
  plain: boolean
}) {
  const { t } = usePlayer()
  // A clock and a row of circles are narrower than a line or a wall of bars.
  const width =
    figure.kind === "clock"
      ? plain
        ? "max-w-32"
        : "max-w-60"
      : figure.kind === "fraction" && figure.shape === "circle"
        ? plain
          ? "max-w-xs"
          : ["max-w-40", "max-w-80", "max-w-md", "max-w-xl"][
              figure.fractions.length - 1
            ]
        : plain
          ? "max-w-xs"
          : "max-w-[480px]"
  return (
    <div
      role="img"
      aria-label={figure.alt ?? label ?? t.visual}
      dir="ltr"
      className={cn(
        "flex justify-center",
        !plain && [
          visualWindow,
          "items-center rounded-xl border bg-background px-4 py-6",
        ]
      )}
    >
      <div className={cn("w-full", width)}>
        {figure.kind === "numberline" ? (
          <NumberLine line={figure} />
        ) : figure.kind === "fraction" ? (
          <Fractions figure={figure} />
        ) : (
          <Clock clock={figure} />
        )}
      </div>
    </div>
  )
}

// ---------- Maps: countries shaded and places marked ----------

// The country shapes are most of the map's code, so a lesson without a map never loads them.
const WorldMap = React.lazy(() => import("./map"))

function MapBlock({
  map,
  hotspots,
  label,
  plain,
}: {
  map: MapVisual
  hotspots?: HotspotControl
  label?: string
  plain: boolean
}) {
  const { lang } = usePlayer()
  return (
    <TappableStage
      alt={map.alt ?? label}
      hotspots={hotspots}
      plain={plain}
      name={(code) => countryName(code, lang)}
    >
      <div className={cn("w-full", plain && "max-w-xs")}>
        <React.Suspense
          fallback={<div className="aspect-[2/1] w-full rounded-md bg-muted" />}
        >
          <WorldMap map={map} plain={plain} hotspots={hotspots} />
        </React.Suspense>
      </div>
    </TappableStage>
  )
}

// ---------- Molecules: drawn by OpenChemLib on the server ----------

/**
 * The server lays out and draws the molecule from its SMILES in theme tokens (molecule.ts), at one
 * scale for every molecule, so water stays small beside caffeine; a wide one shrinks to fit. Before
 * it's drawn (a lesson without prepared data), the alt stands in.
 */
function MoleculeBlock({
  molecule,
  label,
  plain,
}: {
  molecule: MoleculeVisual
  label?: string
  plain: boolean
}) {
  const { prepared, t } = usePlayer()
  const alt = molecule.alt ?? label ?? t.visual
  const svg = prepared.molecules?.[moleculeKey(molecule)]
  return (
    <div
      role="img"
      aria-label={alt}
      dir="ltr"
      className={cn(
        "flex justify-center [&_svg]:h-auto [&_svg]:max-w-full",
        !plain && [
          visualWindow,
          "items-center rounded-xl border bg-background px-4 py-6",
        ]
      )}
    >
      {svg ? (
        <div
          className={cn("flex w-full justify-center", plain && "max-w-xs")}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {alt}
        </p>
      )}
    </div>
  )
}

function MathBlock({ tex, plain }: { tex: string; plain: boolean }) {
  const { prepared } = usePlayer()
  const html = prepared.math[mathKey(tex, true)]
  return (
    <div
      dir="ltr"
      className={cn(
        "flex justify-center overflow-x-auto px-4 py-6 text-xl [&_.katex-display]:m-0!",
        !plain && [visualWindow, "items-center rounded-xl border bg-muted/40"]
      )}
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <code>{tex}</code>
      )}
    </div>
  )
}
