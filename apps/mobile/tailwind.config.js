// NativeWind (Tailwind 3) config. Every value comes from tokens.ts, the app's one design file.
const { colors, radius, fontSize, LESSON_TEXT_SCALE } = require("./tokens.ts")

const px = (n) => `${n}px`

/** Tailwind's text sizes as [size, { lineHeight }], scaled. */
const sizes = (scale, prefix = "") =>
  Object.fromEntries(
    Object.entries(fontSize).map(([k, [size, line]]) => [
      prefix + k,
      [px(size * scale), { lineHeight: px(line * scale) }],
    ])
  )

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Dark-only for now: the tokens are the dark theme, so there is no dark: variant to switch.
  theme: {
    extend: {
      colors,
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([k, v]) => [k, px(v)])
      ),
      // text-sm and the rest, plus lesson-sm and the rest: the same scale inside lesson content,
      // where the web's medium text size multiplies it (data-text-size in globals.css).
      fontSize: { ...sizes(1), ...sizes(LESSON_TEXT_SCALE, "lesson-") },
    },
  },
  plugins: [],
}
