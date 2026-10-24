import {
  fractionStep,
  type ClockVisual,
  type FractionVisual,
  type NumberLineVisual,
} from "@workspace/spec"

// Small math figures drawn as SVG from a few numbers: a number line, fractions as shaded parts,
// and a clock face. They're laid out here, not by the lesson, so the ticks line up, the parts are
// equal, and the hands point where the time says. Colors are the theme's tokens, so one drawing
// serves light and dark.

const INK = "var(--foreground)"
const MUTED = "var(--muted-foreground)"
const PAPER = "var(--background)"
const MARK = "var(--chart-2)"

const text = { style: { fontFamily: "inherit" } } as const

/** A number as a label: no float noise (0.30000000000000004), and a real minus sign. */
const num = (v: number) => String(+v.toFixed(10)).replace("-", "−")

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** A value as a fraction in lowest terms over n ("3/4", "1", "−5/4"). */
const fraction = (v: number, n: number) => {
  const top = Math.round(v * n)
  const d = gcd(Math.abs(top), n) || 1
  return d === n ? num(top / n) : `${num(top / d)}/${n / d}`
}

// ---------- number line ----------

// Drawn narrower than it shows on a desktop (480px), so its numbers stay readable on a phone.
const LINE_WIDTH = 400
const PAD = 28
/** How far the line runs past its first and last tick, to its arrowheads. */
const OVERHANG = 16

export function NumberLine({ line }: { line: NumberLineVisual }) {
  const { min, max } = line
  const step = line.step ?? 1
  const n = line.fractions ? fractionStep(step) : undefined
  const tickLabel = (v: number) => (n ? fraction(v, n) : num(v))
  const at = (v: number) =>
    PAD + ((v - min) / (max - min)) * (LINE_WIDTH - 2 * PAD)
  const ticks = Array.from(
    { length: Math.floor((max - min) / step + 1e-9) + 1 },
    (_, k) => min + k * step
  )
  // A jump that overlaps an earlier one (a hop back over hops forward) arcs higher than it, so
  // neither hides the other or its label.
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
  // Jumps land where a point's label would go, so with jumps the labels sit under the numbers.
  const labelled = line.points?.some((p) => p.label) ?? false
  const labelsBelow = labelled && jumps.length > 0
  const y = arcRoom + (labelled && !labelsBelow ? 26 : 12) + 4
  const height = y + (labelsBelow ? 58 : 36)
  const ends = { start: at(min) - OVERHANG, end: at(max) + OVERHANG }

  return (
    <svg
      viewBox={`0 0 ${LINE_WIDTH} ${height}`}
      className="block h-auto w-full overflow-visible"
      aria-hidden
    >
      {(line.ranges ?? []).map((r, i) => {
        const x1 = r.from === undefined ? ends.start : at(r.from)
        const x2 = r.to === undefined ? ends.end : at(r.to)
        return (
          <g key={`r${i}`}>
            <line
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
          </g>
        )
      })}
      <line
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
        <g key={v}>
          <line
            x1={at(v)}
            y1={y - 6}
            x2={at(v)}
            y2={y + 6}
            stroke={INK}
            strokeWidth={1.5}
          />
          <text
            {...text}
            x={at(v)}
            y={y + 27}
            textAnchor="middle"
            fontSize={14}
            fill={MUTED}
          >
            {tickLabel(v)}
          </text>
        </g>
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
        <Jump key={`j${i}`} x1={at(j.from)} x2={at(j.to)} y={y} {...j} />
      ))}
      {(line.points ?? []).map((p, i) => (
        <g key={`p${i}`}>
          <Dot x={at(p.value)} y={y} open={p.open} color={INK} />
          {p.label && (
            <text
              {...text}
              x={at(p.value)}
              y={labelsBelow ? y + 50 : y - 14}
              textAnchor="middle"
              fontSize={14}
              fontWeight={600}
              fill={INK}
            >
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
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
    <polygon
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
    <circle
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
  // A quadratic curve peaks halfway to its control point, so the control sits twice as high.
  const control = base - 2 * height
  // The head follows the curve's direction where it lands: from the control point to the end.
  const dx = x2 - mid
  const dy = base - control
  const length = Math.hypot(dx, dy)
  const ux = dx / length
  const uy = dy / length
  const back = { x: x2 - ux * 9, y: base - uy * 9 }
  return (
    <g>
      <path
        d={`M ${x1} ${base} Q ${mid} ${control} ${back.x} ${back.y}`}
        fill="none"
        stroke={MARK}
        strokeWidth={2}
      />
      <polygon
        points={`${x2},${base} ${back.x - uy * 5},${back.y + ux * 5} ${back.x + uy * 5},${back.y - ux * 5}`}
        fill={MARK}
      />
      {label && (
        <text
          {...text}
          x={mid}
          y={base - height - 8}
          textAnchor="middle"
          fontSize={13}
          fontWeight={600}
          fill={MARK}
        >
          {label}
        </text>
      )}
    </g>
  )
}

// ---------- fractions ----------

// Narrower than it shows on a desktop too, for the same reason.
const BAR = { width: 400, label: 60, height: 36, gap: 12 }
const PIE = { size: 150, radius: 62, label: 56 }

export function Fractions({ figure }: { figure: FractionVisual }) {
  return figure.shape === "circle" ? (
    <FractionCircles fractions={figure.fractions} />
  ) : (
    <FractionBars fractions={figure.fractions} />
  )
}

type Fraction = FractionVisual["fractions"][number]

/** Bars of one length stacked like a fraction wall, each cut into its parts, its label at the start. */
function FractionBars({ fractions }: { fractions: Fraction[] }) {
  const length = BAR.width - BAR.label - 4
  const height =
    fractions.length * BAR.height + (fractions.length - 1) * BAR.gap + 4
  return (
    <svg
      viewBox={`0 0 ${BAR.width} ${height}`}
      className="block h-auto w-full"
      aria-hidden
    >
      {fractions.map((f, i) => {
        const top = 2 + i * (BAR.height + BAR.gap)
        const part = length / f.parts
        return (
          <g key={i}>
            <FractionLabel
              f={f}
              x={BAR.label / 2 - 4}
              y={top + BAR.height / 2}
            />
            {Array.from({ length: f.parts }, (_, k) => (
              <rect
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
          </g>
        )
      })}
    </svg>
  )
}

/** Circles side by side, each cut into equal slices from the top, clockwise, its label under it. */
function FractionCircles({ fractions }: { fractions: Fraction[] }) {
  const width = fractions.length * PIE.size
  const r = PIE.radius
  return (
    <svg
      viewBox={`0 0 ${width} ${PIE.size + PIE.label}`}
      className="block h-auto w-full"
      aria-hidden
    >
      {fractions.map((f, i) => {
        const cx = i * PIE.size + PIE.size / 2
        const cy = PIE.size / 2
        const point = (k: number) => {
          const a = (k / f.parts) * 2 * Math.PI - Math.PI / 2
          return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
        }
        return (
          <g key={i}>
            {f.parts === 1 ? (
              <circle
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
                  <path
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
          </g>
        )
      })}
    </svg>
  )
}

/** The fraction's own label, or shaded over parts stacked with a bar between them. */
function FractionLabel({ f, x, y }: { f: Fraction; x: number; y: number }) {
  if (f.label)
    return (
      <text
        {...text}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={16}
        fontWeight={600}
        fill={INK}
      >
        {f.label}
      </text>
    )
  return (
    <g fontSize={15} fontWeight={600} fill={INK} textAnchor="middle">
      <text {...text} x={x} y={y - 4}>
        {f.shaded}
      </text>
      <line
        x1={x - 11}
        y1={y}
        x2={x + 11}
        y2={y}
        stroke={INK}
        strokeWidth={1.5}
      />
      <text {...text} x={x} y={y + 16}>
        {f.parts}
      </text>
    </g>
  )
}

// ---------- clock ----------

export function Clock({ clock }: { clock: ClockVisual }) {
  const [h, m] = clock.time.split(":").map(Number) as [number, number]
  const c = 120
  const r = 108
  // Angles clockwise from 12, in degrees: the hour hand creeps on as the minutes pass. Both hands
  // stop inside the ring of numbers, so neither hides one.
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
    <svg viewBox="0 0 240 240" className="block h-auto w-full" aria-hidden>
      <circle cx={c} cy={c} r={r} fill={PAPER} stroke={INK} strokeWidth={3} />
      {Array.from({ length: 60 }, (_, k) => {
        const hour = k % 5 === 0
        const outer = at(k * 6, r - 6)
        const inner = at(k * 6, r - (hour ? 18 : 12))
        return (
          <line
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
            <text
              {...text}
              key={k}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={19}
              fontWeight={600}
              fill={INK}
            >
              {k + 1}
            </text>
          )
        })}
      <line
        {...hand(hourAngle, 44)}
        stroke={INK}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <line
        {...hand(minuteAngle, 64)}
        stroke={MARK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <circle cx={c} cy={c} r={6} fill={INK} />
    </svg>
  )
}
