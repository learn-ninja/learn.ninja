// Takes the App Store's 6.9" iPhone screenshots (1320 × 2868) on a booted simulator, into
// store/screenshots/ (git-ignored): `npm run store:screenshots -w mobile`, with the app installed
// and running against the server it should show (store/listing.md says what each needs).
// The status bar reads 9:41, full battery and signal, as Apple's own screenshots do. A screen
// with a deep link is opened by it (iOS asks "Open in learn.ninja?" first: tap Open); before each
// shot the script waits for Enter, so the screen can be arranged by hand (a question half
// answered, the wrap-up, the widget).
//
//   npm run store:screenshots -w mobile -- "iPhone 18 Pro Max" compound-interest

import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, "../store/screenshots")
// The simulator and the lesson to show, as arguments: `-- "iPhone 18 Pro Max" compound-interest`.
const [device = "iPhone 18 Pro Max", lesson = "compound-interest"] =
  process.argv.slice(2)

/** The screens, in the order they appear on the listing. */
export const SHOTS = [
  { name: "01-lesson-intro", url: `learnninja://l/${lesson}` },
  {
    name: "02-question",
    url: null,
    setup: "Answer a question in the lesson and check it.",
  },
  {
    name: "03-wrap-up",
    url: null,
    setup: "Finish the lesson: the streak screen, then the wrap-up.",
  },
  {
    name: "04-explore",
    url: "learnninja://",
    setup: "Log in, so home is Explore.",
  },
  { name: "05-profile", url: "learnninja://me" },
  { name: "06-widget", url: null, setup: "Go home and add the medium widget." },
]

const simctl = (...args) =>
  execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8" })

async function main() {
  mkdirSync(out, { recursive: true })
  simctl(
    "status_bar",
    device,
    "override",
    "--time",
    "9:41",
    "--batteryState",
    "charged",
    "--batteryLevel",
    "100",
    "--wifiBars",
    "3",
    "--cellularMode",
    "active",
    "--cellularBars",
    "4"
  )
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  // Input closed (Ctrl-D) before the last shot: put the status bar back and stop.
  rl.on("close", () => {
    simctl("status_bar", device, "clear")
    process.exit(0)
  })
  try {
    for (const shot of SHOTS) {
      if (shot.url) simctl("openurl", device, shot.url)
      const step = shot.url
        ? `Tap Open if iOS asks${shot.setup ? `, then: ${shot.setup}` : "."}`
        : shot.setup
      await rl.question(`${shot.name}: ${step} Press Enter for the shot. `)
      const file = join(out, `${shot.name}.png`)
      simctl("io", device, "screenshot", "--type=png", file)
      console.log(`saved ${file}`)
    }
  } finally {
    rl.close()
    simctl("status_bar", device, "clear")
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
