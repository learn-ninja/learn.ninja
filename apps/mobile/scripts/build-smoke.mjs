// Writes the two smoke textures behind the intro (Aura in src/components/smoke.tsx) as WebP files
// in assets/smoke, taken from the web's stylesheet (packages/ui/src/styles/smoke.css, written by
// `npm run smoke -w web`), so both players draw the same smoke. Run it after the web's changes:
// `npm run smoke -w mobile`. A test fails while they differ.

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
export const SMOKE_CSS = join(here, "../../../packages/ui/src/styles/smoke.css")
export const SMOKE_DIR = join(here, "../assets/smoke")

/** Each texture's bytes, by name ("a", "b"), from the stylesheet's data URLs. */
export function smokeTextures(css = readFileSync(SMOKE_CSS, "utf8")) {
  const out = {}
  for (const [, name, data] of css.matchAll(
    /\.smoke-(\w)\s*\{\s*background-image:\s*url\("data:image\/webp;base64,([^"]+)"\)/g
  ))
    out[name] = Buffer.from(data, "base64")
  return out
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [name, bytes] of Object.entries(smokeTextures()))
    writeFileSync(join(SMOKE_DIR, `smoke-${name}.webp`), bytes)
}
