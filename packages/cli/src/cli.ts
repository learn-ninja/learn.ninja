import { existsSync } from "node:fs"
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

import {
  formatIssues,
  SPEC_VERSION,
  validateLesson,
  type Issue,
} from "@workspace/spec"

// The command the lesson skill runs: sync the guides, validate a lesson file, publish it, or update
// it; and log in, so published lessons are kept in an account instead of expiring (`keep` moves
// the ones published before logging in).
// Bundled into skills/learn/scripts/learn.mjs, so the skill works without installing anything.
//
// The guides and checker rules live on learn.ninja and change often, so `sync` downloads
// the current guides into .learn/skill/ (text only, never code), and `validate` checks the lesson on the
// server. The copies that came with the install are the fallback when the server can't be reached.

export const SKILL_VERSION = "0.19.0"
export const DEFAULT_API_URL = "https://learn.ninja"
/** Where `sync` puts the guides, relative to the current folder. */
export const SYNC_DIR = ".learn/skill"
const HASH_FILE = ".hash"
/** Where `login` keeps the API key, under the user's config folder (~/.config by default). */
export const CREDENTIALS_FILE = "learn/credentials"

export interface Io {
  cwd: string
  env: Record<string, string | undefined>
  fetch: typeof fetch
  out: (line: string) => void
  err: (line: string) => void
  /** The installed skill's folder (the one SKILL.md is in), for the bundled guides and schema. */
  skillDir: string
  /** The user's config folder (~/.config, or $XDG_CONFIG_HOME), for the credentials file. */
  configDir: string
  /** Asks the user a question on the terminal; absent when there's no terminal (an agent's shell). */
  prompt?: (question: string) => Promise<string>
  /** This machine's name, to label the API key. */
  hostname?: string
}

interface SavedLesson {
  id: string
  url: string
  editToken: string
  /** Null once the lesson is owned by an account: it no longer expires. */
  expiresAt: string | null
  /** Moves the lesson into an account (`login`); absent once claimed or for owned lessons. */
  claimToken?: string
  /** True once the server said another account owns it: nothing here can keep it, so `keep` and `login` leave it alone. */
  ownedElsewhere?: true
}

/** One logged-in server, in the credentials file. */
interface Credential {
  apiKey: string
  /** The key's id on the server, so `logout` can revoke it. */
  keyId?: string
  email: string
}

/** The credentials file: one entry per server, keyed by its URL. */
type Credentials = Record<string, Credential>

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
  learn login                        Log in with an email code, then keep the lessons published here
  learn login --email <address>      Send the code without a terminal; then add --code <code>
  learn keep                         Save the lessons published here to the logged-in account
  learn logout                       Forget the saved key and revoke it
  learn whoami                       Print the logged-in email and handle
  learn schema                       Print the path to the lesson JSON Schema

Options:
  --api <url>   Server to use (default: $LEARN_API_URL or ${DEFAULT_API_URL})
  --json        Print machine-readable JSON instead of text

Logged in (learn login, or $LEARN_API_KEY), every lesson you publish is saved to your account, never
expires, and goes straight to Explore: unpublish it from your profile. Anonymous lessons last 7 days;
\`login\` and \`keep\` save the ones published from this folder the same way.`

export async function run(argv: string[], io: Io): Promise<number> {
  const flags = new Set(argv.filter((a) => a.startsWith("--")))
  // Options that take a value: their value isn't a positional argument.
  const option = (name: string) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const valued = new Set(
    ["--api", "--email", "--code"].flatMap((n) => {
      const i = argv.indexOf(n)
      return i >= 0 ? [i + 1] : []
    })
  )
  const args = argv.filter((a, i) => !a.startsWith("--") && !valued.has(i))
  const api = (
    option("--api") ??
    io.env.LEARN_API_URL ??
    DEFAULT_API_URL
  ).replace(/\/+$/, "")
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
  if (command === "login")
    return login(io, {
      api,
      json,
      email: option("--email"),
      code: option("--code"),
    })
  if (command === "keep") return keep(io, api, json)
  if (command === "logout") return logout(io, api, json)
  if (command === "whoami") return whoami(io, api, json)
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

/** A JSON call to our API, which answers { ok, message } (Better Auth's own routes don't: see fetchAuth). */
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

/**
 * A JSON call to one of Better Auth's routes under /api/auth, judged by the status alone. Its CSRF
 * check wants an Origin on requests from Node, so the call names the server itself.
 */
async function fetchAuth<T>(io: Io, url: string, init?: RequestInit) {
  const response = await io.fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      origin: new URL(url).origin,
      "x-learn-skill-version": SKILL_VERSION,
    },
  })
  const body = (await response.json().catch(() => null)) as
    ({ message?: string } & T) | null
  if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`)
  return { body, response }
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
      notesText(body.notes),
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
    {
      ok: true,
      spec: SPEC_VERSION,
      ...(result.notes.length ? { notes: result.notes } : {}),
      offline: why,
    },
    () =>
      [
        `✓ ${o.file} is a valid lesson (spec ${SPEC_VERSION}).`,
        notesText(result.notes),
        note,
      ]
        .filter(Boolean)
        .join("\n")
  )
  return 0
}

// --- publish ---

/**
 * The agent whose shell runs this, from what it sets in the environment: the shared `AI_AGENT`
 * (`claude-code_2-1-304_agent`), or else a marker of its own. The server matches the name to a logo.
 */
export function agentOf(env: Io["env"]): string | null {
  if (env.AI_AGENT) return env.AI_AGENT
  if (env.CLAUDECODE) return "claude-code"
  if (env.CURSOR_AGENT) return "cursor"
  if (env.GEMINI_CLI) return "gemini-cli"
  if (env.CODEX_SANDBOX) return "codex"
  if (env.OPENCODE || env.OPENCODE_CLIENT) return "opencode"
  return null
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
  const live = saved && isLive(saved) ? saved : undefined
  const credential = await readCredential(io, o.api)
  const agent = agentOf(io.env)
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-learn-skill-version": SKILL_VERSION,
    ...(credential ? { "x-api-key": credential.apiKey } : {}),
    // Which agent published it, so Explore can show its logo on the lesson.
    ...(agent ? { "x-learn-agent": agent } : {}),
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

  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >

  // The saved lesson expired on the server, or its token no longer works: publish a new one instead.
  // (A bad API key is a different 401, reported below, so a logged-in publish never falls back to
  // an anonymous one by accident.)
  if (
    live &&
    (response.status === 404 ||
      (response.status === 401 && body.error !== "invalid_api_key"))
  ) {
    delete state.lessons[o.path]
    await writeState(statePath, state)
    return publish(io, { ...o, forceNew: true })
  }

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

  let owned = Boolean(body.owned)
  let standing = standingOf(body)
  const record: SavedLesson = {
    id: body.id as string,
    url: body.url as string,
    editToken: (body.editToken as string | undefined) ?? live!.editToken,
    expiresAt: (body.expiresAt as string | null | undefined) ?? null,
  }
  // The claim token is shown once: keep it until `login` spends it.
  const claimToken =
    (body.claimToken as string | undefined) ??
    (owned ? undefined : live?.claimToken)
  if (claimToken) record.claimToken = claimToken
  // Logged in, but updating a lesson published before logging in (from another folder's login):
  // keep it now rather than telling the user to log in again.
  if (credential && !owned) {
    const claimed = await claimOne(io, o.api, credential, record)
    if (claimed.outcome === "kept") {
      owned = true
      standing = claimed
    }
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
      owned,
      expiresAt: record.expiresAt,
      ...(Array.isArray(body.notes) ? { notes: body.notes } : {}),
      skill,
    },
    () =>
      [
        `${live ? "Updated" : "Published"}: ${record.url}`,
        notesText(body.notes),
        owned
          ? ownedLine(standing, o.api)
          : `Lasts 7 days, until ${new Date(record.expiresAt!).toUTCString()}. To keep it, run \`learn login\` (an email code; agents: offer this once, in one sentence).`,
        `Saved the edit token in .learn/state.json, so publishing ${o.file} again updates this same link.`,
        updateLine(skill),
      ]
        .filter(Boolean)
        .join("\n")
  )
  return 0
}

/** Whether a saved lesson is still on the server: owned lessons (no expiry) always are. */
function isLive(saved: SavedLesson): boolean {
  return saved.expiresAt === null || Date.parse(saved.expiresAt) > Date.now()
}

/** Where an owned lesson stands, from a publish or claim reply: whose it is, and whether Explore lists it. */
interface Standing {
  handle: string | null
  listed: boolean
}

function standingOf(body: Record<string, unknown>): Standing {
  const owner = body.owner as { handle?: string | null } | null | undefined
  return {
    handle: owner?.handle ?? null,
    listed: body.visibility === "public",
  }
}

/**
 * The sentence for an owned lesson, the same one the MCP guide uses: saved to the handle, and
 * either published in Explore or private, with where to publish it (a handle first, if needed).
 */
function ownedLine({ handle, listed }: Standing, api: string): string {
  if (handle && listed)
    return `Saved to @${handle} and published in Explore. Unpublish it any time at ${api}/u/${handle}.`
  if (listed) return `Saved to your account and published in Explore.`
  if (handle)
    return `Saved to @${handle}. It's private: only people with the link can open it. Publish it to Explore at ${api}/u/${handle}.`
  return `Saved to your account. It's private: only people with the link can open it. Pick a handle at ${api}/settings to publish it to Explore.`
}

/** The lines `login` and `keep` print for the lessons they kept: the links, then where they stand. */
function keptLines(kept: Kept[], api: string): string {
  const n = kept.length
  const handle = kept[0]!.handle
  const them = n === 1 ? "it" : "them"
  const where =
    handle && kept.every((k) => k.listed)
      ? `saved to @${handle} and published in Explore (unpublish ${them} any time at ${api}/u/${handle})`
      : handle
        ? `saved to @${handle} and private (publish ${them} to Explore at ${api}/u/${handle})`
        : `saved to your account and private (pick a handle at ${api}/settings to publish ${them} to Explore)`
  return [
    `Kept ${n} lesson${n === 1 ? "" : "s"} published from this folder, ${where}:`,
    ...kept.map((k) => `  ${k.url}`),
  ].join("\n")
}

// --- login, logout, whoami ---

/**
 * Signs in with a six-digit email code and saves an API key, then keeps every lesson published
 * from this folder. With a terminal it asks for the email and the code; without one (an agent's
 * shell) it takes --email, sends the code, and says to run again with --code.
 */
async function login(
  io: Io,
  o: { api: string; json: boolean; email?: string; code?: string }
): Promise<number> {
  const email = (o.email ?? (await io.prompt?.("Email: ")))?.trim()
  if (!email) {
    io.err(
      "Give the email address to log in with: learn login --email <address>"
    )
    return 1
  }

  let code = o.code?.trim()
  if (!code) {
    try {
      await fetchAuth(io, `${o.api}/api/auth/email-otp/send-verification-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, type: "sign-in" }),
      })
    } catch (e) {
      report(
        io,
        o.json,
        { ok: false, error: "send_failed", message: (e as Error).message },
        () => `Couldn't send a code to ${email}: ${(e as Error).message}`
      )
      return 1
    }
    if (io.prompt) {
      code = (
        await io.prompt("Enter the six-digit code we emailed you: ")
      ).trim()
    } else {
      const next = `learn login --email ${email} --code <code>`
      report(
        io,
        o.json,
        { ok: true, sent: true, email, next },
        () =>
          `Sent a six-digit code to ${email}. It works for 5 minutes. Ask the user for it, then run:\n  ${next}`
      )
      return 0
    }
  }

  // Exchange the code for a session (its cookie), the session for a key, then drop the session.
  let cookie: string
  try {
    const { response } = await fetchAuth(
      io,
      `${o.api}/api/auth/sign-in/email-otp`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      }
    )
    cookie = cookieFrom(response)
  } catch (e) {
    report(
      io,
      o.json,
      { ok: false, error: "sign_in_failed", message: (e as Error).message },
      () =>
        `Couldn't log in: ${(e as Error).message}\nCodes work for 5 minutes and three tries. Run \`learn login\` to get a new one.`
    )
    return 1
  }
  let key: { id: string; key: string }
  try {
    key = await fetchJson<{ id: string; key: string }>(
      io,
      `${o.api}/api/keys`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          name: `learn CLI on ${io.hostname ?? "this machine"}`,
        }),
      }
    )
    await fetchAuth(io, `${o.api}/api/auth/sign-out`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: "{}",
    }).catch(() => {})
  } catch (e) {
    report(
      io,
      o.json,
      { ok: false, error: "key_failed", message: (e as Error).message },
      () => `Logged in, but couldn't make an API key: ${(e as Error).message}`
    )
    return 1
  }
  const credential: Credential = { apiKey: key.key, keyId: key.id, email }
  await writeCredential(io, o.api, credential)
  const handle = await fetchHandle(io, o.api, credential)

  // Keep every lesson published from this folder.
  const { kept } = await claimAll(io, o.api, credential)

  report(
    io,
    o.json,
    { ok: true, email, handle, credentials: credentialsPath(io), kept },
    () =>
      [
        `Logged in as ${email}${handle ? ` (@${handle})` : ""}. Saved the key in ${credentialsPath(io)}.`,
        kept.length
          ? keptLines(kept, o.api)
          : `No lessons from this folder to keep. From now on, every lesson you publish is saved to your account${handle ? ` as @${handle}` : ""} and published in Explore.`,
        handle
          ? null
          : `Pick a handle at ${o.api}/settings to publish your lessons to Explore.`,
      ]
        .filter(Boolean)
        .join("\n")
  )
  return 0
}

/**
 * Saves every lesson published from this folder to the logged-in account, without a new code:
 * for the folder a `login` elsewhere didn't cover, and for lessons an older tool published
 * without a claim token (the edit token is proof enough).
 */
async function keep(io: Io, api: string, json: boolean): Promise<number> {
  const credential = await readCredential(io, api)
  if (!credential) {
    report(
      io,
      json,
      { ok: false, error: "signed_out", message: "Not logged in." },
      () =>
        "Not logged in. Run `learn login`: it logs in with an email code and keeps the lessons published here too."
    )
    return 1
  }
  const { kept, total, tried, retry } = await claimAll(io, api, credential)
  const handle = kept[0]?.handle ?? (await fetchHandle(io, api, credential))
  // Nothing kept and something unreachable: that's a failure to run again, not a quiet success.
  const ok = kept.length > 0 || retry === 0
  report(
    io,
    json,
    { ok, ...(ok ? {} : { error: "retry" }), handle, kept, retry },
    () =>
      [
        kept.length
          ? keptLines(kept, api)
          : tried
            ? "Nothing new to keep: the lessons published from this folder are already saved, or have expired."
            : total
              ? "Every lesson published from this folder is already saved to your account."
              : "No lessons have been published from this folder yet; logged in, `learn publish` saves them to your account as it goes.",
        retry
          ? `Couldn't reach the server for ${retry} lesson${retry === 1 ? "" : "s"}; run \`learn keep\` again in a minute.`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
  )
  return ok ? 0 : 1
}

/** A lesson `login` or `keep` moved into the account. */
interface Kept extends Standing {
  url: string
}

/** Claims every lesson in .learn/state.json that isn't owned yet: with its claim token when there is one, else its edit token. */
async function claimAll(
  io: Io,
  api: string,
  credential: Credential
): Promise<{ kept: Kept[]; total: number; tried: number; retry: number }> {
  const statePath = join(io.cwd, ".learn", "state.json")
  const state = await readState(statePath)
  const kept: Kept[] = []
  const total = Object.keys(state.lessons).length
  let tried = 0
  let retry = 0
  let changed = false
  for (const saved of Object.values(state.lessons)) {
    // Owned already, gone from the server, or another account's: nothing to send.
    if (saved.expiresAt === null || !isLive(saved) || saved.ownedElsewhere)
      continue
    tried++
    const claimed = await claimOne(io, api, credential, saved)
    if (claimed.outcome === "kept") kept.push({ url: saved.url, ...claimed })
    if (claimed.outcome === "retry") retry++
    else changed = true
  }
  if (changed) await writeState(statePath, state)
  return { kept, total, tried, retry }
}

/**
 * Claims one saved lesson, with its claim token and its edit token (the server takes either).
 * "kept" moved it into the account; "spent" means the server refused for good (expired, or kept
 * by another account), so the claim token is dropped; "retry" is a network or server fault, and
 * the token stays for the next `login` or `keep`.
 */
async function claimOne(
  io: Io,
  api: string,
  credential: Credential,
  saved: SavedLesson
): Promise<{ outcome: "spent" | "retry" } | ({ outcome: "kept" } & Standing)> {
  let response: Response
  try {
    response = await io.fetch(`${api}/api/lessons/${saved.id}/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": credential.apiKey,
        "x-learn-skill-version": SKILL_VERSION,
      },
      body: JSON.stringify({
        ...(saved.claimToken ? { claimToken: saved.claimToken } : {}),
        editToken: saved.editToken,
      }),
    })
  } catch {
    return { outcome: "retry" }
  }
  if (response.status >= 500 || response.status === 429)
    return { outcome: "retry" }
  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (response.ok) {
    // A success we can't read is a fault, not a refusal: keep the token for next time.
    if (!body?.ok) return { outcome: "retry" }
    saved.expiresAt = null
    delete saved.claimToken
    return { outcome: "kept", ...standingOf(body) }
  }
  delete saved.claimToken
  if (body?.error === "already_claimed") saved.ownedElsewhere = true
  return { outcome: "spent" }
}

async function logout(io: Io, api: string, json: boolean): Promise<number> {
  const all = await readCredentials(io)
  const credential = all[api]
  const envKey = Boolean(io.env.LEARN_API_KEY)
  if (!credential) {
    report(io, json, { ok: true, signedIn: envKey, envKey }, () =>
      envKey
        ? "No saved key to forget, but LEARN_API_KEY is set in this shell, so publishing still uses it. Unset it to log out."
        : "Not logged in."
    )
    return 0
  }
  let revoked = false
  if (credential.keyId) {
    revoked = await io
      .fetch(`${api}/api/keys/${credential.keyId}`, {
        method: "DELETE",
        headers: { "x-api-key": credential.apiKey },
      })
      .then((r) => r.ok)
      .catch(() => false)
  }
  delete all[api]
  await writeCredentials(io, all)
  report(io, json, { ok: true, signedIn: envKey, revoked, envKey }, () =>
    [
      `Logged out of ${api}.${revoked ? " The key was revoked." : " The key couldn't be revoked from here; revoke it at " + api + "/settings if it may have leaked."}`,
      envKey
        ? "LEARN_API_KEY is still set in this shell, so publishing keeps using it. Unset it to log out."
        : null,
    ]
      .filter(Boolean)
      .join("\n")
  )
  return 0
}

async function whoami(io: Io, api: string, json: boolean): Promise<number> {
  const credential = await readCredential(io, api)
  if (!credential) {
    report(
      io,
      json,
      { ok: false, error: "signed_out", message: "Not logged in." },
      () => "Not logged in. Run `learn login` to keep lessons in an account."
    )
    return 1
  }
  let account: { email: string; handle: string | null }
  try {
    account = await fetchJson<{ email: string; handle: string | null }>(
      io,
      `${api}/api/account`,
      { headers: { "x-api-key": credential.apiKey } }
    )
  } catch (e) {
    report(
      io,
      json,
      { ok: false, error: "invalid_api_key", message: (e as Error).message },
      () =>
        `The saved key for ${api} doesn't work (${(e as Error).message}). Run \`learn login\` again.`
    )
    return 1
  }
  report(
    io,
    json,
    { ok: true, email: account.email, handle: account.handle },
    () =>
      `${account.email}${account.handle ? ` (@${account.handle})` : " (no handle yet)"}`
  )
  return 0
}

async function fetchHandle(io: Io, api: string, credential: Credential) {
  try {
    const account = await fetchJson<{ handle: string | null }>(
      io,
      `${api}/api/account`,
      { headers: { "x-api-key": credential.apiKey } }
    )
    return account.handle
  } catch {
    return null
  }
}

/** The session cookies a response sets, as one Cookie header value. */
function cookieFrom(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] }
  const raw = headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  return raw
    .flatMap((line) => line.split(/,\s*(?=[^;,=\s]+=)/))
    .map((c) => c.split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ")
}

// --- credentials ---

const credentialsPath = (io: Io) => join(io.configDir, CREDENTIALS_FILE)

/** The key for `api`: $LEARN_API_KEY first, then the credentials file. */
async function readCredential(io: Io, api: string): Promise<Credential | null> {
  if (io.env.LEARN_API_KEY) return { apiKey: io.env.LEARN_API_KEY, email: "" }
  return (await readCredentials(io))[api] ?? null
}

async function readCredentials(io: Io): Promise<Credentials> {
  try {
    const parsed = JSON.parse(await readFile(credentialsPath(io), "utf8"))
    return typeof parsed === "object" && parsed ? (parsed as Credentials) : {}
  } catch {
    return {}
  }
}

async function writeCredential(io: Io, api: string, credential: Credential) {
  const all = await readCredentials(io)
  all[api] = credential
  await writeCredentials(io, all)
}

/** Only the user can read the file (mode 0600, in a 0700 folder). */
async function writeCredentials(io: Io, all: Credentials) {
  const path = credentialsPath(io)
  if (!Object.keys(all).length) {
    await rm(path, { force: true })
    return
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, JSON.stringify(all, null, 2) + "\n", { mode: 0o600 })
  await chmod(path, 0o600)
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

/** What the checker tidied on its own (a tag's spelling), or null when it changed nothing. */
function notesText(notes: unknown): string | null {
  if (!Array.isArray(notes) || notes.length === 0) return null
  return `Notes:\n${formatIssues(notes as Issue[])}`
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
