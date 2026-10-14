/* global console */
// Assembles skills/learn for distribution (`npx skills add https://learn.ninja`, served by apps/web):
// bundles the CLI into one dependency-free file and copies in the JSON Schema.
// Run: npm run skill:build -w @workspace/cli (a test fails if skills/learn is out of date).
import { chmodSync, copyFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "esbuild"

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..")
const skill = join(root, "skills/learn")
const script = join(skill, "scripts/learn.mjs")

await build({
  entryPoints: [join(root, "packages/cli/src/index.ts")],
  outfile: script,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  minify: true,
  legalComments: "none",
  banner: {
    js: "#!/usr/bin/env node\n// Lesson checker and publisher, bundled from packages/cli. Don't edit; run `npm run skill:build -w @workspace/cli`.",
  },
  logLevel: "warning",
})
chmodSync(script, 0o755)

mkdirSync(join(skill, "schema"), { recursive: true })
copyFileSync(
  join(root, "packages/spec/schema/lesson.schema.json"),
  join(skill, "schema/lesson.schema.json")
)

console.log("Built skills/learn")
