// Builds public/lesson-visuals.css: the shared base stylesheet HTML lesson visuals load inside their
// sandbox. Basecoat (Vega style, like the app's shadcn components) + the app's theme tokens, so visuals and
// the player look the same. Each lesson's Tailwind utilities are compiled separately by prepareLesson().

import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const web = join(dirname(fileURLToPath(import.meta.url)), "..")
const globals = readFileSync(
  join(web, "../../packages/ui/src/styles/globals.css"),
  "utf8"
)

/** The full text of the first top-level block that starts with `selector {`. */
function block(selector) {
  const start = globals.indexOf(`${selector} {`)
  if (start === -1)
    throw new Error(`Couldn't find "${selector} {" in packages/ui globals.css`)
  let depth = 0
  for (let i = globals.indexOf("{", start); i < globals.length; i++) {
    if (globals[i] === "{") depth++
    if (globals[i] === "}" && --depth === 0) return globals.slice(start, i + 1)
  }
  throw new Error(`Unclosed "${selector}" block`)
}

const outDir = join(web, ".visuals")
mkdirSync(outDir, { recursive: true })

const input = `@import "tailwindcss" source(none);
@import "basecoat-css/vega";

/* Theme tokens copied from packages/ui/src/styles/globals.css (they override Basecoat's defaults) */
${block("@theme inline")}
${block(":root")}
${block(".dark")}

html, body { background: transparent; color: var(--foreground); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }

/* A visual is a still picture with no scripts. Overlays that normally float above a page (an open
   dialog, a toast, an open menu or select, a tooltip) sit in the layout instead, so the player measures
   them and shows them whole. Same layer as Basecoat, so a lesson's own utilities still win. */
@layer components {
  .dialog[open], .alert-dialog[open] {
    position: static; display: block; margin: 0; width: 100%; max-width: 28rem; opacity: 1;
  }
  .alert-dialog[open] { max-width: 32rem; }
  .dialog[open] > *, .alert-dialog[open] > * {
    position: relative; inset: auto; translate: none; scale: none; max-width: none;
  }
  /* Frames are narrower than Basecoat's sm breakpoint; show the desktop layout people know. */
  .dialog[open] > * > footer, .alert-dialog[open] > * > footer { flex-direction: row; justify-content: flex-end; }
  .alert-dialog[open] > * > header { place-items: start; text-align: start; }

  .toaster { position: static; translate: none; padding: 0; max-width: 22.5rem; }
  .toaster .toast { animation: none; }

  :has(> [data-popover]:not([aria-hidden='true'])) {
    display: inline-flex; flex-direction: column; align-items: flex-start; gap: 0.25rem;
  }
  :has(> [data-popover][data-side='top']:not([aria-hidden='true'])) { flex-direction: column-reverse; }
  [data-popover]:not([aria-hidden='true']) { position: static; margin: 0; }

  [data-tooltip]::before { visibility: visible; opacity: 1; scale: none; }
  [data-tooltip]:is(:not([data-side]), [data-side='top'])::before,
  [data-tooltip][data-side='bottom']::before { --tw-translate-y: 0; }
  [data-tooltip]:is(:not([data-side]), [data-side='top']) { margin-block-start: 2.5rem; }
  [data-tooltip][data-side='bottom'] { margin-block-end: 2.5rem; }
}
`

const inputPath = join(outDir, "lesson-visuals.css")
writeFileSync(inputPath, input)
// The Tailwind 4 CLI by its own path: `npx @tailwindcss/cli` runs whichever `tailwindcss` bin npm
// hoisted, and that's Tailwind 3 since the app (apps/mobile) needs it for NativeWind.
const tailwindCli = join(
  dirname(createRequire(import.meta.url).resolve("@tailwindcss/cli/package.json")),
  "dist/index.mjs"
)
execFileSync(
  process.execPath,
  [
    tailwindCli,
    "-i",
    inputPath,
    "-o",
    join(web, "public/lesson-visuals.css"),
    "--minify",
  ],
  {
    cwd: web,
    stdio: "inherit",
  }
)
