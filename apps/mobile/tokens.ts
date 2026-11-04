// The app's design tokens, in one place: tailwind.config.js reads them for NativeWind's classes,
// and code that needs a raw value (the status bar, the WebView's background) imports them.
// Taken from packages/ui/src/styles/globals.css (the `.dark` block, converted from OKLCH to hex,
// since React Native has no OKLCH). Dark is the brand, and the app is dark-only for now, as the
// production site is. Switching the styling library later means reading this file from its
// config instead.

export const colors = {
  background: "#121212",
  foreground: "#fafafa",
  card: { DEFAULT: "#1c1c1c", foreground: "#fafafa" },
  popover: { DEFAULT: "#1c1c1c", foreground: "#fafafa" },
  primary: { DEFAULT: "#e5e5e5", foreground: "#171717" },
  secondary: { DEFAULT: "#262626", foreground: "#fafafa" },
  muted: { DEFAULT: "#262626", foreground: "#a1a1a1" },
  accent: { DEFAULT: "#262626", foreground: "#fafafa" },
  destructive: { DEFAULT: "#ff6467", foreground: "#fafafa" },
  /** oklch(1 0 0 / 10%) */
  border: "rgba(255, 255, 255, 0.1)",
  /** oklch(1 0 0 / 15%) */
  input: "rgba(255, 255, 255, 0.15)",
  ring: "#737373",
  /** The checked-answer colors (green-600, as the web's controls.ts). */
  correct: "#16a34a",
  chart: {
    1: "#8ec5ff",
    2: "#2b7fff",
  },
} as const

/** --radius is 0.625rem (10px); the rest follow globals.css's multipliers. */
const RADIUS = 10
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

/** Tailwind's 4pt spacing step, kept so class names mean the same on both players. */
export const SPACING_UNIT = 4
