import { describe, expect, it } from "vitest"

import type { MoleculeVisual } from "@workspace/spec"

import { checkMolecule, MOLECULE_ATOMS, renderMolecule } from "./molecule"

// Molecules are laid out and drawn by OpenChemLib on the server into SVG that carries only theme
// tokens, so one drawing serves light and dark; the checks catch what the drawing can't show.

const molecule = (
  smiles: string,
  extra: Partial<MoleculeVisual> = {}
): MoleculeVisual => ({ kind: "molecule", smiles, ...extra })

const messages = (v: MoleculeVisual) =>
  checkMolecule(v).map((i) => `${i.field}: ${i.message}`)

describe("renderMolecule", () => {
  it("draws bonds and element labels in theme colors, with nothing interactive left", () => {
    const svg = renderMolecule(molecule("CC(=O)Oc1ccccc1C(=O)O"))
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain('stroke="var(--foreground)"')
    // Oxygen keeps its red, mixed toward the text color so it reads on both themes.
    expect(svg).toMatch(
      /fill="color-mix\(in oklab, rgb\(255,13,13\) 70%, var\(--foreground\)\)">O</
    )
    expect(svg).not.toMatch(/rgb\(0,0,0\)|class="event"|<style|\sid=/)
  })

  it("is the same drawing every time", () => {
    const v = molecule("CN1C=NC2=C1C(=O)N(C(=O)N2C)C")
    expect(renderMolecule(v)).toBe(renderMolecule(v))
  })

  it("draws every molecule at one scale, so a small one stays small", () => {
    const width = (svg: string) => Number(/width="(\d+)"/.exec(svg)![1])
    expect(width(renderMolecule(molecule("O")))).toBeLessThan(
      width(renderMolecule(molecule("CN1C=NC2=C1C(=O)N(C(=O)N2C)C"))) / 2
    )
  })

  it("labels every carbon and hydrogen in a full drawing", () => {
    const labels = (svg: string) =>
      [...svg.matchAll(/>([A-Z][a-z]?)<\/text>/g)].map((m) => m[1]).sort()
    expect(labels(renderMolecule(molecule("CCO")))).toEqual(["H", "O"])
    expect(labels(renderMolecule(molecule("CCO", { style: "full" })))).toEqual([
      "C",
      "C",
      "H",
      "H",
      "H",
      "H",
      "H",
      "H",
      "O",
    ])
  })

  it("names the carbon of O=C=O instead of drawing it as a dot", () => {
    expect(renderMolecule(molecule("O=C=O"))).toContain(">C</text>")
  })

  it("marks highlighted groups with a halo behind the drawing", () => {
    const plain = renderMolecule(molecule("CC(=O)O"))
    const marked = renderMolecule(
      molecule("CC(=O)O", { highlight: ["C(=O)[OH]"] })
    )
    expect(plain).not.toContain("var(--chart-2)")
    const halo =
      /<g fill="[^"]*var\(--chart-2\)[^"]*"[^>]*>(.*?)<\/g>/.exec(
        marked
      )?.[1] ?? ""
    // The carboxyl's carbon and two oxygens, and the two bonds between them.
    expect(halo.match(/<circle/g)).toHaveLength(3)
    expect(halo.match(/<line/g)).toHaveLength(2)
    expect(marked.indexOf("<g")).toBeLessThan(marked.indexOf("<text"))
  })

  it("keeps the hydrogen of a highlighted hydroxyl in a full drawing", () => {
    const svg = renderMolecule(
      molecule("CCO", { style: "full", highlight: ["[OX2H]"] })
    )
    const halo = /<g fill=[^>]*>(.*?)<\/g>/.exec(svg)?.[1] ?? ""
    expect(halo.match(/<circle/g)).toHaveLength(2)
  })
})

describe("checkMolecule", () => {
  it("accepts molecules, ions, and highlights that match", () => {
    expect(messages(molecule("CCO", { highlight: ["[OX2H]"] }))).toEqual([])
    expect(messages(molecule("[Na+].[Cl-]"))).toEqual([])
    expect(messages(molecule("c1cc[nH]c1"))).toEqual([])
    expect(messages(molecule("[CH3]"))).toEqual([])
    expect(
      messages(
        molecule("CC(=O)Oc1ccccc1C(=O)O", {
          highlight: ["C(=O)O[#6]", "c1ccccc1"],
        })
      )
    ).toEqual([])
  })

  it("says where a SMILES stops reading", () => {
    expect(messages(molecule("C1CC"))).toEqual([
      expect.stringMatching(
        /^smiles: The SMILES can't be read: Dangling ring closure: 1 at character 5 of "C1CC"\./
      ),
    ])
    expect(messages(molecule("CXC"))[0]).toMatch(/at character 2 of "CXC"/)
  })

  it("rejects an atom with more bonds than it can make", () => {
    expect(messages(molecule("C(C)(C)(C)(C)C"))).toEqual([
      expect.stringMatching(/^smiles: An atom of C has 5 bonds/),
    ])
  })

  it("rejects an aromatic ring that can't alternate double bonds", () => {
    expect(messages(molecule("c1cccc1"))).toEqual([
      expect.stringMatching(/\[nH\]/),
    ])
    // Explicit hydrogens move to the end of OpenChemLib's atoms, which mustn't hide the ring.
    expect(messages(molecule("[H]N([H])c1cccn1"))).toEqual([
      expect.stringMatching(/\[nH\]/),
    ])
    // A free electron written in brackets is meant: the benzyl radical.
    expect(messages(molecule("[H]c1ccccc1[CH2]"))).toEqual([])
    expect(messages(molecule("[H]N([H])c1ccc[nH]1"))).toEqual([])
  })

  it("rejects a molecule too big to read on a phone", () => {
    const chain = (n: number) => "C".repeat(n)
    expect(messages(molecule(chain(MOLECULE_ATOMS.skeletal + 1)))[0]).toMatch(
      /61 atoms besides hydrogen/
    )
    expect(messages(molecule(chain(MOLECULE_ATOMS.full)))).toEqual([])
    expect(
      messages(molecule(chain(MOLECULE_ATOMS.full + 1), { style: "full" }))[0]
    ).toMatch(/Leave "style" out/)
  })

  it("rejects a highlight that can't be read or matches nothing", () => {
    expect(
      messages(molecule("CCO", { highlight: ["[OX2H]", "C(=O)O", "[C"] }))
    ).toEqual([
      expect.stringMatching(
        /^highlight\[1\]: The pattern "C\(=O\)O" matches nothing in "CCO"/
      ),
      expect.stringMatching(
        /^highlight\[2\]: The SMARTS pattern can't be read/
      ),
    ])
  })
})
