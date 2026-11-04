import { createContext, useContext } from "react"

import type { MathSvg } from "@workspace/player-core/prepared"

/** What the lesson's text needs from the lesson around it: its formulas, drawn by the server. */
export const LessonContext = createContext<{
  mathSvg: Record<string, MathSvg>
}>({ mathSvg: {} })

export const useLesson = () => useContext(LessonContext)
