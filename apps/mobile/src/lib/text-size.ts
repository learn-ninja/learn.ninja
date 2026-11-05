import type { TextSize } from "@workspace/player-core/strings"

import { fontSize, LEADING_RELAXED, TEXT_SCALES } from "../../tokens"

// The learner's text size (the web's data-text-size): Small, Medium, or Large scales lesson
// content's text only, never the app's frame. NativeWind's lesson-* classes read these variables
// (tailwind.config.js); code that sizes something by hand (a formula, a chip's height) reads the
// scale from LessonTextSize's context.

/** How much lesson text is scaled at a size; Medium until the learner picks another. */
export const textScaleOf = (size: TextSize | undefined) =>
  TEXT_SCALES[size ?? "md"] ?? TEXT_SCALES.md

/** The CSS variables behind lesson-sm and the rest at a size, in points. */
export function lessonTextVars(size: TextSize | undefined) {
  const scale = textScaleOf(size)
  const vars: Record<string, string> = {}
  for (const [key, [font, leading]] of Object.entries(fontSize)) {
    const scaled = font * scale
    vars[`--lesson-${key}`] = `${round(scaled)}px`
    vars[`--lesson-${key}-leading`] = `${round(leading * scale)}px`
    vars[`--lesson-${key}-relaxed`] = `${round(scaled * LEADING_RELAXED)}px`
  }
  return vars
}

const round = (n: number) => Math.round(n * 100) / 100
