import { createContext, useContext } from "react"

import {
  emptyPrepared,
  type MathSvg,
  type Prepared,
} from "@workspace/player-core/prepared"

/**
 * What a lesson's screens need from the lesson around them: what the server prepared (code,
 * charts, diagrams, molecules), its formulas drawn as SVG, and the visuals' shared stylesheet.
 */
export const LessonContext = createContext<{
  prepared: Prepared
  mathSvg: Record<string, MathSvg>
  baseCss: string
  /** The lesson's language, for the strings and country names. */
  lang: string
}>({ prepared: emptyPrepared, mathSvg: {}, baseCss: "", lang: "en" })

export const useLesson = () => useContext(LessonContext)
