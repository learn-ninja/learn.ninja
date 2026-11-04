import "server-only"

import { Molecule, SmilesParser, SSSearcher } from "openchemlib"

import type { MoleculeVisual } from "@workspace/spec"

// Server-only: lays out and draws a lesson's molecules with OpenChemLib, once per lesson, so the
// learner's browser loads no chemistry library. OpenChemLib draws the structural formula (bonds
// shortened at labels, double bonds inside rings, wedges); the SVG is then recolored to the theme's
// tokens, so one drawing serves light and dark, and highlighted groups get a halo behind them.

/** The most atoms (hydrogens aside) a molecule can have and still read on a phone. */
export const MOLECULE_ATOMS = { skeletal: 60, full: 16 } as const

/** How much larger than OpenChemLib's own size the drawing is shown: bonds about 30px, labels 17px. */
const SCALE = 1.25

const smilesParser = new SmilesParser({ noCactvs: true })
const smartsParser = new SmilesParser({ smartsMode: "smarts", noCactvs: true })

/** OpenChemLib's error, without its class name, and where in the text it is ("at character 3"). */
function parseError(error: unknown, text: string): string {
  const raw = String((error as Error)?.message ?? error)
    .replace(/^.*?SmilesParser:\s*/, "")
    .replace(/'\0'/g, "the end")
    .replace(/[.;]?\s*position:\s*\d+\s*$/i, "")
    .trim()
  const at = /position:\s*(\d+)/i.exec(String((error as Error)?.message))
  const where = at ? ` at character ${Number(at[1]) + 1} of "${text}"` : ""
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}${where}`
}

/**
 * The SMILES with every atom written in brackets ("[NH4+]") given an atom map number, so it can be
 * told from a bare one ("C", "c", "Cl") after OpenChemLib reorders the atoms (it moves hydrogens
 * like "[H]" to the end). An atom that already has a number keeps it.
 */
const markBracketed = (smiles: string) =>
  // `[` is excluded too: a bracket atom never contains one, and letting a match run past the next
  // `[` made "[9[9[9…" backtrack quadratically.
  smiles.replace(/\[([^\][:]*)\]/g, "[$1:1]")

/** Reads a SMILES, laid out the same way every time. */
function readSmiles(
  smiles: string,
  coordinates = true
): Molecule | { error: string } {
  try {
    smilesParser.setRandomSeed(1)
    return smilesParser.parseMolecule(smiles.trim(), {
      noCoordinates: !coordinates,
    })
  } catch (error) {
    return { error: parseError(error, smiles) }
  }
}

/** The atoms each highlight pattern matches, or the pattern's problem. */
function matchPattern(
  pattern: string,
  molecule: Molecule
): number[] | { error: string } {
  let fragment: Molecule
  try {
    fragment = smartsParser.parseMolecule(pattern, { noCoordinates: true })
  } catch (error) {
    return { error: parseError(error, pattern) }
  }
  fragment.setFragment(true)
  const searcher = new SSSearcher()
  searcher.setMol(fragment, molecule)
  if (!searcher.findFragmentInMolecule({ countMode: "overlapping" })) return []
  return [...new Set(searcher.getMatchList().flat())]
}

/** What's wrong with a molecule visual, each problem with the field it's in. */
export function checkMolecule(
  visual: MoleculeVisual
): { field: string; message: string }[] {
  const molecule = readSmiles(visual.smiles, false)
  if ("error" in molecule)
    return [
      {
        field: "smiles",
        message: `The SMILES can't be read: ${molecule.error}. Check its brackets, ring numbers, and element symbols ("Cl", "Br", and "[Na+]" in brackets).`,
      },
    ]
  const atoms = molecule.getAtoms()
  if (atoms === 0)
    return [{ field: "smiles", message: "The SMILES has no atoms to draw." }]
  const style = visual.style ?? "skeletal"
  const limit = MOLECULE_ATOMS[style]
  if (atoms > limit)
    return [
      {
        field: "smiles",
        message:
          style === "full"
            ? `This molecule has ${atoms} atoms besides hydrogen; a "full" drawing with every hydrogen reads on a phone up to ${limit}. Leave "style" out for a skeletal formula, or draw a smaller molecule.`
            : `This molecule has ${atoms} atoms besides hydrogen, more than the ${limit} that read on a phone. Draw the part the lesson is about.`,
      },
    ]

  const out: { field: string; message: string }[] = []
  molecule.ensureHelperArrays(Molecule.cHelperRings)
  for (let a = 0; a < atoms; a++) {
    if (molecule.getFreeValence(a) < 0) {
      out.push({
        field: "smiles",
        message: `An atom of ${molecule.getAtomLabel(a)} has ${molecule.getOccupiedValence(a)} bonds, more than it can make. Check the bonds around it, and give an ion its charge in brackets ("[NH4+]", "[O-]").`,
      })
      break
    }
  }
  // An atom written without brackets takes as many hydrogens as it needs, so a free electron on
  // one means its aromatic ring couldn't be given alternating double bonds.
  const marked = out.length
    ? null
    : readSmiles(markBracketed(visual.smiles), false)
  if (marked && !("error" in marked))
    for (let a = 0; a < marked.getAllAtoms(); a++)
      if (marked.getAtomRadical(a) && !marked.getAtomMapNo(a)) {
        out.push({
          field: "smiles",
          message: `An aromatic ring (lowercase atoms) can't be drawn with alternating double bonds. Check its atoms: a ring nitrogen with a hydrogen is "[nH]", as in pyrrole, "c1cc[nH]c1".`,
        })
        break
      }
  visual.highlight?.forEach((pattern, i) => {
    const matched = matchPattern(pattern, molecule)
    if ("error" in matched)
      out.push({
        field: `highlight[${i}]`,
        message: `The SMARTS pattern can't be read: ${matched.error}.`,
      })
    else if (!matched.length)
      out.push({
        field: `highlight[${i}]`,
        message: `The pattern "${pattern}" matches nothing in "${visual.smiles}". Write it with the same atoms and bonds as the SMILES (aromatic atoms lowercase), or leave it out.`,
      })
  })
  return out
}

/** Theme colors for what OpenChemLib draws in black, and for its element colors (O red, N blue). */
const INK = "var(--foreground)"
const elementColor = (rgb: string) =>
  `color-mix(in oklab, ${rgb} 70%, var(--foreground))`
const HALO = "color-mix(in oklab, var(--chart-2) 25%, var(--background))"

/** The molecule as an SVG string in theme tokens. Throws on a SMILES checkMolecule() rejects. */
export function renderMolecule(visual: MoleculeVisual): string {
  const full = visual.style === "full"
  const read = readSmiles(visual.smiles, !full)
  if ("error" in read) throw new Error(read.error)
  const molecule = read

  // Highlights are matched before hydrogens are added, so "[OH]" reads as it does in the SMILES.
  // Hydrogens come after the other atoms, so the matched atoms keep their numbers.
  const marked = new Set<number>()
  for (const pattern of visual.highlight ?? []) {
    const matched = matchPattern(pattern, molecule)
    if (!("error" in matched)) matched.forEach((a) => marked.add(a))
  }
  if (full) {
    molecule.addImplicitHydrogens()
    // A custom label of "]" (an empty superscript) makes OpenChemLib print the C.
    for (let a = 0; a < molecule.getAllAtoms(); a++)
      if (molecule.getAtomicNo(a) === 6) molecule.setAtomCustomLabel(a, "]")
    molecule.inventCoordinates({ keepHydrogens: true })
  } else {
    // A carbon between two double bonds (O=C=O) would be drawn as a dot; it reads better named.
    molecule.ensureHelperArrays(Molecule.cHelperRings)
    for (let a = 0; a < molecule.getAtoms(); a++)
      if (
        molecule.getAtomicNo(a) === 6 &&
        molecule.getConnAtoms(a) === 2 &&
        molecule.getAtomPi(a) === 2 &&
        molecule.getConnBondOrder(a, 0) === 2
      )
        molecule.setAtomCustomLabel(a, "]")
  }
  molecule.ensureHelperArrays(Molecule.cHelperNeighbours)
  // In a full drawing, a highlighted group keeps its hydrogens (the H of -OH), but not a carbon's.
  if (full)
    for (const a of [...marked])
      if (molecule.getAtomicNo(a) !== 6)
        for (let i = 0; i < molecule.getAllConnAtoms(a); i++) {
          const n = molecule.getConnAtom(a, i)
          if (molecule.getAtomicNo(n) === 1) marked.add(n)
        }

  const svg = molecule.toSVG(400, 400, "m", {
    autoCrop: true,
    autoCropMargin: 12,
    suppressChiralText: true,
    suppressCIPParity: true,
    suppressESR: true,
    noStereoProblem: true,
  })

  // Where OpenChemLib put each atom, from the invisible circles it draws for pointer events.
  const at = new Map<number, [number, number]>()
  for (const m of svg.matchAll(
    /id="m:Atom:(\d+)"[^>]*?cx="([-\d.]+)" cy="([-\d.]+)"/g
  ))
    at.set(Number(m[1]), [Number(m[2]), Number(m[3])])
  let halo = ""
  for (let b = 0; b < molecule.getAllBonds(); b++) {
    const a1 = molecule.getBondAtom(0, b)
    const a2 = molecule.getBondAtom(1, b)
    const p1 = at.get(a1)
    const p2 = at.get(a2)
    if (marked.has(a1) && marked.has(a2) && p1 && p2)
      halo += `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}"/>`
  }
  for (const a of marked) {
    const p = at.get(a)
    if (p) halo += `<circle cx="${p[0]}" cy="${p[1]}" r="9"/>`
  }

  const size = /width="([\d.]+)px" height="([\d.]+)px" viewBox="([^"]+)"/.exec(
    svg
  )
  if (!size) throw new Error("OpenChemLib drew no SVG.")
  const width = Math.round(Number(size[1]) * SCALE)
  const height = Math.round(Number(size[2]) * SCALE)
  const body = svg
    .replace(/^[\s\S]*?<\/style>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/\s*<(?:circle|line)[^>]*class="event"[^>]*\/>/g, "")
    .replace(/(stroke|fill)="rgb\(0,0,0\)"/g, `$1="${INK}"`)
    .replace(/fill="(rgb\([\d,]+\))"/g, (_, rgb: string) => {
      return `fill="${elementColor(rgb)}"`
    })
    .replace(/ stroke="none"/g, "")
    .replace(/<text[^>]*><\/text>/g, "")
    .replace(/\n\s*/g, "")
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${size[3]}" aria-hidden="true" font-family="inherit" font-weight="500" stroke-linecap="round" stroke-linejoin="round">` +
    (halo
      ? `<g fill="${HALO}" stroke="${HALO}" stroke-width="16">${halo}</g>`
      : "") +
    body +
    `</svg>`
  )
}
