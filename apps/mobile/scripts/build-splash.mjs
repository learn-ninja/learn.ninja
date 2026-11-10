// Writes the launch screen's mark (assets/images/splash-icon.png) from the site's icon
// (apps/web/app/icon.svg): the ninja on a white disc, the app icon's own shape, so opening the app
// zooms the icon into the same mark. The launch screen draws it SPLASH_SIZE points wide
// (app.config.ts), and the handoff (src/components/splash.tsx) draws this same file over it. Run it
// after changing the icon: `npm run splash -w mobile`.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const here = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(join(here, "../../web/app/icon.svg"))

// 4x the 120-point mark, so it stays sharp on every iPhone (3x) with room to grow in the handoff.
await sharp(svg, { density: 1200 })
  .resize(480, 480)
  .png()
  .toFile(join(here, "../assets/images/splash-icon.png"))
console.log("Wrote assets/images/splash-icon.png (480px)")
