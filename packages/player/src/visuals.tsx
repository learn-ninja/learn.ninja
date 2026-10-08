"use client"

import * as React from "react"

import type { Visual as VisualSpec } from "@workspace/spec"
import { Selectable } from "@workspace/ui/components/selectable"
import { cn } from "@workspace/ui/lib/utils"

import type { Mark } from "./check"
import { useIsDark, usePlayer } from "./context"
import { codeKey, mathKey, type CodeLines } from "./prepared"

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
}: {
  visual: VisualSpec
  hotspots?: HotspotControl
  label?: string
}) {
  if (visual.kind === "html")
    return (
      <HtmlFrame
        html={visual.html}
        css={visual.css}
        height={visual.height}
        hotspots={hotspots}
        label={label}
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
      />
    )
  return <MathBlock tex={visual.tex} />
}

// ---------- HTML: a sandboxed iframe with no scripts ----------

function HtmlFrame({
  html,
  css,
  height,
  hotspots,
  label,
}: {
  html: string
  css?: string
  height?: number
  hotspots?: HotspotControl
  label?: string
}) {
  const { visualsCss, dir, prepared } = usePlayer()
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
      `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${visualsCss}"><style>${prepared.visualsCss}</style><style>html,body{background:transparent}body{margin:0;padding:16px;display:flex;justify-content:center;align-items:center;box-sizing:border-box${height ? ";min-height:100vh" : ""}}${css ?? ""}</style></head><body>${html}</body></html>`,
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
          }
        })
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(doc.body)
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [loaded, dark, dir, interactive])

  return (
    <div
      className="visual-stage overflow-hidden rounded-xl border bg-muted/40 bg-[radial-gradient(var(--border)_1px,transparent_1.2px)] [background-size:16px_16px]"
      inert={!interactive}
    >
      <div className="relative">
        <iframe
          ref={ref}
          title={label ?? "Example"}
          sandbox="allow-same-origin"
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
}

function HotspotButton({
  spot,
  control,
}: {
  spot: SpotBox
  control: HotspotControl
}) {
  const mark = control.marks[spot.id]
  const selected = control.selected.includes(spot.id)
  return (
    <Selectable
      aria-label={spot.label}
      isSelected={selected}
      onChange={() => control.onToggle(spot.id)}
      isDisabled={control.disabled}
      data-status={mark}
      className={cn(
        "absolute cursor-pointer outline-2 outline-offset-4 transition-[outline-color] outline-solid",
        mark === "correct"
          ? "outline-green-600"
          : mark === "wrong"
            ? "outline-yellow-500"
            : selected
              ? "outline-primary"
              : "outline-transparent",
        !mark &&
          !selected &&
          !control.disabled &&
          "hover:outline-ring hover:outline-dashed"
      )}
      // Measured positions inside the frame, so physical edges are right in both directions.
      style={{
        top: spot.top,
        left: spot.left,
        width: spot.width,
        height: spot.height,
        borderRadius: spot.radius,
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
}: {
  code: string
  language: string
  highlight?: number[]
  spots?: { id: string; line: number }[]
  hotspots?: HotspotControl
}) {
  const { prepared } = usePlayer()
  const lines: CodeLines =
    prepared.code[codeKey(language, code)] ??
    code.split("\n").map((l) => [{ content: l }])
  const spotByLine = new Map((spots ?? []).map((s) => [s.line, s.id]))

  return (
    <div
      dir="ltr"
      className="overflow-x-auto rounded-xl border bg-muted/40 text-start"
    >
      <pre className="m-0 flex min-w-max flex-col py-3 font-mono text-sm leading-7">
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
              <span className="whitespace-pre">
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
                "data-[status=correct]:border-green-600 data-[status=correct]:bg-green-600/10 data-[status=wrong]:border-yellow-500 data-[status=wrong]:bg-yellow-500/10"
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

function MathBlock({ tex }: { tex: string }) {
  const { prepared } = usePlayer()
  const html = prepared.math[mathKey(tex, true)]
  return (
    <div
      dir="ltr"
      className="flex justify-center overflow-x-auto rounded-xl border bg-muted/40 px-4 py-5 text-lg"
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <code>{tex}</code>
      )}
    </div>
  )
}
