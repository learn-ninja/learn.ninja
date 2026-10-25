import { parseHTML } from "linkedom"
import { afterEach, describe, expect, it, vi } from "vitest"

import { shortcutBlocked } from "./keys"

// Number keys and ?, D, W leave fields, menus, and dialogs alone, and wait while a modal is open.

function page(html: string) {
  const { document } = parseHTML(
    `<!doctype html><html><body>${html}</body></html>`
  )
  vi.stubGlobal("document", document)
  return document
}

const press = (target: Element) => ({ target }) as unknown as KeyboardEvent

describe("lesson shortcuts", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("run on the lesson itself", () => {
    const doc = page(`<main><button data-slot="selectable">A</button></main>`)
    expect(shortcutBlocked(press(doc.querySelector("button")!))).toBe(false)
  })

  it("leave fields, menus, and dialogs alone", () => {
    const doc = page(
      `<input id="field"><div role="menu"><div role="menuitem" id="item">Restart</div></div>` +
        `<section role="alertdialog"><button id="ok">Restart</button></section>`
    )
    for (const id of ["field", "item", "ok"])
      expect(shortcutBlocked(press(doc.getElementById(id)!))).toBe(true)
  })

  it("wait while a modal is open, wherever focus is", () => {
    const doc = page(
      `<main><button id="option">A</button></main><div data-slot="dialog-overlay"></div>`
    )
    expect(shortcutBlocked(press(doc.getElementById("option")!))).toBe(true)
  })
})
