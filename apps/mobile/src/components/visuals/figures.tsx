import { useState } from "react"
import { View } from "react-native"
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from "react-native-svg"

import {
  fractionStep,
  type ClockVisual,
  type FractionVisual,
  type NumberLineVisual,
} from "@workspace/spec"

import { cn } from "@/lib/utils"
import { colors } from "../../../tokens"

// Small math figures drawn from a few numbers, as the web's figures.tsx draws them: a number
// line, fractions as shaded parts, and a clock face, in the theme's colors.

const INK = colors.foreground
const MUTED = colors.muted.foreground
const PAPER = colors.background
const MARK = colors.chart[2]

/** A number as a label: no float noise (0.30000000000000004), and a real minus sign. */
const num = (v: number) => String(+v.toFixed(10)).replace("-", "−")

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** A value as a fraction in lowest terms over n ("3/4", "1", "−5/4"). */
const fraction = (v: number, n: number) => {
  const top = Math.round(v * n)
  const d = gcd(Math.abs(top), n) || 1
  return d === n ? num(top / n) : `${num(top / d)}/${n / d}`
}

/** A drawing scaled to its container's width, keeping its aspect, no wider than `maxWidth`. */
function Fit({
  viewWidth,
  viewHeight,
  maxWidth,
  className,
  children,
}: {
  viewWidth: number
  viewHeight: number
  maxWidth: number
  className?: string
  children: React.ReactNode
}) {
  const [laidOut, setLaidOut] = useState(0)
  const width = Math.min(maxWidth, laidOut || maxWidth)
  return (
    <View
      className={cn("w-full items-center", className)}
      onLayout={(e) => setLaidOut(e.nativeEvent.layout.width)}
    >
      <Svg
        width={width}
        height={(width / viewWidth) * viewHeight}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      >
        {children}
      </Svg>
    </View>
  )
}

// ---------- number line ----------

// Drawn narrower than it shows on a desktop (480px), so its numbers stay readable on a phone.
const LINE_WIDTH = 400
const PAD = 28
/** How far the line runs past its first and last tick, to its arrowheads. */
const OVERHANG = 16

export function NumberLine({
  line,
  maxWidth,
}: {
  line: NumberLineVisual
  maxWidth: number
}) {
  const { min, max } = line
  const n = line.fractions ? fractionStep(line.step ?? 1) : undefined
  // A fraction step written as a decimal (0.333) is placed at exactly 1/n, so the ticks don't drift.
  const step = n ? 1 / n : (line.step ?? 1)
  const tickLabel = (v: number) => (n ? fraction(v, n) : num(v))
  const at = (v: number) =>
    PAD + ((v - min) / (max - min)) * (LINE_WIDTH - 2 * PAD)
  const ticks = Array.from(
    { length: Math.floor((max - min) / step + 1e-9) + 1 },
    (_, k) => min + k * step
  )
  // A jump that overlaps an earlier one arcs higher than it, so neither hides the other or its label.
  const levels: number[] = []
  const jumps = (line.jumps ?? []).map((j, i, all) => {
    const lo = Math.min(j.from, j.to)
    const hi = Math.max(j.from, j.to)
    const under = all
      .slice(0, i)
      .flatMap((e, k) =>
        Math.min(e.from, e.to) < hi && Math.max(e.from, e.to) > lo
          ? [levels[k]!]
          : []
      )
    levels.push(under.length ? Math.max(...under) + 1 : 0)
    const span = Math.abs(at(j.to) - at(j.from))
    return {
      ...j,
      height: Math.min(Math.max(span * 0.35, 22), 48) + levels[i]! * 26,
    }
  })
  const arcRoom = jumps.length
    ? Math.max(...jumps.map((j) => j.height)) + 24
    : 0
  const labelled = line.points?.some((p) => p.label) ?? false
  const labelsBelow = labelled && jumps.length > 0
  const y = arcRoom + (labelled && !labelsBelow ? 26 : 12) + 4
  const height = y + (labelsBelow ? 58 : 36)
  const ends = { start: at(min) - OVERHANG, end: at(max) + OVERHANG }

  return (
    <Fit viewWidth={LINE_WIDTH} viewHeight={height} maxWidth={maxWidth}>
      {(line.ranges ?? []).map((r, i) => {
        const x1 = r.from === undefined ? ends.start : at(r.from)
        const x2 = r.to === undefined ? ends.end : at(r.to)
        return (
          <G key={`r${i}`}>
            <Line
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke={MARK}
              strokeWidth={6}
              opacity={0.85}
            />
            {r.from === undefined && <Head x={x1} y={y} dir={-1} fill={MARK} />}
            {r.to === undefined && <Head x={x2} y={y} dir={1} fill={MARK} />}
          </G>
        )
      })}
      <Line
        x1={ends.start}
        y1={y}
        x2={ends.end}
        y2={y}
        stroke={INK}
        strokeWidth={1.5}
      />
      <Head x={ends.start} y={y} dir={-1} fill={INK} />
      <Head x={ends.end} y={y} dir={1} fill={INK} />
      {ticks.map((v) => (
        <G key={v}>
          <Line
            x1={at(v)}
            y1={y - 6}
            x2={at(v)}
            y2={y + 6}
            stroke={INK}
            strokeWidth={1.5}
          />
          <SvgText
            x={at(v)}
            y={y + 27}
            textAnchor="middle"
            fontSize={14}
            fill={MUTED}
          >
            {tickLabel(v)}
          </SvgText>
        </G>
      ))}
      {(line.ranges ?? []).flatMap((r, i) =>
        (
          [
            [r.from, r.fromOpen],
            [r.to, r.toOpen],
          ] as const
        ).flatMap(([v, open], k) =>
          v === undefined
            ? []
            : [
                <Dot
                  key={`r${i}${k}`}
                  x={at(v)}
                  y={y}
                  open={open}
                  color={MARK}
                />,
              ]
        )
      )}
      {jumps.map((j, i) => (
        <Jump
          key={`j${i}`}
          x1={at(j.from)}
          x2={at(j.to)}
          y={y}
          height={j.height}
          label={j.label}
        />
      ))}
      {(line.points ?? []).map((p, i) => (
        <G key={`p${i}`}>
          <Dot x={at(p.value)} y={y} open={p.open} color={INK} />
          {p.label && (
            <SvgText
              x={at(p.value)}
              y={labelsBelow ? y + 50 : y - 14}
              textAnchor="middle"
              fontSize={14}
              fontWeight="600"
              fill={INK}
            >
              {p.label}
            </SvgText>
          )}
        </G>
      ))}
    </Fit>
  )
}

/** An arrowhead at the end of a line, pointing toward the end (dir 1) or the start (dir -1). */
function Head({
  x,
  y,
  dir,
  fill,
}: {
  x: number
  y: number
  dir: 1 | -1
  fill: string
}) {
  return (
    <Polygon
      points={`${x + dir * 8},${y} ${x - dir * 2},${y - 5} ${x - dir * 2},${y + 5}`}
      fill={fill}
    />
  )
}

/** A value on the line: a filled dot, or a ring for a value left out. */
function Dot({
  x,
  y,
  open,
  color,
}: {
  x: number
  y: number
  open?: boolean
  color: string
}) {
  return (
    <Circle
      cx={x}
      cy={y}
      r={6}
      fill={open ? PAPER : color}
      stroke={color}
      strokeWidth={open ? 2.5 : 0}
    />
  )
}

/** A hop over the line from one value to another, with its head where it lands and its label on top. */
function Jump({
  x1,
  x2,
  y,
  height,
  label,
}: {
  x1: number
  x2: number
  y: number
  height: number
  label?: string
}) {
  const base = y - 5
  const mid = (x1 + x2) / 2
  const control = base - 2 * height
  const dx = x2 - mid
  const dy = base - control
  const length = Math.hypot(dx, dy)
  const ux = dx / length
  const uy = dy / length
  const back = { x: x2 - ux * 9, y: base - uy * 9 }
  return (
    <G>
      <Path
        d={`M ${x1} ${base} Q ${mid} ${control} ${back.x} ${back.y}`}
        fill="none"
        stroke={MARK}
        strokeWidth={2}
      />
      <Polygon
        points={`${x2},${base} ${back.x - uy * 5},${back.y + ux * 5} ${back.x + uy * 5},${back.y - ux * 5}`}
        fill={MARK}
      />
      {label && (
        <SvgText
          x={mid}
          y={base - height - 8}
          textAnchor="middle"
          fontSize={13}
          fontWeight="600"
          fill={MARK}
        >
          {label}
        </SvgText>
      )}
    </G>
  )
}

// ---------- fractions ----------

const BAR = { width: 400, label: 60, height: 36, gap: 12 }
const PIE = { size: 150, radius: 62, label: 56 }

export function Fractions({
  figure,
  maxWidth,
}: {
  figure: FractionVisual
  maxWidth: number
}) {
  return figure.shape === "circle" ? (
    <FractionCircles fractions={figure.fractions} maxWidth={maxWidth} />
  ) : (
    <FractionBars fractions={figure.fractions} maxWidth={maxWidth} />
  )
}

type Fraction = FractionVisual["fractions"][number]

/** Bars of one length stacked like a fraction wall, each cut into its parts, its label at the start. */
function FractionBars({
  fractions,
  maxWidth,
}: {
  fractions: Fraction[]
  maxWidth: number
}) {
  const length = BAR.width - BAR.label - 4
  const height =
    fractions.length * BAR.height + (fractions.length - 1) * BAR.gap + 4
  return (
    <Fit viewWidth={BAR.width} viewHeight={height} maxWidth={maxWidth}>
      {fractions.map((f, i) => {
        const top = 2 + i * (BAR.height + BAR.gap)
        const part = length / f.parts
        return (
          <G key={i}>
            <FractionLabel
              f={f}
              x={BAR.label / 2 - 4}
              y={top + BAR.height / 2}
            />
            {Array.from({ length: f.parts }, (_, k) => (
              <Rect
                key={k}
                x={BAR.label + k * part}
                y={top}
                width={part}
                height={BAR.height}
                fill={k < f.shaded ? MARK : PAPER}
                stroke={INK}
                strokeWidth={1.5}
              />
            ))}
          </G>
        )
      })}
    </Fit>
  )
}

/** Circles side by side, each cut into equal slices from the top, clockwise, its label under it. */
function FractionCircles({
  fractions,
  maxWidth,
}: {
  fractions: Fraction[]
  maxWidth: number
}) {
  const width = fractions.length * PIE.size
  const r = PIE.radius
  return (
    <Fit
      viewWidth={width}
      viewHeight={PIE.size + PIE.label}
      maxWidth={maxWidth}
    >
      {fractions.map((f, i) => {
        const cx = i * PIE.size + PIE.size / 2
        const cy = PIE.size / 2
        const point = (k: number) => {
          const a = (k / f.parts) * 2 * Math.PI - Math.PI / 2
          return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
        }
        return (
          <G key={i}>
            {f.parts === 1 ? (
              <Circle
                cx={cx}
                cy={cy}
                r={r}
                fill={f.shaded ? MARK : PAPER}
                stroke={INK}
                strokeWidth={1.5}
              />
            ) : (
              Array.from({ length: f.parts }, (_, k) => {
                const a = point(k)
                const b = point(k + 1)
                return (
                  <Path
                    key={k}
                    d={`M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y} Z`}
                    fill={k < f.shaded ? MARK : PAPER}
                    stroke={INK}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                )
              })
            )}
            <FractionLabel f={f} x={cx} y={PIE.size + PIE.label / 2 - 4} />
          </G>
        )
      })}
    </Fit>
  )
}

/** The fraction's own label, or shaded over parts stacked with a bar between them. */
function FractionLabel({ f, x, y }: { f: Fraction; x: number; y: number }) {
  if (f.label)
    return (
      <SvgText
        x={x}
        y={y}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize={16}
        fontWeight="600"
        fill={INK}
      >
        {f.label}
      </SvgText>
    )
  return (
    <G>
      <SvgText
        x={x}
        y={y - 4}
        textAnchor="middle"
        fontSize={15}
        fontWeight="600"
        fill={INK}
      >
        {f.shaded}
      </SvgText>
      <Line
        x1={x - 11}
        y1={y}
        x2={x + 11}
        y2={y}
        stroke={INK}
        strokeWidth={1.5}
      />
      <SvgText
        x={x}
        y={y + 16}
        textAnchor="middle"
        fontSize={15}
        fontWeight="600"
        fill={INK}
      >
        {f.parts}
      </SvgText>
    </G>
  )
}

// ---------- clock ----------

export function Clock({
  clock,
  maxWidth,
}: {
  clock: ClockVisual
  maxWidth: number
}) {
  const [h, m] = clock.time.split(":").map(Number) as [number, number]
  const c = 120
  const r = 108
  // Angles clockwise from 12, in degrees: the hour hand creeps on as the minutes pass.
  const hourAngle = ((h % 12) + m / 60) * 30
  const minuteAngle = m * 6
  const at = (deg: number, length: number) => {
    const a = (deg * Math.PI) / 180
    return { x: c + length * Math.sin(a), y: c - length * Math.cos(a) }
  }
  const hand = (deg: number, length: number) => {
    const tip = at(deg, length)
    const tail = at(deg + 180, 12)
    return { x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y }
  }
  return (
    <Fit viewWidth={240} viewHeight={240} maxWidth={maxWidth}>
      <Circle cx={c} cy={c} r={r} fill={PAPER} stroke={INK} strokeWidth={3} />
      {Array.from({ length: 60 }, (_, k) => {
        const hour = k % 5 === 0
        const outer = at(k * 6, r - 6)
        const inner = at(k * 6, r - (hour ? 18 : 12))
        return (
          <Line
            key={k}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={hour ? INK : MUTED}
            strokeWidth={hour ? 3 : 1.5}
            strokeLinecap="round"
          />
        )
      })}
      {(clock.numbers ?? true) &&
        Array.from({ length: 12 }, (_, k) => {
          const p = at((k + 1) * 30, r - 32)
          return (
            <SvgText
              key={k}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              alignmentBaseline="central"
              fontSize={19}
              fontWeight="600"
              fill={INK}
            >
              {k + 1}
            </SvgText>
          )
        })}
      <Line
        {...hand(hourAngle, 44)}
        stroke={INK}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <Line
        {...hand(minuteAngle, 64)}
        stroke={MARK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <Circle cx={c} cy={c} r={6} fill={INK} />
    </Fit>
  )
}
