// NativeWind (Tailwind 3) config. Every value comes from tokens.ts, the app's one design file.
const { colors, radius, fontSize } = require("./tokens.ts")

const px = (n) => `${n}px`

/** An rgba() or hex color at a fraction of its own opacity: the web's `bg-input/30`. */
const alpha = (color, opacity) => {
  const m = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(color)
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${Number(m[4]) * opacity})`
  const n = parseInt(color.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`
}

/**
 * A color at a fraction of its own opacity, laid over a solid one: the same color a translucent
 * fill shows on the page, but solid. A view with a shadow needs a solid fill, or iOS can't work out
 * the shadow's shape from it (React Native warns that it "cannot calculate shadow efficiently").
 */
const over = (color, opacity, base) => {
  const channels = (c) => {
    const m = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(c)
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
    const n = parseInt(c.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const [r, g, b, a] = channels(color)
  const [br, bg, bb] = channels(base)
  const k = a * opacity
  const hex = (top, bottom) =>
    Math.round(top * k + bottom * (1 - k))
      .toString(16)
      .padStart(2, "0")
  return `#${hex(r, br)}${hex(g, bg)}${hex(b, bb)}`
}

/**
 * The tints the player's controls use, which the web gets from Tailwind 4's opacity modifiers on
 * the tokens (`bg-input/30`): a control's surface and its pressed state, an empty slot, and the
 * faint tile over a part in use. The surfaces carry a shadow, so they're solid: the tint over the
 * page, where the controls sit.
 */
const tints = {
  surface: over(colors.input, 0.3, colors.background),
  "surface-active": over(colors.input, 0.5, colors.background),
  slot: alpha(colors.input, 0.1),
  tile: alpha(colors.foreground, 0.05),
}

/** Tailwind's text sizes as [size, { lineHeight }], scaled. */
const sizes = (scale, prefix = "") =>
  Object.fromEntries(
    Object.entries(fontSize).map(([k, [size, line]]) => [
      prefix + k,
      [px(size * scale), { lineHeight: px(line * scale) }],
    ])
  )

/**
 * The lesson sizes (lesson-sm and the rest, and lesson-sm-relaxed with leading-relaxed): CSS
 * variables, so the learner's text size changes them at once. LessonTextSize
 * (src/components/text-size.tsx) sets them from src/lib/text-size.ts, at medium until chosen.
 */
const lessonSizes = Object.fromEntries(
  Object.keys(fontSize).flatMap((k) => [
    [
      `lesson-${k}`,
      [`var(--lesson-${k})`, { lineHeight: `var(--lesson-${k}-leading)` }],
    ],
    [
      `lesson-${k}-relaxed`,
      [`var(--lesson-${k})`, { lineHeight: `var(--lesson-${k}-relaxed)` }],
    ],
  ])
)

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Dark-only for now: the tokens are the dark theme, so there is no dark: variant to switch.
  theme: {
    extend: {
      colors: { ...colors, ...tints },
      // The web's shadow-xs (Tailwind 4), which Tailwind 3 doesn't have: cards and controls.
      boxShadow: { xs: "0px 1px 2px rgba(0, 0, 0, 0.05)" },
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([k, v]) => [k, px(v)])
      ),
      // Text is drawn in the system font (SF Pro, Roboto); math.tsx's FONT_DESCENT assumes it, so
      // adding a font of our own means updating that too.
      // text-sm and the rest, plus lesson-sm and the rest: the same scale inside lesson content,
      // where the web's medium text size multiplies it (data-text-size in globals.css).
      fontSize: {
        ...sizes(1),
        ...lessonSizes,
      },
    },
  },
  plugins: [],
}
