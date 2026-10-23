import { readdirSync } from "node:fs"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

// Every bundled lesson, played start to finish on a phone (an iPhone-sized screen with touch). On
// every screen nothing scrolls sideways, the main action is a thumb-sized button on screen, and the
// tray under the lesson never covers it. The player is driven like a learner who doesn't know the
// answers: any pick will do, since a miss is just more screens to check.

const slugs = readdirSync(path.join(process.cwd(), "../../examples"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))

test.use({
  viewport: { width: 390, height: 664 },
  isMobile: true,
  hasTouch: true,
  // Motion off, so each screen settles at once; the layout is the same either way.
  contextOptions: { reducedMotion: "reduce" },
})

/** The tray's buttons that move the lesson along, in the order they're tried. */
const ACTIONS = [
  "Start lesson",
  "Continue",
  "Skip",
  "Start",
  "Try again",
  "Rewind",
  "Check answer",
]
/** Check's name while sort items wait for a group ("2 left to sort"). */
const CHECK = /^(Check answer|\d+ left to sort)$/

for (const slug of slugs) {
  test(`${slug} plays on a phone`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto(`/lessons/${slug}`)
    await expect(
      page.getByRole("button", { name: "Start lesson" })
    ).toBeVisible()

    for (let step = 0; ; step++) {
      expect(step, "the lesson never reached its wrap-up").toBeLessThan(80)
      await checkLayout(page)
      if (
        await page.getByRole("button", { name: "Restart lesson" }).isVisible()
      )
        break
      const action = await nextAction(page)
      if (action === "Check answer") {
        const check = page.getByRole("button", { name: CHECK })
        if (await check.isDisabled()) await answer(page)
        // A finished match checks itself; anything else waits for Check.
        if (await check.isVisible()) {
          if (await check.isEnabled()) await check.click()
        }
      } else {
        await page.getByRole("button", { name: action, exact: true }).click()
      }
      await page.waitForTimeout(100)
    }
  })
}

async function nextAction(page: Page): Promise<string> {
  for (const name of ACTIONS) {
    const button = page.getByRole("button", { name, exact: true })
    if (await button.isVisible()) return name
  }
  if (await page.getByRole("button", { name: CHECK }).isVisible())
    return "Check answer"
  throw new Error("No action button in the tray")
}

/** Sideways scrolling, a small or hidden main action, and the tray over the lesson all fail. */
async function checkLayout(page: Page) {
  const problems = await page.evaluate(([actions, check]) => {
    const out: string[] = []
    const doc = document.documentElement
    if (doc.scrollWidth > window.innerWidth + 1)
      out.push(`the page is ${doc.scrollWidth}px wide`)
    const main = document.querySelector("main")
    if (main && main.scrollWidth > main.clientWidth + 1) {
      // Name the outermost element that sticks out, so the failure says where to look.
      const edge = main.getBoundingClientRect().right + 1
      const wide = [...main.querySelectorAll<HTMLElement>("*")].find(
        (el) => el.getBoundingClientRect().right > edge
      )
      out.push(
        `the lesson scrolls sideways (${main.scrollWidth}px): <${wide?.tagName.toLowerCase()} class="${wide?.className}"> "${wide?.textContent?.trim().slice(0, 40)}"`
      )
    }
    const buttons = [...document.querySelectorAll("button")].filter(
      (b) => {
        const name = b.textContent?.trim() ?? ""
        return (
          b.offsetParent &&
          (actions.includes(name) || new RegExp(check).test(name))
        )
      }
    )
    for (const b of buttons) {
      const r = b.getBoundingClientRect()
      if (r.height < 44) out.push(`"${b.textContent}" is ${r.height}px tall`)
      if (r.top < 0 || r.bottom > window.innerHeight)
        out.push(`"${b.textContent}" is off screen`)
      if (main && r.top < main.getBoundingClientRect().bottom - 1)
        out.push(`"${b.textContent}" overlaps the lesson`)
    }
    return out
  }, [ACTIONS, CHECK.source] as const)
  expect(problems).toEqual([])
}

/** Makes the answer ready to check, the way a learner taps through it. */
async function answer(page: Page) {
  await page.evaluate(async (checkName) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const check = () =>
      [...document.querySelectorAll("button")].find((b) =>
        new RegExp(checkName).test(b.textContent?.trim() ?? "")
      )
    const ready = () => {
      const b = check()
      return !b || !b.disabled
    }
    const enabled = (el: Element) =>
      !el.hasAttribute("disabled") && !el.hasAttribute("data-disabled")

    // Match: two columns of tiles. Try pairs until each one sticks (a wrong pair comes apart).
    const columns = [...document.querySelectorAll("main .grid-rows-subgrid")]
    if (columns.length === 2) {
      const [left, right] = columns.map((c) => [...c.children])
      for (const l of left!) {
        for (const r of right!) {
          if (!enabled(l) || !enabled(r)) continue
          ;(l as HTMLElement).click()
          ;(r as HTMLElement).click()
          await wait(50)
        }
      }
      return
    }

    // Sort: tap the first bin until the deck is empty (a tap on a sorted chip would take it back out).
    const bins = () =>
      [...document.querySelectorAll<HTMLElement>("main button")].filter(
        (b) => b.offsetParent && b.textContent?.trim() === "Put it here"
      )
    if (bins().length) {
      for (let i = 0; i < 20 && bins().length; i++) {
        bins()[0]!.click()
        await wait(50)
      }
      return
    }

    // Everything else: tap the last control in the brick that isn't picked yet (the pool and the word
    // bank come after what's been placed) until Check lights up.
    for (let i = 0; i < 20 && !ready(); i++) {
      const controls = [
        ...document.querySelectorAll<HTMLElement>(
          "main button, main [data-slot=selectable]"
        ),
      ].filter(
        (el) =>
          el.offsetParent &&
          enabled(el) &&
          el.getAttribute("aria-label") !== "Expand" &&
          !el.hasAttribute("data-selected") &&
          el.getAttribute("aria-pressed") !== "true"
      )
      const last = controls.at(-1)
      if (!last) break
      last.click()
      await wait(50)
    }
  }, CHECK.source)
}
