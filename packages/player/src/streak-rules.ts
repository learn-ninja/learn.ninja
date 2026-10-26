// The rest-day numbers, shared by the server that keeps the streak (apps/web/lib/activity) and the
// lanterns and bar that show it (streak.tsx). Not a client module, so server code can read them.

/** Learning days that recharge one rest day. */
export const LEARN_PER_REST = 3
/** The most rest days a learner can have saved. */
export const MAX_REST = 2
