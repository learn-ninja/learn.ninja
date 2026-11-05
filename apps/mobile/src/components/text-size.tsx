import { vars } from "nativewind"
import { createContext, use, useMemo, type ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import type { TextSize } from "@workspace/player-core/strings"

import { lessonTextVars, textScaleOf } from "@/lib/text-size"

// Lesson content's text size (src/lib/text-size.ts): the lesson-* classes inside follow it, and
// useLessonTextScale gives the scale to code that sizes text by hand.

const ScaleContext = createContext(textScaleOf(undefined))

/** How much lesson text is scaled here: 1.125 at Medium. */
export const useLessonTextScale = () => use(ScaleContext)

export function LessonTextSize({
  size,
  style,
  children,
  ...props
}: ViewProps & { size: TextSize | undefined; children: ReactNode }) {
  const variables = useMemo(() => vars(lessonTextVars(size)), [size])
  return (
    <ScaleContext value={textScaleOf(size)}>
      <View {...props} style={[variables, style]}>
        {children}
      </View>
    </ScaleContext>
  )
}
