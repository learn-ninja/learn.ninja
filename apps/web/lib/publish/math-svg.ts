import { mathjax } from "mathjax-full/js/mathjax.js"
import { TeX } from "mathjax-full/js/input/tex.js"
import { SVG } from "mathjax-full/js/output/svg.js"
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js"
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js"
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js"

import type { MathSvg, Prepared } from "@workspace/player-core/prepared"

// The lesson's formulas drawn as SVG for the app, which has no HTML to show KaTeX's output in.
// MathJax draws each one from its LaTeX (the key of prepared.math) with the same Computer Modern
// metrics KaTeX uses, as paths in em, so the app can set it in a line of text at the right size and
// baseline. Drawn when the lesson is read, not stored: older lessons get them too, and a formula
// drawn once is kept in memory for the next read.
//
// Each formula is drawn in a document of its own, as KaTeX renders each with its own macros on the
// web: MathJax keeps \newcommand, \def, and \let for the life of a document, so a shared one would
// let one formula (or one lesson) change how every later one draws, and the cache would keep the
// result. A fresh document costs about two milliseconds.

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)
// Every glyph as its own path: no <use> references for the app's SVG renderer to resolve.
const output = new SVG({ fontCache: "none" })

/** A document for one formula: no definitions from any other. */
const freshDocument = () =>
  mathjax.document("", {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: output,
  })

/** Drawn formulas by mathKey(), kept across reads; the oldest go first past the cap. */
const drawn = new Map<string, MathSvg | null>()
const KEEP = 5000

/** One formula as SVG, or null when MathJax can't read it (the app shows its source instead). */
export function drawMath(tex: string, display: boolean): MathSvg | null {
  const key = `${display ? "d" : "i"}:${tex}`
  if (drawn.has(key)) return drawn.get(key)!
  const svg = draw(tex, display)
  if (drawn.size >= KEEP) drawn.delete(drawn.keys().next().value!)
  drawn.set(key, svg)
  return svg
}

function draw(tex: string, display: boolean): MathSvg | null {
  try {
    const html = adaptor.outerHTML(freshDocument().convert(tex, { display }))
    // A TeX error comes back drawn in red (merror, or an unknown command as red text); the app
    // shows the source instead.
    if (/data-mjx-error|data-mml-node="merror"|fill="red"/.test(html))
      return null
    const svg = /<svg[\s\S]*<\/svg>/.exec(html)?.[0]
    const box = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(
      svg ?? ""
    )
    if (!svg || !box) return null
    // The viewBox is in thousandths of an em, with the baseline at y = 0.
    const [, , top, width, height] = box.map(Number)
    return {
      svg: svg
        // The app sizes it from the numbers below; MathJax's own attributes would fight that.
        .replace(
          /^<svg[^>]*>/,
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.slice(1).join(" ")}">`
        )
        .replace(/ data-[\w-]+="[^"]*"/g, ""),
      width: round(width! / 1000),
      ascent: round(-top! / 1000),
      descent: round((top! + height!) / 1000),
    }
  } catch {
    return null
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000

/** Every formula the lesson's prepared output holds, drawn: inline and display alike. */
export function drawLessonMath(prepared: Prepared): Record<string, MathSvg> {
  const out: Record<string, MathSvg> = {}
  for (const key of Object.keys(prepared.math)) {
    const svg = drawMath(key.slice(2), key.startsWith("d:"))
    if (svg) out[key] = svg
  }
  return out
}
