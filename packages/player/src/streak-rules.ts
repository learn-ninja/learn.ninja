// The rest-day numbers, shared by the server that keeps the streak (apps/web/lib/activity) and the
// lanterns and bar that show it (streak.tsx). Not a client module, so server code can read them.

/** Learning days that recharge one rest day, in a row or not, as long as the streak holds. */
export const LEARN_PER_REST = 2
/** The most rest days a learner can have saved. */
export const MAX_REST = 2
/** Rest days a new streak starts with, so missing day 2 doesn't end it. The info copy says "one". */
export const START_REST = 1
