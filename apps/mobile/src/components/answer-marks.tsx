import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ComponentRef,
} from "react"
import type { View } from "react-native"

import type { Mark } from "@workspace/player-core/check"

import type { AnswerMarks } from "@/lib/answer-marks"

/** The player's registry of marked answers (lib/answer-marks.ts), for the controls inside it. */
export const AnswerMarksContext = createContext<AnswerMarks | null>(null)

/** A ref for a control's view that's registered while the control is marked. */
export function useMarkedAnswer(mark: Mark | undefined) {
  const ref = useRef<ComponentRef<typeof View>>(null)
  const marks = useContext(AnswerMarksContext)
  useEffect(() => {
    if (!mark || !marks || !ref.current) return
    return marks.register(ref.current)
  }, [mark, marks])
  return ref
}
