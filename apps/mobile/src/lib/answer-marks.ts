// The answers a check has marked, kept for the player around the katas: after checking, the tray
// grows to show the feedback, which can cover the marked answers, so the player brings the lowest
// of them back into view (as the web's phone layout does). Each marked control registers its view
// (components/answer-marks.tsx). Free of React Native imports, so it's tested in Node.

/** What's needed of a mounted view: where it sits in the window. */
export interface Measurable {
  measureInWindow(
    callback: (x: number, y: number, width: number, height: number) => void
  ): void
}

export interface Box {
  top: number
  bottom: number
}

export type AnswerMarks = ReturnType<typeof createAnswerMarks>

/** A registry of marked views, and where the lowest of them sits. */
export function createAnswerMarks() {
  const views = new Set<Measurable>()
  /** Adds a marked control's view; the returned function takes it off again. */
  const register = (view: Measurable) => {
    views.add(view)
    return () => void views.delete(view)
  }
  /** The lowest marked view's top and bottom in the window, or null when nothing is marked. */
  const lowest = async (): Promise<Box | null> => {
    const boxes = await Promise.all(
      [...views].map(
        (v) =>
          new Promise<Box | null>((resolve) => {
            try {
              v.measureInWindow((_x, y, _w, h) =>
                resolve(h > 0 ? { top: y, bottom: y + h } : null)
              )
            } catch {
              resolve(null)
            }
          })
      )
    )
    return boxes.reduce<Box | null>(
      (low, box) => (box && (!low || box.bottom > low.bottom) ? box : low),
      null
    )
  }
  return { register, lowest }
}

/**
 * How far to scroll down so the lowest marked answer clears the bottom of the window by `gap`,
 * without its top going above the window's: 0 when it's already in view.
 */
export function revealBy(
  answer: Box,
  window: { top: number; height: number },
  gap = 12
): number {
  const below = answer.bottom + gap - (window.top + window.height)
  return Math.max(0, Math.min(below, answer.top - window.top))
}
