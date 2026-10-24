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

import type { Mark } from "./check"
import { useIsDark, usePlayer } from "./context"
import { markStyles } from "./controls"
import { countryName } from "./country-names"
import { Clock, Fractions, NumberLine } from "./figures"
import {
  chartKey,
  codeKey,
  diagramKey,
  mathKey,
  moleculeKey,
  type CodeLines,
} from "./prepared"

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
  label,
  plain = false,
}: {
  visual: VisualSpec
  hotspots?: HotspotControl
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
  return <ChartBlock chart={visual} label={label} plain={plain} />
}

// ---------- HTML: a sandboxed iframe with no scripts ----------

/**
 * The frame's sandbox. Only allow-same-origin, so the player can measure the document and find its
 * hotspots. Never add allow-scripts: with both flags, lesson HTML could run code with the site's origin.
 */
export const VISUAL_SANDBOX = "allow-same-origin"

/** Keeps CSS inside its <style>: "</" would otherwise end the tag and inject markup. A CSS "\/" still means "/". */
const inStyle = (css: string) => css.replace(/<\//g, "<\\/")

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
  const hotspotsRef = React.useRef(hotspots)
  hotspotsRef.current = hotspots

  // The document is fixed per lesson visual; theme and direction are applied after load without reloading.
  const srcDoc = React.useMemo(
    () =>
      // Without an explicit height the body keeps its natural size, so the player can measure it.
      `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${visualsCss}"><style>${inStyle(prepared.visualsCss)}</style><style>html,body{background:transparent}body{margin:0;padding:16px;display:flex;justify-content:center;align-items:center;box-sizing:border-box${height ? ";min-height:100vh" : ""}}${inStyle(css ?? "")}</style></head><body>${html}</body></html>`,
    [html, css, visualsCss, height, prepared.visualsCss]
  )

  // Size the frame to its content. allow-same-origin (without allow-scripts) lets the player measure it.
  React.useEffect(() => {
    const doc = ref.current?.contentDocument
    if (!doc?.body || height) return
    const measure = () =>
      setMeasured(Math.ceil(doc.body.getBoundingClientRect().height))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(doc.body)
    return () => observer.disconnect()
  }, [loaded, height])

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
    doc.documentElement.dir = dir
  }, [loaded, dark, dir])

  // Hotspots: Safari won't run event listeners inside a sandbox without allow-scripts, so the taps
  // land on buttons the player lays over each [data-hotspot] element instead. That also keeps focus
  // in the page, so Enter still checks the answer.
  const interactive = Boolean(hotspots)
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
            radius: getComputedStyle(el).borderRadius,
            frame: frameInset(el),
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
      if (el?.closest("input, textarea, select, [contenteditable=true]")) return
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

  // The tappable parts' corners show when the brick arrives, then while the pointer is over the
  // stage, or while a finger holds it (phones have no hover).
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
  const picked = hotspots
    ? spots.filter((s) => hotspots.selected.includes(s.id)).map((s) => s.label)
    : []

  const stage = (
    // The frame is inert (nothing inside is read), so the stage itself is the image screen readers get.
    <div
      role={interactive ? undefined : "img"}
      aria-label={interactive ? undefined : (alt ?? label ?? t.visual)}
      data-reveal={(interactive && reveal) || undefined}
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
        interactive
          ? // A hotspot's visual sits on a filled stage: no frame around it, so nothing boxes it twice.
            !plain &&
              "group/stage overflow-hidden rounded-2xl bg-muted py-3 select-none dark:bg-input/30"
          : // On the page's own surface, like the lesson around it, with room above and below.
            !plain && "overflow-hidden rounded-xl border bg-background py-6"
      )}
      inert={!interactive}
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
              <HotspotButton key={spot.id} spot={spot} control={hotspots} />
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
  radius: string
  /** How far in from the box its corners and ring sit (see frameInset). */
  frame: { top: number; right: number; bottom: number; left: number }
}

/**
 * Where to frame a tappable part. A small control (a pill, a button) is framed just outside its own
 * box, but a block with roomy padding, like a card's full-width header, is framed around its content:
 * its box runs to the card's edges, and a frame outside it would sit outside the card. The whole box
 * stays the tap target either way.
 */
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

function frameInset(el: HTMLElement) {
  const cs = getComputedStyle(el)
  const side = (padding: string, border: string) => {
    const p = parseFloat(padding) || 0
    return p >= 12 ? p + (parseFloat(border) || 0) : 0
  }
  return {
    top: side(cs.paddingTop, cs.borderTopWidth),
    right: side(cs.paddingRight, cs.borderRightWidth),
    bottom: side(cs.paddingBottom, cs.borderBottomWidth),
    left: side(cs.paddingLeft, cs.borderLeftWidth),
  }
}

/**
 * A tappable part of a visual, marked by four small corners like a viewfinder. They show when the
 * brick arrives, while the pointer is over the stage, or while a finger holds it, so the visual stays
 * clean the rest of the time. Picking a part closes them into one rounded ring that stands off the
 * part, whatever its own corners.
 */
function HotspotButton({
  spot,
  control,
}: {
  spot: SpotBox
  control: HotspotControl
}) {
  const mark = control.marks[spot.id]
  const selected = control.selected.includes(spot.id)
  const radius = Math.max(parseFloat(spot.radius) || 0, 8)
  const { frame } = spot
  return (
    <Selectable
      aria-label={spot.label}
      isSelected={selected}
      onChange={() => control.onToggle(spot.id)}
      isDisabled={control.disabled}
      data-status={mark}
      className="group/spot absolute cursor-pointer rounded-lg"
      // Measured positions inside the frame, so physical edges are right in both directions.
      style={{
        top: spot.top,
        left: spot.left,
        width: spot.width,
        height: spot.height,
      }}
    >
      {/* The frame: the ring when picked, the corners otherwise. Physical sides, like the box. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute outline-2 outline-offset-4 transition-[outline-color] outline-solid",
          mark === "correct"
            ? "outline-green-600"
            : mark === "wrong"
              ? "outline-yellow-500"
              : selected
                ? "outline-primary"
                : "outline-transparent"
        )}
        style={{
          top: frame.top,
          right: frame.right,
          bottom: frame.bottom,
          left: frame.left,
          borderRadius: frame.top || frame.left ? 8 : radius,
        }}
      >
        {!selected && !mark && !control.disabled
          ? CORNERS.map((corner) => (
              <span
                key={corner}
                className={cn(
                  "absolute size-2.5 border-muted-foreground opacity-0 transition-[opacity,border-color] duration-200 motion-reduce:transition-none",
                  // Touch screens have no hover to hint with, so there the corners stay on.
                  "group-hover/spot:border-foreground group-data-reveal/stage:opacity-100 pointer-coarse:opacity-100 pointer-fine:group-hover/stage:opacity-100",
                  corner
                )}
              />
            ))
          : null}
      </span>
    </Selectable>
  )
}

/** The four corners of the viewfinder, just outside the part's box. */
const CORNERS = [
  "-start-1.5 -top-1.5 rounded-ss-sm border-s-2 border-t-2",
  "-end-1.5 -top-1.5 rounded-se-sm border-e-2 border-t-2",
  "-start-1.5 -bottom-1.5 rounded-es-sm border-s-2 border-b-2",
  "-end-1.5 -bottom-1.5 rounded-ee-sm border-e-2 border-b-2",
]

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
        !plain && "rounded-xl border bg-muted/40"
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
        !plain && "rounded-xl border bg-background px-4 py-6"
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
      className={cn(!plain && "rounded-xl border bg-background")}
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
        !plain &&
          (hotspots
            ? "rounded-2xl bg-muted px-4 py-6 dark:bg-input/30"
            : "rounded-xl border bg-background px-4 py-6")
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
        !plain && "rounded-xl border bg-background px-4 py-6"
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
        !plain && "rounded-xl border bg-background px-4 py-6"
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
        !plain && "rounded-xl border bg-muted/40"
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
