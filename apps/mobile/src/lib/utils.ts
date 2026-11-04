import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

import { fontSize } from "../../tokens"

// tailwind.config.js adds lesson-sm and the rest beside Tailwind's text sizes; without telling
// tailwind-merge, it takes text-lesson-sm for a color and drops the text's own color.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: Object.keys(fontSize).map((k) => `lesson-${k}`) }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
