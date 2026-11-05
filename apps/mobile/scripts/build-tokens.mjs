// Writes tokens.ts, the app's design tokens, from the web's theme: the `.dark` block of
// packages/ui/src/styles/globals.css (OKLCH converted to hex, since React Native has none) and
// Tailwind 4's own green-600 for a checked answer (the web's controls.ts). Run it after changing
// the theme: `npm run tokens -w mobile`. tokens.test.ts fails while tokens.ts is stale.

import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import prettier from "prettier"

const here = dirname(fileURLToPath(import.meta.url))
const app = join(here, "..")
const ui = join(app, "../../packages/ui")
export const TOKENS_PATH = join(app, "tokens.ts")

/** Custom properties in the first rule whose selector is `selector`. */
function block(css, selector) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`No ${selector} block in globals.css`)
  const body = css.slice(start, css.indexOf("\n}", start))
  const vars = {}
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g))
    vars[m[1]] = m[2].trim()
  return vars
}

/** oklch(L C H [/ A]) or a hex color, as #rrggbb, or rgba() when it has alpha. */
export function toRgb(value) {
  if (value.startsWith("#")) return value
  const m =
    /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/.exec(
      value
    )
  if (!m) throw new Error(`Can't convert ${value}`)
  const L = Number(m[1]) / (m[2] ? 100 : 1)
  const C = Number(m[3])
  const h = (Number(m[4]) * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const [l, mm, s] = [l_ ** 3, m_ ** 3, s_ ** 3]
  const linear = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ]
  const [r, g, bl] = linear.map((x) => {
    const c = Math.max(0, Math.min(1, x))
    const srgb = c > 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c
    return Math.round(srgb * 255)
  })
  if (m[5] !== undefined) {
    const alpha = Number(m[5]) / (m[6] ? 100 : 1)
    return `rgba(${r}, ${g}, ${bl}, ${alpha})`
  }
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`
}

export async function tokensSource() {
  const css = readFileSync(join(ui, "src/styles/globals.css"), "utf8")
  const dark = block(css, ".dark")
  const root = block(css, ":root")
  const tailwind = readFileSync(
    createRequire(join(ui, "package.json")).resolve("tailwindcss/theme.css"),
    "utf8"
  )
  /** One of Tailwind's own colors, from its theme. */
  const tw = (name) => {
    const value = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(tailwind)?.[1]
    if (!value) throw new Error(`No --color-${name} in Tailwind's theme.css`)
    return toRgb(value)
  }
  const c = (name) => {
    if (!dark[name]) throw new Error(`No --${name} in .dark`)
    return toRgb(dark[name])
  }
  const pair = (name) => ({
    DEFAULT: c(name),
    foreground: c(`${name}-foreground`),
  })
  const colors = {
    background: c("background"),
    foreground: c("foreground"),
    card: pair("card"),
    popover: pair("popover"),
    primary: pair("primary"),
    secondary: pair("secondary"),
    muted: pair("muted"),
    accent: pair("accent"),
    destructive: { DEFAULT: c("destructive"), foreground: c("foreground") },
    border: c("border"),
    input: c("input"),
    ring: c("ring"),
    correct: tw("green-600"),
    // The player's feedback: green for a right answer, yellow for a miss, amber for a near miss
    // (the web's success and warning buttons, markStyles, and the notes under the answers).
    feedback: {
      good: tw("green-600"),
      goodButton: tw("green-500"),
      goodButtonText: tw("green-950"),
      warn: tw("yellow-500"),
      warnText: tw("yellow-950"),
      partial: tw("amber-500"),
    },
    // The day streak's lanterns in the dark theme (packages/player/src/streak.tsx): a lit one's
    // amber outline, a rest day's blue, and the orange of a lit streak's count.
    streak: {
      lit: tw("amber-400"),
      rest: tw("blue-500"),
      count: tw("orange-500"),
    },
    chart: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, c(`chart-${n}`)])),
    // The profile's activity grid (apps/web/components/explore/activity-grid.tsx): no lessons,
    // then an ember to the lantern's amber with activity, and a rest day's blue.
    activity: {
      ...Object.fromEntries([0, 1, 2, 3, 4].map((n) => [n, c(`activity-${n}`)])),
      rest: c("activity-rest"),
    },
  }
  const radius = Number(/^([\d.]+)rem$/.exec(root.radius ?? "")?.[1]) * 16
  if (!radius) throw new Error(`Can't read --radius (${root.radius})`)
  // The learner's text size: the player starts on medium, which scales lesson content's text.
  const scale = Number(block(css, '[data-text-size="md"]')["text-scale"])
  if (!scale) throw new Error("Can't read the medium --text-scale")
  const large = Number(block(css, '[data-text-size="lg"]')["text-scale"])
  if (!large) throw new Error("Can't read the large --text-scale")

  const source = `// Generated by scripts/build-tokens.mjs from packages/ui/src/styles/globals.css (the .dark
// block) and Tailwind 4's palette. Don't edit: run \`npm run tokens -w mobile\`.
//
// The app's design tokens, in one place: tailwind.config.js reads them for NativeWind's classes,
// and code that needs a raw value imports them. Dark is the brand, and the app is dark-only for
// now, as the production site is.

export const colors = ${JSON.stringify(colors)} as const

/** --radius is ${root.radius} (${radius}px); the rest follow globals.css's multipliers. */
const RADIUS = ${radius}
export const radius = {
  sm: RADIUS * 0.6,
  md: RADIUS * 0.8,
  lg: RADIUS,
  xl: RADIUS * 1.4,
  "2xl": RADIUS * 1.8,
  "3xl": RADIUS * 2.2,
  "4xl": RADIUS * 2.6,
} as const

/** Tailwind's text scale (font size, line height) in points; the web uses only these. */
export const fontSize = {
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  "2xl": [24, 32],
  "3xl": [30, 36],
  "4xl": [36, 40],
} as const

/**
 * How much lesson content's text is scaled at the player's default (medium) text size, as the web
 * scales it inside data-text-size. tailwind.config.js adds lesson-sm and the rest at this scale.
 */
export const LESSON_TEXT_SCALE = ${scale}

/** Lesson text's scale at each of the learner's text sizes (small is Tailwind's own). */
export const TEXT_SCALES = { sm: 1, md: ${scale}, lg: ${large} } as const

/** Tailwind's leading-relaxed: lesson body text's line height, as a multiple of its size. */
export const LEADING_RELAXED = 1.625

/** Tailwind's 4pt spacing step, kept so class names mean the same on both players. */
export const SPACING_UNIT = 4
`
  const options = await prettier.resolveConfig(TOKENS_PATH)
  return prettier.format(source, { ...options, filepath: TOKENS_PATH })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(TOKENS_PATH, await tokensSource())
  console.log("Wrote tokens.ts")
}
