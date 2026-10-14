import { existsSync } from "node:fs"
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

import {
  formatIssues,
  SPEC_VERSION,
  validateLesson,
  type Issue,
} from "@workspace/spec"

// The command the lesson skill runs: sync the guides, validate a lesson file, publish it, or update it.
// Bundled into skills/learn/scripts/learn.mjs, so the skill works without installing anything.
//
// The guides and checker rules live on learn.ninja and change often, so `sync` downloads
// the current guides into .learn/skill/ (text only, never code), and `validate` checks the lesson on the
// server. The copies that came with the install are the fallback when the server can't be reached.

export const SKILL_VERSION = "0.9.0"
export const DEFAULT_API_URL = "https://learn.ninja"
/** Where `sync` puts the guides, relative to the current folder. */
export const SYNC_DIR = ".learn/skill"
const HASH_FILE = ".hash"

export interface Io {
  cwd: string
  env: Record<string, string | undefined>
  fetch: typeof fetch
  out: (line: string) => void
  err: (line: string) => void
  /** The installed skill's folder (the one SKILL.md is in), for the bundled guides and schema. */
  skillDir: string
}

interface SavedLesson {
  id: string
  url: string
  editToken: string
  expiresAt: string
}

interface State {
  lessons: Record<string, SavedLesson>
}

/** GET /api/skill/version: what the server serves, and the oldest CLI it works with. */
interface Manifest {
  version: string
  minVersion: string
  updateCommand: string
  hash: string
}

/** GET /api/skill: the manifest plus every synced file's text. */
interface Bundle extends Manifest {
  files: Record<string, string>
}

const HELP = `learn ${SKILL_VERSION}: check and publish interactive lessons (spec ${SPEC_VERSION})

Usage:
  learn sync                         Download the current guides into ${SYNC_DIR}/
  learn validate <lesson.json>       Check a lesson against the spec and print every issue
  learn publish <lesson.json>        Check, then publish (or update the same link if published before)
  learn publish <lesson.json> --new  Publish as a new lesson with a new link
  learn schema                       Print the path to the lesson JSON Schema

Options:
  --api <url>   Server to use (default: $LEARN_API_URL or ${DEFAULT_API_URL})
  --json        Print machine-readable JSON instead of text`

export async function run(argv: string[], io: Io): Promise<number> {
  const args = argv.filter((a) => !a.startsWith("--"))
  const flags = new Set(argv.filter((a) => a.startsWith("--")))
  const apiIndex = argv.indexOf("--api")
  const api = (
    (apiIndex >= 0 ? argv[apiIndex + 1] : undefined) ??
    io.env.LEARN_API_URL ??
    DEFAULT_API_URL
  ).replace(/\/+$/, "")
  if (apiIndex >= 0) args.splice(args.indexOf(argv[apiIndex + 1]!), 1)
  const json = flags.has("--json")
  const [command, file] = args

  if (flags.has("--version") || command === "version") {
    io.out(SKILL_VERSION)
    return 0
  }
  if (!command || flags.has("--help") || command === "help") {
    io.out(HELP)
    return command ? 0 : 1
  }
  if (command === "schema") {
    const synced = join(io.cwd, SYNC_DIR, "schema/lesson.schema.json")
    io.out(
      existsSync(synced)
        ? synced
        : join(io.skillDir, "schema/lesson.schema.json")
    )
    return 0
  }
  if (command === "sync") return sync(io, api, json)
  if (command !== "validate" && command !== "publish") {
    io.err(`Unknown command "${command}".\n\n${HELP}`)
    return 1
  }
  if (!file) {
    io.err(`Give the lesson file: learn ${command} <lesson.json>`)
    return 1
  }

  const path = resolve(io.cwd, file)
  let text: string
  try {
    text = await readFile(path, "utf8")
  } catch {
    io.err(`Couldn't read ${file}.`)
    return 1
  }

  // Keep the guides current even when the agent skipped `sync`: a cheap check, and a download only
  // when they changed. The lesson at hand was written already; the next one gets the new guides.
  await refreshGuides(io, api)

  if (command === "validate") return validate(io, { api, file, text, json })
  return publish(io, {
    api,
    path,
    file,
    text,
    json,
    forceNew: flags.has("--new"),
  })
}

// --- sync ---

async function sync(io: Io, api: string, json: boolean): Promise<number> {
  const dir = join(io.cwd, SYNC_DIR)
  const fallback = existsSync(join(dir, "steps.md"))
    ? `${SYNC_DIR}/steps.md (from your last sync)`
    : `${join(io.skillDir, "steps.md")} (the copy that came with the install)`

  let manifest: Manifest
  try {
    manifest = await fetchJson<Manifest>(io, `${api}/api/skill/version`)
  } catch (e) {
    report(
      io,
      json,
      { ok: false, error: "offline", message: (e as Error).message, fallback },
      () =>
        `Couldn't reach ${api}: ${(e as Error).message}\nFollow the guides already here instead: ${fallback}`
    )
    return 1
  }

  if (compareVersions(SKILL_VERSION, manifest.minVersion) < 0) {
    report(
      io,
      json,
      {
        ok: false,
        error: "skill_too_old",
        version: SKILL_VERSION,
        minVersion: manifest.minVersion,
        updateCommand: manifest.updateCommand,
      },
      () =>
        `This copy of the lesson skill (${SKILL_VERSION}) is too old for the current guides. Update it, then try again:\n${manifest.updateCommand}`
    )
    return 1
  }

  const current = await readHash(dir)
  let synced = false
  let count = 0
  if (current !== manifest.hash) {
    let bundle: Bundle
    try {
      bundle = await fetchJson<Bundle>(io, `${api}/api/skill`)
    } catch (e) {
      report(
        io,
        json,
        {
          ok: false,
          error: "offline",
          message: (e as Error).message,
          fallback,
        },
        () =>
          `Couldn't download the guides from ${api}: ${(e as Error).message}\nFollow the guides already here instead: ${fallback}`
      )
      return 1
    }
    count = await writeBundle(dir, bundle)
    synced = true
  }

  const skill = skillInfo(manifest)
  report(
    io,
    json,
    {
      ok: true,
      synced,
      hash: manifest.hash,
      dir: SYNC_DIR,
      files: count,
      skill,
    },
    () =>
      [
        synced
          ? `Synced ${count} files to ${SYNC_DIR}/.`
          : `The guides in ${SYNC_DIR}/ are up to date.`,
        `Start with ${SYNC_DIR}/steps.md.`,
        updateLine(skill),
      ]
        .filter(Boolean)
        .join("\n")
  )
  return 0
}

/** The check `validate` and `publish` run first: quiet, and only a download when the guides changed. */
async function refreshGuides(io: Io, api: string) {
  try {
    const manifest = await fetchJson<Manifest>(io, `${api}/api/skill/version`)
    if (compareVersions(SKILL_VERSION, manifest.minVersion) < 0) {
      io.err(
        `This copy of the lesson skill (${SKILL_VERSION}) is too old for the current guides. Update it before the next lesson: ${manifest.updateCommand}`
      )
      return
    }
    const dir = join(io.cwd, SYNC_DIR)
    if ((await readHash(dir)) === manifest.hash) return
    const bundle = await fetchJson<Bundle>(io, `${api}/api/skill`)
    await writeBundle(dir, bundle)
    io.err(
      `Updated the guides in ${SYNC_DIR}/: they changed since your last sync.`
    )
  } catch {
    // Offline, or the server had a bad moment: the lesson at hand doesn't depend on this.
  }
}

async function fetchJson<T>(io: Io, url: string, init?: RequestInit) {
  const response = await io.fetch(url, {
    ...init,
    headers: { ...init?.headers, "x-learn-skill-version": SKILL_VERSION },
  })
  const body = (await response.json().catch(() => null)) as
    ({ ok: boolean; message?: string } & T) | null
  if (!response.ok || !body?.ok)
    throw new Error(body?.message ?? `HTTP ${response.status}`)
  return body
}

async function readHash(dir: string) {
  return readFile(join(dir, HASH_FILE), "utf8")
    .then((h) => h.trim())
    .catch(() => null)
}

/** Writes the bundle next to the old copy first, then swaps, so a dropped connection never leaves half the files. */
async function writeBundle(dir: string, bundle: Bundle) {
  const names = Object.keys(bundle.files).filter(
    (f) => !f.split("/").some((part) => part === ".." || part === "")
  )
  const tmp = `${dir}.tmp`
  await rm(tmp, { recursive: true, force: true })
  for (const name of names) {
    const path = join(tmp, name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, bundle.files[name]!)
  }
  await writeFile(join(tmp, HASH_FILE), bundle.hash + "\n")
  await ensureGitignore(dirname(dir))
  await rm(dir, { recursive: true, force: true })
  await rename(tmp, dir)
  return names.length
}

/** .learn/ holds edit tokens and downloaded guides: neither belongs in the user's repo. */
async function ensureGitignore(learnDir: string) {
  const path = join(learnDir, ".gitignore")
  if (existsSync(path)) return
  await mkdir(learnDir, { recursive: true })
  await writeFile(path, "*\n")
}

// --- validate ---

async function validate(
  io: Io,
  o: { api: string; file: string; text: string; json: boolean }
): Promise<number> {
  let response: Response
  try {
    response = await io.fetch(`${o.api}/api/validate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-learn-skill-version": SKILL_VERSION,
      },
      body: o.text,
    })
  } catch (e) {
    return validateOffline(
      io,
      o,
      `couldn't reach ${o.api}: ${(e as Error).message}`
    )
  }
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  // Rate-limited or a server fault: the bundled rules are better than no answer.
  if (response.status === 429 || response.status >= 500)
    return validateOffline(
      io,
      o,
      (body.message as string) ?? `the server replied HTTP ${response.status}`
    )

  if (!response.ok || !body.ok) {
    const issues = body.issues as Issue[] | undefined
    report(io, o.json, body, () =>
      [
        issues?.length ? issuesText(issues) : null,
        issues?.length ? null : (body.message as string),
      ]
        .filter(Boolean)
        .join("\n")
    )
    return 1
  }
  const skill = body.skill as SkillInfo | undefined
  report(io, o.json, body, () =>
    [
      `✓ ${o.file} is a valid lesson (spec ${body.spec as string}).`,
      updateLine(skill),
    ]
      .filter(Boolean)
      .join("\n")
  )
  return 0
}

function validateOffline(
  io: Io,
  o: { file: string; text: string; json: boolean },
  why: string
): number {
  const note = `Checked offline with the bundled rules (${why}); the server's rules may be newer.`
  const result = validateLesson(o.text)
  if (!result.ok) {
    report(
      io,
      o.json,
      {
        ok: false,
        error: "invalid_lesson",
        issues: result.issues,
        offline: why,
      },
      () => `${issuesText(result.issues)}\n${note}`
    )
    return 1
  }
  report(
    io,
    o.json,
    { ok: true, spec: SPEC_VERSION, offline: why },
    () => `✓ ${o.file} is a valid lesson (spec ${SPEC_VERSION}).\n${note}`
  )
  return 0
}

// --- publish ---

async function publish(
  io: Io,
  o: {
    api: string
    path: string
    file: string
    text: string
    json: boolean
    forceNew: boolean
  }
): Promise<number> {
  const statePath = join(io.cwd, ".learn", "state.json")
  const state = await readState(statePath)
  const saved = o.forceNew ? undefined : state.lessons[o.path]
  const live =
    saved && Date.parse(saved.expiresAt) > Date.now() ? saved : undefined
  const headers = {
    "content-type": "application/json",
    "x-learn-skill-version": SKILL_VERSION,
  }

  let response: Response
  try {
    response = live
      ? await io.fetch(`${o.api}/api/lessons/${live.id}`, {
          method: "PUT",
          headers: { ...headers, authorization: `Bearer ${live.editToken}` },
          body: o.text,
        })
      : await io.fetch(`${o.api}/api/lessons`, {
          method: "POST",
          headers,
          body: o.text,
        })
  } catch (e) {
    io.err(
      `Couldn't reach the publish API at ${o.api}: ${(e as Error).message}`
    )
    return 1
  }

  // The saved lesson expired on the server, or its token no longer works: publish a new one instead.
  if (live && (response.status === 404 || response.status === 401)) {
    delete state.lessons[o.path]
    await writeState(statePath, state)
    return publish(io, { ...o, forceNew: true })
  }

  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  if (!response.ok || !body.ok) {
    const issues = body.issues as Issue[] | undefined
    report(io, o.json, body, () =>
      [
        issues?.length ? issuesText(issues) : null,
        (body.message as string) ??
          `Publishing failed (HTTP ${response.status}).`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    return 1
  }

  const record: SavedLesson = {
    id: body.id as string,
    url: body.url as string,
    editToken: (body.editToken as string | undefined) ?? live!.editToken,
    expiresAt: body.expiresAt as string,
  }
  state.lessons[o.path] = record
  await writeState(statePath, state)

  const skill = body.skill as SkillInfo | undefined
  report(
    io,
    o.json,
    {
      ok: true,
      updated: Boolean(live),
      url: record.url,
      expiresAt: record.expiresAt,
      skill,
    },
    () =>
      [
        `${live ? "Updated" : "Published"}: ${record.url}`,
        `Expires: ${new Date(record.expiresAt).toUTCString()} (24 hours after first publish).`,
        `Saved the edit token in .learn/state.json, so publishing ${o.file} again updates this same link.`,
        updateLine(skill),
      ]
        .filter(Boolean)
        .join("\n")
  )
  return 0
}

// --- shared ---

interface SkillInfo {
  latest?: string
  updateAvailable?: boolean
  updateCommand?: string
}

function skillInfo(manifest: Manifest): SkillInfo {
  const updateAvailable = compareVersions(SKILL_VERSION, manifest.version) < 0
  return {
    latest: manifest.version,
    updateAvailable,
    ...(updateAvailable ? { updateCommand: manifest.updateCommand } : {}),
  }
}

function updateLine(skill: SkillInfo | undefined) {
  return skill?.updateAvailable
    ? `A newer version of the lesson skill is available. Run: ${skill.updateCommand}`
    : null
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

function issuesText(issues: Issue[]): string {
  return `✗ ${issues.length} issue${issues.length === 1 ? "" : "s"} to fix:\n${formatIssues(issues)}`
}

function report(io: Io, json: boolean, data: unknown, text: () => string) {
  const ok = (data as { ok?: boolean }).ok
  if (json) (ok ? io.out : io.err)(JSON.stringify(data, null, 2))
  else (ok ? io.out : io.err)(text())
}

async function readState(path: string): Promise<State> {
  try {
    const state = JSON.parse(await readFile(path, "utf8")) as State
    return { lessons: state.lessons ?? {} }
  } catch {
    return { lessons: {} }
  }
}

async function writeState(path: string, state: State) {
  await mkdir(dirname(path), { recursive: true })
  await ensureGitignore(dirname(path))
  await writeFile(path, JSON.stringify(state, null, 2) + "\n")
  await chmod(path, 0o600)
}
