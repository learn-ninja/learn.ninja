import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

import {
  formatIssues,
  SPEC_VERSION,
  validateLesson,
  type Issue,
} from "@workspace/spec"

// The command the lesson skill runs: validate a lesson file, publish it, or update it.
// Bundled into skills/learn/scripts/learn.mjs, so the skill works without installing anything.

export const SKILL_VERSION = "0.3.1"
export const DEFAULT_API_URL = "https://learn.ninja"

export interface Io {
  cwd: string
  env: Record<string, string | undefined>
  fetch: typeof fetch
  out: (line: string) => void
  err: (line: string) => void
  /** Where the bundled schema lives (next to the script). */
  schemaPath: string
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

const HELP = `learn ${SKILL_VERSION}: check and publish interactive lessons (spec ${SPEC_VERSION})

Usage:
  learn validate <lesson.json>       Check a lesson against the spec and print every issue
  learn publish <lesson.json>        Check, then publish (or update the same link if published before)
  learn publish <lesson.json> --new  Publish as a new lesson with a new link
  learn schema                       Print the path to the lesson JSON Schema

Options:
  --api <url>   Publish API to use (default: $LEARN_API_URL or ${DEFAULT_API_URL})
  --json        Print machine-readable JSON instead of text`

export async function run(argv: string[], io: Io): Promise<number> {
  const args = argv.filter((a) => !a.startsWith("--"))
  const flags = new Set(argv.filter((a) => a.startsWith("--")))
  const apiIndex = argv.indexOf("--api")
  const api =
    (apiIndex >= 0 ? argv[apiIndex + 1] : undefined) ??
    io.env.LEARN_API_URL ??
    DEFAULT_API_URL
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
    io.out(io.schemaPath)
    return 0
  }
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

  const result = validateLesson(text)
  if (!result.ok) {
    report(
      io,
      json,
      { ok: false, error: "invalid_lesson", issues: result.issues },
      () => issuesText(result.issues)
    )
    return 1
  }
  if (command === "validate") {
    report(
      io,
      json,
      { ok: true, spec: SPEC_VERSION },
      () => `✓ ${file} is a valid lesson (spec ${SPEC_VERSION}).`
    )
    return 0
  }
  return publish(io, {
    api,
    path,
    file,
    text,
    json,
    forceNew: flags.has("--new"),
  })
}

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
  const base = o.api.replace(/\/+$/, "")

  let response: Response
  try {
    response = live
      ? await io.fetch(`${base}/api/lessons/${live.id}`, {
          method: "PUT",
          headers: { ...headers, authorization: `Bearer ${live.editToken}` },
          body: o.text,
        })
      : await io.fetch(`${base}/api/lessons`, {
          method: "POST",
          headers,
          body: o.text,
        })
  } catch (e) {
    io.err(`Couldn't reach the publish API at ${base}: ${(e as Error).message}`)
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

  const skill = body.skill as
    { updateAvailable?: boolean; updateCommand?: string } | undefined
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
        skill?.updateAvailable
          ? `A newer version of the lesson skill is available. Run: ${skill.updateCommand}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
  )
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
  await writeFile(path, JSON.stringify(state, null, 2) + "\n")
  await chmod(path, 0o600)
}
