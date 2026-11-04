# @workspace/player-core

The parts of the lesson player with no DOM: answer checking, the lesson's flow and state, saved
progress (storage is passed in), seeded randomness, the interface strings and every locale, the
ninja's lines and voice clip table, the `Prepared` types, and the function-chart checker. The web
player (`packages/player`) and the iOS app (`apps/mobile`) both import it, so a change here lands
in both.

Nothing here may touch `window`, `document`, or a browser API: the `tsconfig.json` leaves the DOM
library out so `npm run check` catches it.
