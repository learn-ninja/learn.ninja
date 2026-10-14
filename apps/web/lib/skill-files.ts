import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

// The skill in the repo's skills/learn/ folder, served at /.well-known/skills/ so that
// `npx skills add https://learn.ninja` installs it (the "well-known skills" index, v1).

const SKILL_NAME = "learn"
const SKILL_DIR = path.join(process.cwd(), "../../skills", SKILL_NAME)

/** Every file in the skill, as paths relative to its folder, e.g. "reference/lesson-format.md". */
export function skillFiles(dir = SKILL_DIR, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("."))
    .flatMap((e) =>
      e.isDirectory()
        ? skillFiles(path.join(dir, e.name), `${prefix}${e.name}/`)
        : [`${prefix}${e.name}`]
    )
    .sort()
}

export function readSkillFile(file: string): Buffer {
  return readFileSync(path.join(SKILL_DIR, file))
}

/** The index the `skills` CLI reads first: the skill's name, description, and files. */
export function skillIndex() {
  const skillMd = readSkillFile("SKILL.md").toString("utf8")
  const description = /^description:\s*(.+)$/m.exec(skillMd)?.[1]?.trim() ?? ""
  return {
    skills: [{ name: SKILL_NAME, description, files: skillFiles() }],
  }
}

export const SKILL_ROUTE_NAME = SKILL_NAME

/**
 * The files `learn sync` downloads into a project's .learn/skill/: the steps, guides, levels,
 * and schema. Never the CLI (code stays with the install) and not SKILL.md (the short installed
 * bootstrap, which is what points at the synced copy).
 */
export function syncedFiles(): string[] {
  return skillFiles().filter(
    (f) => f !== "SKILL.md" && !f.startsWith("scripts/")
  )
}

/** Every synced file's text, with a hash of the lot so a CLI can tell whether its copy is current. */
export function skillBundle() {
  const files: Record<string, string> = {}
  const hash = createHash("sha256")
  for (const f of syncedFiles()) {
    files[f] = readSkillFile(f).toString("utf8")
    hash.update(f).update("\0").update(files[f]).update("\0")
  }
  return { hash: hash.digest("hex").slice(0, 16), files }
}

const TYPES: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
}

export const contentTypeFor = (file: string) =>
  TYPES[path.extname(file)] ?? "text/plain; charset=utf-8"
