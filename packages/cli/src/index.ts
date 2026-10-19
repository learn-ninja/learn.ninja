import { homedir, hostname } from "node:os"
import { dirname, join } from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

import { run } from "./cli"

// Entry point. In the skill bundle this file sits at scripts/learn.mjs, inside the installed skill's folder.
const here = dirname(fileURLToPath(import.meta.url))

// Questions (`login`) only when a person is at the terminal; an agent's shell gets flags instead.
const prompt =
  process.stdin.isTTY && process.stdout.isTTY
    ? async (question: string) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout })
        try {
          return await rl.question(question)
        } finally {
          rl.close()
        }
      }
    : undefined

const code = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  fetch,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  skillDir: join(here, ".."),
  configDir: process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  prompt,
  hostname: hostname(),
})
process.exit(code)
