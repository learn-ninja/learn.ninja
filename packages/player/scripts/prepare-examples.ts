// Prepares the example lessons for Storybook (KaTeX formulas, Shiki highlighting, charts, D2
// diagrams), the same way the web app does on the server, plus the Tailwind classes of the visual
// kit story and the diagram samples, and writes src/stories/prepared.generated.json.
// Run: npm run stories:prepare -w @workspace/player
import { readdirSync, readFileSync, writeFileSync } from "node:fs"

import { validateLesson } from "@workspace/spec"

import { renderDiagram } from "../src/diagram"
import { prepareLesson } from "../src/prepare"
import { diagramKey } from "../src/prepared"
import { visualClasses, visualsCssFor } from "../src/visual-css"
import type { Prepared } from "../src/prepared"
import { diagramSamples, visualKit } from "../src/stories/visual-kit"

const dir = new URL("../../../examples/", import.meta.url)
const merged: Prepared = {
  math: {},
  code: {},
  visualsCss: "",
  charts: {},
  diagrams: {},
}
const classes = new Set<string>()

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const result = validateLesson(readFileSync(new URL(file, dir), "utf8"))
  if (!result.ok) throw new Error(`${file} is invalid`)
  const prepared = await prepareLesson(result.lesson)
  Object.assign(merged.math, prepared.math)
  Object.assign(merged.code, prepared.code)
  Object.assign(merged.charts!, prepared.charts)
  Object.assign(merged.diagrams!, prepared.diagrams)
  for (const c of visualClasses(result.lesson)) classes.add(c)
}
for (const c of visualClasses(visualKit)) classes.add(c)
for (const sample of diagramSamples)
  merged.diagrams![diagramKey(sample.d2)] = await renderDiagram(sample.d2)
merged.visualsCss = await visualsCssFor([...classes])

const out = new URL("../src/stories/prepared.generated.json", import.meta.url)
writeFileSync(out, JSON.stringify(merged))
console.log(
  `Prepared ${Object.keys(merged.math).length} formulas and ${Object.keys(merged.code).length} code blocks`
)
