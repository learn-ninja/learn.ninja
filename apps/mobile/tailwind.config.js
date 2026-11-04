// NativeWind (Tailwind 3) config. Every value comes from tokens.ts, the app's one design file.
const {
  colors,
  radius,
  fontSize,
  LESSON_TEXT_SCALE,
  LEADING_RELAXED,
} = require("./tokens.ts")

const px = (n) => `${n}px`

/** An rgba() or hex color at a fraction of its own opacity: the web's `bg-input/30`. */
const alpha = (color, opacity) => {
  const m = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(color)
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${Number(m[4]) * opacity})`
  const n = parseInt(color.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`
}

/**
 * The tints the player's controls use, which the web gets from Tailwind 4's opacity modifiers on
 * the tokens (`bg-input/30`): a control's surface and its pressed state, an empty slot, and the
 * faint tile over a part in use.
 */
const tints = {
  surface: alpha(colors.input, 0.3),
  "surface-active": alpha(colors.input, 0.5),
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

/** The lesson sizes with leading-relaxed (the web's text-sm leading-relaxed in a concept body). */
const relaxed = Object.fromEntries(
  Object.entries(fontSize).map(([k, [size]]) => {
    const scaled = size * LESSON_TEXT_SCALE
    return [
      `lesson-${k}-relaxed`,
      [px(scaled), { lineHeight: px(scaled * LEADING_RELAXED) }],
    ]
  })
)

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Dark-only for now: the tokens are the dark theme, so there is no dark: variant to switch.
  theme: {
    extend: {
      colors: { ...colors, ...tints },
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([k, v]) => [k, px(v)])
      ),
      // Text is drawn in the system font (SF Pro, Roboto); math.tsx's FONT_DESCENT assumes it, so
      // adding a font of our own means updating that too.
      // text-sm and the rest, plus lesson-sm and the rest: the same scale inside lesson content,
      // where the web's medium text size multiplies it (data-text-size in globals.css).
      fontSize: {
        ...sizes(1),
        ...sizes(LESSON_TEXT_SCALE, "lesson-"),
        ...relaxed,
      },
    },
  },
  plugins: [],
}
