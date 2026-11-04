// Prepares the example lessons for Storybook (KaTeX formulas, Shiki highlighting, charts, D2
// diagrams, molecules), the same way the web app does on the server, plus the Tailwind classes of the
// visual kit story and the drawings of the chart, diagram, and molecule samples, and writes
// src/stories/prepared.generated.json.
// Run: npm run stories:prepare -w @workspace/player
import { readdirSync, readFileSync, writeFileSync } from "node:fs"

import { validateLesson } from "@workspace/spec"

import { renderChart } from "../src/chart"
import { renderDiagram } from "../src/diagram"
import { renderMolecule } from "../src/molecule"
import { prepareLesson } from "../src/prepare"
import { chartKey, diagramKey, moleculeKey } from "@workspace/player-core/prepared"
import { visualClasses, visualsCssFor } from "../src/visual-css"
import type { Prepared } from "@workspace/player-core/prepared"
import {
  chartSamples,
  diagramSamples,
  moleculeSamples,
  visualKit,
} from "../src/stories/visual-kit"

const dir = new URL("../../../examples/", import.meta.url)
const merged: Prepared = {
  math: {},
  code: {},
  visualsCss: "",
  charts: {},
  diagrams: {},
  molecules: {},
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
  Object.assign(merged.molecules!, prepared.molecules)
  for (const c of visualClasses(result.lesson)) classes.add(c)
}
for (const c of visualClasses(visualKit)) classes.add(c)
// Both sizes, so a sample can go on an option or item card as well as a kata.
for (const { chart } of chartSamples)
  for (const compact of [false, true])
    merged.charts![chartKey(chart, compact)] = renderChart(chart, compact)
for (const sample of diagramSamples)
  merged.diagrams![diagramKey(sample.d2)] = await renderDiagram(sample.d2)
for (const { molecule } of moleculeSamples)
  merged.molecules![moleculeKey(molecule)] = renderMolecule(molecule)
merged.visualsCss = await visualsCssFor([...classes])

const out = new URL("../src/stories/prepared.generated.json", import.meta.url)
writeFileSync(out, JSON.stringify(merged))
console.log(
  `Prepared ${Object.keys(merged.math).length} formulas and ${Object.keys(merged.code).length} code blocks`
)
