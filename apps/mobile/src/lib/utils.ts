import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

import { fontSize } from "../../tokens"

// tailwind.config.js adds lesson-sm, lesson-sm-relaxed, and the rest beside Tailwind's text sizes;
// without telling tailwind-merge, it takes them for colors and drops the text's own color.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: Object.keys(fontSize).flatMap((k) => [
            `lesson-${k}`,
            `lesson-${k}-relaxed`,
          ]),
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
