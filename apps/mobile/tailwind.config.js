// NativeWind (Tailwind 3) config. Every value comes from tokens.ts, the app's one design file.
const { colors, radius, fontSize } = require("./tokens.ts")

const px = (n) => `${n}px`

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
      fontSize: Object.fromEntries(
        Object.entries(fontSize).map(([k, [size, line]]) => [
          k,
          [px(size), { lineHeight: px(line) }],
        ])
      ),
    },
  },
  plugins: [],
}
