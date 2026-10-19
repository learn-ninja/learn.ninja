import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { beforeEach, describe, expect, it } from "vitest"

import {
  CREDENTIALS_FILE,
  run,
  SKILL_VERSION,
  SYNC_DIR,
  type Io,
} from "./cli"

const lesson = readFileSync(
  new URL("../../../examples/button-hierarchy.json", import.meta.url),
  "utf8"
)

type Call = {
  method: string
  url: string
  auth?: string
  skill?: string
  apiKey?: string
  cookie?: string
  body?: string
}
type Reply = { status: number; body: unknown; headers?: Record<string, string> }
/** What the fake server answers, by "METHOD /path". A queue answers in order; a function decides each time. */
type Routes = Record<string, Reply | Reply[] | ((call: Call) => Reply)>

const GUIDES = {
  "steps.md": "# Steps\n",
  "reference/teaching-guide.md": "# Teaching guide\n",
  "schema/lesson.schema.json": "{}\n",
}
const manifest = (over: Partial<Record<string, unknown>> = {}) => ({
  ok: true,
  version: SKILL_VERSION,
  minVersion: SKILL_VERSION,
  updateCommand: "npx skills add https://learn.ninja -g",
  hash: "abc123",
  ...over,
})
const bundle = (over: Partial<Record<string, unknown>> = {}) => ({
  ...manifest(over),
  files: GUIDES,
})
const valid = { status: 200, body: { ok: true, spec: "0.4" } }

/** A server with current guides and a checker that accepts everything; tests override routes. */
function setup(routes: Routes = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "learn-cli-"))
  writeFileSync(join(cwd, "lesson.json"), lesson)
  const calls: Call[] = []
  const out: string[] = []
  const err: string[] = []
  const all: Routes = {
    "GET /api/skill/version": { status: 200, body: manifest() },
    "GET /api/skill": { status: 200, body: bundle() },
    "POST /api/validate": valid,
    ...routes,
  }
  const io: Io = {
    cwd,
    env: {},
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    skillDir: "/skill",
    configDir: join(cwd, "config"),
    hostname: "test-mac",
    fetch: (async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      const call: Call = {
        method: init?.method ?? "GET",
        url,
        auth: headers.authorization,
        skill: headers["x-learn-skill-version"],
        apiKey: headers["x-api-key"],
        cookie: headers.cookie,
        body: typeof init?.body === "string" ? init.body : undefined,
      }
      calls.push(call)
      const route = all[`${call.method} ${new URL(url).pathname}`]
      if (!route) throw new TypeError("fetch failed")
      const reply = Array.isArray(route)
        ? route.shift()!
        : typeof route === "function"
          ? route(call)
          : route
      if (reply.status === 0) throw new TypeError("fetch failed")
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: reply.headers,
      })
    }) as typeof fetch,
  }
  const methods = () =>
    calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)
  return { io, cwd, calls, methods, out, err }
}

const offline: Reply = { status: 0, body: null }

const created = (id = "abcd1234") => ({
  status: 201,
  body: {
    ok: true,
    id,
    url: `https://learn.test/l/button-hierarchy-${id}`,
    editToken: "tok-" + id,
    claimToken: "claim-" + id,
    claimUrl: `https://learn.test/keep/claim-${id}`,
    owned: false,
    expiresAt: new Date(Date.now() + 864e5).toISOString(),
    skill: { latest: SKILL_VERSION, updateAvailable: false },
  },
})

/** What the server answers a signed-in publish with: owned, no expiry, no claim token. */
const createdOwned = (id = "own12345") => {
  const reply = created(id)
  const { claimToken: _c, claimUrl: _u, ...body } = reply.body
  return { status: 201, body: { ...body, owned: true, expiresAt: null } }
}

const KEY = "learn_" + "k".repeat(64)
/** The sign-in routes a `login` goes through, ending with a key for ada@example.com. */
const signInRoutes = (): Routes => ({
  "POST /api/auth/email-otp/send-verification-otp": {
    status: 200,
    body: { success: true },
  },
  "POST /api/auth/sign-in/email-otp": (call) =>
    JSON.parse(call.body!).otp === "123456"
      ? {
          status: 200,
          body: { token: "sess", user: { email: "ada@example.com" } },
          headers: {
            "set-cookie":
              "better-auth.session_token=sess.sig; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax, better-auth.session_data=eyJ; Max-Age=300; Path=/; HttpOnly",
          },
        }
      : { status: 400, body: { message: "Invalid OTP" } },
  "POST /api/keys": (call) =>
    call.cookie?.includes("better-auth.session_token=sess.sig")
      ? {
          status: 201,
          body: { ok: true, id: "key1", key: KEY, name: "learn CLI on test-mac" },
        }
      : { status: 401, body: { ok: false, error: "sign_in_required" } },
  "POST /api/auth/sign-out": { status: 200, body: { success: true } },
  "GET /api/account": (call) =>
    call.apiKey === KEY
      ? { status: 200, body: { ok: true, email: "ada@example.com", handle: "ada" } }
      : { status: 401, body: { ok: false, error: "invalid_api_key", message: "Bad key." } },
})

describe("learn sync", () => {
  it("downloads the guides, with a hash and a .gitignore", async () => {
    const t = setup()
    expect(await run(["sync"], t.io)).toBe(0)
    expect(t.methods()).toEqual(["GET /api/skill/version", "GET /api/skill"])
    expect(t.calls[0]!.skill).toBe(SKILL_VERSION)
    const dir = join(t.cwd, SYNC_DIR)
    expect(readFileSync(join(dir, "steps.md"), "utf8")).toBe("# Steps\n")
    expect(readFileSync(join(dir, "reference/teaching-guide.md"), "utf8")).toBe(
      "# Teaching guide\n"
    )
    expect(readFileSync(join(dir, ".hash"), "utf8")).toBe("abc123\n")
    expect(readFileSync(join(t.cwd, ".learn/.gitignore"), "utf8")).toBe("*\n")
    expect(t.out.join("\n")).toMatch(
      /Synced 3 files to \.learn\/skill\/\.\nStart with \.learn\/skill\/steps\.md\./
    )
  })

  it("only checks the version when the guides haven't changed", async () => {
    const t = setup()
    await run(["sync"], t.io)
    t.calls.length = 0
    expect(await run(["sync"], t.io)).toBe(0)
    expect(t.methods()).toEqual(["GET /api/skill/version"])
    expect(t.out.at(-1)).toMatch(/up to date/)
  })

  it("replaces an old copy when the hash moved", async () => {
    const t = setup()
    await run(["sync"], t.io)
    writeFileSync(join(t.cwd, SYNC_DIR, "stale.md"), "old")
    const t2 = setup({
      "GET /api/skill/version": {
        status: 200,
        body: manifest({ hash: "def" }),
      },
      "GET /api/skill": { status: 200, body: bundle({ hash: "def" }) },
    })
    t2.io.cwd = t.cwd
    expect(await run(["sync"], t2.io)).toBe(0)
    expect(existsSync(join(t.cwd, SYNC_DIR, "stale.md"))).toBe(false)
    expect(readFileSync(join(t.cwd, SYNC_DIR, ".hash"), "utf8")).toBe("def\n")
  })

  it("names the fallback copy when the server can't be reached", async () => {
    const t = setup({ "GET /api/skill/version": offline })
    expect(await run(["sync"], t.io)).toBe(1)
    expect(t.err.join("\n")).toMatch(
      /Couldn't reach https:\/\/learn\.ninja.*\nFollow the guides already here instead: \/skill\/steps\.md \(the copy that came with the install\)/
    )
    expect(existsSync(join(t.cwd, SYNC_DIR))).toBe(false)
  })

  it("prefers the last sync's copy as the fallback", async () => {
    const t = setup()
    await run(["sync"], t.io)
    const t2 = setup({ "GET /api/skill": offline })
    t2.io.cwd = t.cwd
    writeFileSync(join(t.cwd, SYNC_DIR, ".hash"), "old\n")
    expect(await run(["sync"], t2.io)).toBe(1)
    expect(t2.err.join("\n")).toMatch(
      /\.learn\/skill\/steps\.md \(from your last sync\)/
    )
    // The old copy is still there, untouched.
    expect(readFileSync(join(t.cwd, SYNC_DIR, "steps.md"), "utf8")).toBe(
      "# Steps\n"
    )
  })

  it("stops with the update command when this CLI is too old", async () => {
    const t = setup({
      "GET /api/skill/version": {
        status: 200,
        body: manifest({ version: "9.9.9", minVersion: "9.0.0" }),
      },
    })
    expect(await run(["sync"], t.io)).toBe(1)
    expect(t.err.join("\n")).toMatch(
      new RegExp(
        `skill \\(${SKILL_VERSION.replace(/\./g, "\\.")}\\) is too old.*\\nnpx skills add https://learn\\.ninja -g`
      )
    )
    expect(t.methods()).toEqual(["GET /api/skill/version"])
    expect(existsSync(join(t.cwd, SYNC_DIR))).toBe(false)
  })

  it("mentions a newer skill that still works", async () => {
    const t = setup({
      "GET /api/skill/version": {
        status: 200,
        body: manifest({ version: "9.9.9" }),
      },
      "GET /api/skill": { status: 200, body: bundle({ version: "9.9.9" }) },
    })
    expect(await run(["sync"], t.io)).toBe(0)
    expect(t.out.join("\n")).toMatch(
      /newer version of the lesson skill.*npx skills add/
    )
  })

  it("honours --api and LEARN_API_URL", async () => {
    const t = setup()
    await run(["sync", "--api", "https://preview.test/"], t.io)
    expect(t.calls[0]!.url).toBe("https://preview.test/api/skill/version")
    t.calls.length = 0
    t.io.env.LEARN_API_URL = "https://env.test"
    await run(["sync"], t.io)
    expect(t.calls[0]!.url).toBe("https://env.test/api/skill/version")
  })

  it("reports in JSON", async () => {
    const t = setup()
    expect(await run(["sync", "--json"], t.io)).toBe(0)
    expect(JSON.parse(t.out.join(""))).toMatchObject({
      ok: true,
      synced: true,
      hash: "abc123",
      dir: SYNC_DIR,
      files: 3,
    })
  })
})

describe("learn validate", () => {
  it("checks on the server", async () => {
    const t = setup()
    expect(await run(["validate", "lesson.json"], t.io)).toBe(0)
    expect(t.methods()).toContain("POST /api/validate")
    expect(t.out.join("\n")).toMatch(/is a valid lesson \(spec 0\.4\)/)
  })

  it("lists the server's issues", async () => {
    const t = setup({
      "POST /api/validate": {
        status: 422,
        body: {
          ok: false,
          error: "invalid_lesson",
          issues: [{ path: "bricks[1]", message: "Needs feedback" }],
        },
      },
    })
    expect(await run(["validate", "lesson.json"], t.io)).toBe(1)
    expect(t.err.join("\n")).toMatch(
      /1 issue to fix:\n- bricks\[1\]: Needs feedback/
    )
  })

  it("shows a message without issues, like an unsupported spec", async () => {
    const t = setup({
      "POST /api/validate": {
        status: 422,
        body: {
          ok: false,
          error: "unsupported_spec",
          message: "Spec 0.1? No.",
        },
      },
    })
    expect(await run(["validate", "lesson.json"], t.io)).toBe(1)
    expect(t.err.at(-1)).toBe("Spec 0.1? No.")
  })

  it("falls back to the bundled rules offline, and says so", async () => {
    const t = setup({
      "GET /api/skill/version": offline,
      "POST /api/validate": offline,
    })
    expect(await run(["validate", "lesson.json"], t.io)).toBe(0)
    expect(t.out.join("\n")).toMatch(
      /is a valid lesson.*\nChecked offline with the bundled rules \(couldn't reach https:\/\/learn\.ninja/
    )
    const broken = JSON.parse(lesson)
    delete broken.bricks[1].options[1].feedback
    writeFileSync(join(t.cwd, "lesson.json"), JSON.stringify(broken))
    expect(await run(["validate", "lesson.json"], t.io)).toBe(1)
    expect(t.err.join("\n")).toMatch(
      /1 issue to fix:\n- bricks\[1\]\.options\[1\]: Wrong option "b" has no feedback.*\nChecked offline/
    )
  })

  it("falls back when the server is rate-limited or failing", async () => {
    const t = setup({
      "POST /api/validate": {
        status: 429,
        body: { ok: false, error: "rate_limited", message: "Too many checks." },
      },
    })
    expect(await run(["validate", "lesson.json"], t.io)).toBe(0)
    expect(t.out.join("\n")).toMatch(/Checked offline.*\(Too many checks\.\)/)
  })

  it("refreshes the guides quietly when they changed", async () => {
    const t = setup()
    await run(["validate", "lesson.json"], t.io)
    expect(t.methods()).toEqual([
      "GET /api/skill/version",
      "GET /api/skill",
      "POST /api/validate",
    ])
    expect(readFileSync(join(t.cwd, SYNC_DIR, "steps.md"), "utf8")).toBe(
      "# Steps\n"
    )
    expect(t.err.join("\n")).toMatch(/Updated the guides in \.learn\/skill\//)
    t.calls.length = 0
    t.err.length = 0
    await run(["validate", "lesson.json"], t.io)
    expect(t.methods()).toEqual([
      "GET /api/skill/version",
      "POST /api/validate",
    ])
    expect(t.err).toEqual([])
  })

  it("warns, but still checks, when this CLI is too old", async () => {
    const t = setup({
      "GET /api/skill/version": {
        status: 200,
        body: manifest({ version: "9.9.9", minVersion: "9.0.0" }),
      },
    })
    expect(await run(["validate", "lesson.json"], t.io)).toBe(0)
    expect(t.err.join("\n")).toMatch(
      /too old.*Update it before the next lesson/
    )
    expect(t.methods()).toEqual([
      "GET /api/skill/version",
      "POST /api/validate",
    ])
  })
})

describe("learn schema", () => {
  it("prints the synced schema when there is one, else the bundled one", async () => {
    const t = setup()
    await run(["schema"], t.io)
    expect(t.out).toEqual(["/skill/schema/lesson.schema.json"])
    await run(["sync"], t.io)
    t.out.length = 0
    await run(["schema"], t.io)
    expect(t.out).toEqual([join(t.cwd, SYNC_DIR, "schema/lesson.schema.json")])
  })
})

describe("learn publish", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup({
      "POST /api/lessons": created(),
      "PUT /api/lessons/abcd1234": {
        status: 200,
        body: { ...created().body, editToken: undefined },
      },
    })
  })

  it("publishes, then updates the same link the next time", async () => {
    expect(
      await run(
        ["publish", "lesson.json", "--api", "https://learn.test/"],
        t.io
      )
    ).toBe(0)
    expect(t.calls.at(-1)).toMatchObject({
      method: "POST",
      url: "https://learn.test/api/lessons",
      skill: SKILL_VERSION,
    })
    expect(t.out.join("\n")).toMatch(
      /Published: https:\/\/learn\.test\/l\/button-hierarchy-abcd1234/
    )

    const statePath = join(t.cwd, ".learn/state.json")
    expect(
      JSON.parse(readFileSync(statePath, "utf8")).lessons[
        join(t.cwd, "lesson.json")
      ]
    ).toMatchObject({ id: "abcd1234", editToken: "tok-abcd1234" })
    expect(statSync(statePath).mode & 0o777).toBe(0o600)
    expect(readFileSync(join(t.cwd, ".learn/.gitignore"), "utf8")).toBe("*\n")

    expect(
      await run(["publish", "lesson.json", "--api", "https://learn.test"], t.io)
    ).toBe(0)
    expect(t.calls.at(-1)).toMatchObject({
      method: "PUT",
      url: "https://learn.test/api/lessons/abcd1234",
      auth: "Bearer tok-abcd1234",
    })
    expect(t.out.join("\n")).toMatch(/Updated: /)
  })

  it("publishes a new link when the saved one has expired", async () => {
    t = setup({
      "POST /api/lessons": [created("first111"), created("second22")],
      "PUT /api/lessons/first111": {
        status: 404,
        body: { ok: false, error: "not_found" },
      },
    })
    await run(["publish", "lesson.json"], t.io)
    expect(await run(["publish", "lesson.json"], t.io)).toBe(0)
    expect(t.methods().filter((m) => m.includes("/api/lessons"))).toEqual([
      "POST /api/lessons",
      "PUT /api/lessons/first111",
      "POST /api/lessons",
    ])
    expect(t.out.join("\n")).toMatch(/button-hierarchy-second22/)
  })

  it("shows the server's issues when it rejects the lesson", async () => {
    t = setup({
      "POST /api/lessons": {
        status: 422,
        body: {
          ok: false,
          error: "invalid_lesson",
          message: "The lesson doesn't match the spec.",
          issues: [{ path: "title", message: "Required" }],
        },
      },
    })
    writeFileSync(join(t.cwd, "lesson.json"), "{}")
    expect(await run(["publish", "lesson.json"], t.io)).toBe(1)
    expect(t.err.join("\n")).toMatch(
      /1 issue to fix:\n- title: Required\nThe lesson doesn't match the spec\./
    )
  })

  it("passes on the skill update notice", async () => {
    const reply = created()
    reply.body.skill = {
      latest: "9.9.9",
      updateAvailable: true,
      updateCommand: "npx skills add https://learn.ninja -g",
    } as never
    t = setup({ "POST /api/lessons": reply })
    await run(["publish", "lesson.json"], t.io)
    expect(t.out.join("\n")).toMatch(
      /newer version of the lesson skill.*npx skills add/
    )
  })

  it("still publishes when the guide check is offline", async () => {
    t = setup({
      "GET /api/skill/version": offline,
      "POST /api/lessons": created(),
    })
    expect(await run(["publish", "lesson.json"], t.io)).toBe(0)
    expect(t.out.join("\n")).toMatch(/Published:/)
  })

  it("keeps the claim token and says how long an anonymous lesson lasts", async () => {
    expect(await run(["publish", "lesson.json"], t.io)).toBe(0)
    expect(t.out.join("\n")).toMatch(
      /Lasts 7 days, until .*\. To keep it for good, run `learn login`/
    )
    expect(t.out.join("\n")).not.toMatch(/keep\/claim-/)
    const saved = JSON.parse(
      readFileSync(join(t.cwd, ".learn/state.json"), "utf8")
    ).lessons[join(t.cwd, "lesson.json")]
    expect(saved).toMatchObject({ claimToken: "claim-abcd1234" })
    // An update keeps the token: it's only shown once.
    await run(["publish", "lesson.json"], t.io)
    expect(
      JSON.parse(readFileSync(join(t.cwd, ".learn/state.json"), "utf8"))
        .lessons[join(t.cwd, "lesson.json")].claimToken
    ).toBe("claim-abcd1234")
  })

  it("sends the saved key, and an owned lesson never counts as expired", async () => {
    t = setup({
      "POST /api/lessons": createdOwned(),
      "PUT /api/lessons/own12345": {
        status: 200,
        body: { ...createdOwned().body, editToken: undefined },
      },
    })
    writeCredentials(t, { "https://learn.ninja": { apiKey: KEY, email: "a" } })
    expect(await run(["publish", "lesson.json"], t.io)).toBe(0)
    expect(t.calls.at(-1)).toMatchObject({ method: "POST", apiKey: KEY })
    expect(t.out.join("\n")).toMatch(/Saved to your account: it doesn't expire\./)
    const saved = JSON.parse(
      readFileSync(join(t.cwd, ".learn/state.json"), "utf8")
    ).lessons[join(t.cwd, "lesson.json")]
    expect(saved).toMatchObject({ id: "own12345", expiresAt: null })
    expect(saved).not.toHaveProperty("claimToken")
    // expiresAt null means live: the next publish updates rather than republishing.
    expect(await run(["publish", "lesson.json"], t.io)).toBe(0)
    expect(t.calls.at(-1)).toMatchObject({
      method: "PUT",
      url: "https://learn.ninja/api/lessons/own12345",
      apiKey: KEY,
    })
  })

  it("keeps an older anonymous lesson when updating it signed in", async () => {
    t = setup({
      "POST /api/lessons": created(),
      "PUT /api/lessons/abcd1234": {
        status: 200,
        body: { ...created().body, editToken: undefined, claimToken: undefined },
      },
      "POST /api/lessons/abcd1234/claim": (call) =>
        call.apiKey === KEY && JSON.parse(call.body!).claimToken === "claim-abcd1234"
          ? { status: 200, body: { ok: true, expiresAt: null } }
          : { status: 401, body: { ok: false } },
    })
    // Published anonymously, then signed in elsewhere.
    await run(["publish", "lesson.json"], t.io)
    writeCredentials(t, { "https://learn.ninja": { apiKey: KEY, email: "a" } })
    expect(await run(["publish", "lesson.json"], t.io)).toBe(0)
    expect(t.methods().filter((m) => m.includes("/api/lessons"))).toEqual([
      "POST /api/lessons",
      "PUT /api/lessons/abcd1234",
      "POST /api/lessons/abcd1234/claim",
    ])
    expect(t.out.join("\n")).toMatch(/Updated: .*\nSaved to your account/)
    const saved = JSON.parse(
      readFileSync(join(t.cwd, ".learn/state.json"), "utf8")
    ).lessons[join(t.cwd, "lesson.json")]
    expect(saved).toMatchObject({ expiresAt: null })
    expect(saved).not.toHaveProperty("claimToken")
  })

  it("takes the key from LEARN_API_KEY too", async () => {
    t = setup({ "POST /api/lessons": createdOwned() })
    t.io.env.LEARN_API_KEY = KEY
    await run(["publish", "lesson.json"], t.io)
    expect(t.calls.at(-1)).toMatchObject({ apiKey: KEY })
  })

  it("stops on a key that no longer works instead of publishing anonymously", async () => {
    t = setup({
      "POST /api/lessons": {
        status: 401,
        body: {
          ok: false,
          error: "invalid_api_key",
          message: "The API key doesn't work. Run `learn login` again.",
        },
      },
    })
    writeCredentials(t, { "https://learn.ninja": { apiKey: "learn_old", email: "a" } })
    expect(await run(["publish", "lesson.json"], t.io)).toBe(1)
    expect(t.err.join("\n")).toMatch(/API key doesn't work/)
    expect(t.methods().filter((m) => m.includes("/api/lessons"))).toEqual([
      "POST /api/lessons",
    ])
  })
})

function writeCredentials(
  t: ReturnType<typeof setup>,
  all: Record<string, { apiKey: string; keyId?: string; email: string }>
) {
  const path = join(t.io.configDir, CREDENTIALS_FILE)
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, JSON.stringify(all))
}

const readCredentials = (t: ReturnType<typeof setup>) =>
  JSON.parse(readFileSync(join(t.io.configDir, CREDENTIALS_FILE), "utf8"))

describe("learn login", () => {
  it("sends the code, then signs in with --code, saves the key, and keeps the folder's lessons", async () => {
    const t = setup({
      ...signInRoutes(),
      "POST /api/lessons": [created("aaaa1111"), created("bbbb2222")],
      "POST /api/lessons/aaaa1111/claim": (call) =>
        call.apiKey === KEY && JSON.parse(call.body!).claimToken === "claim-aaaa1111"
          ? { status: 200, body: { ok: true, expiresAt: null } }
          : { status: 401, body: { ok: false } },
      // Expired before it was kept.
      "POST /api/lessons/bbbb2222/claim": {
        status: 404,
        body: { ok: false, error: "not_found", message: "Gone." },
      },
    })
    await run(["publish", "lesson.json"], t.io)
    writeFileSync(join(t.cwd, "other.json"), lesson)
    await run(["publish", "other.json"], t.io)
    t.calls.length = 0

    // Without a terminal, the first run only sends the code.
    expect(await run(["login", "--email", "ada@example.com"], t.io)).toBe(0)
    expect(t.methods()).toEqual(["POST /api/auth/email-otp/send-verification-otp"])
    expect(t.calls[0]!.body).toBe(
      JSON.stringify({ email: "ada@example.com", type: "sign-in" })
    )
    expect(t.out.join("\n")).toMatch(
      /Sent a six-digit code to ada@example\.com.*\n\s+learn login --email ada@example\.com --code <code>/
    )
    expect(existsSync(join(t.io.configDir, CREDENTIALS_FILE))).toBe(false)
    t.calls.length = 0
    t.out.length = 0

    expect(
      await run(["login", "--email", "ada@example.com", "--code", "123456"], t.io)
    ).toBe(0)
    expect(t.methods()).toEqual([
      "POST /api/auth/sign-in/email-otp",
      "POST /api/keys",
      "POST /api/auth/sign-out",
      "GET /api/account",
      "POST /api/lessons/aaaa1111/claim",
      "POST /api/lessons/bbbb2222/claim",
    ])
    expect(t.calls[1]!.body).toBe(
      JSON.stringify({ name: "learn CLI on test-mac" })
    )
    const path = join(t.io.configDir, CREDENTIALS_FILE)
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(readCredentials(t)).toEqual({
      "https://learn.ninja": { apiKey: KEY, keyId: "key1", email: "ada@example.com" },
    })
    expect(t.out.join("\n")).toMatch(
      /Signed in as ada@example\.com \(@ada\)\. Saved the key in .*learn\/credentials\.\nKept 1 lesson published from this folder \(no longer expiring\):\n  https:\/\/learn\.test\/l\/button-hierarchy-aaaa1111/
    )
    const state = JSON.parse(readFileSync(join(t.cwd, ".learn/state.json"), "utf8"))
    expect(state.lessons[join(t.cwd, "lesson.json")]).toMatchObject({
      expiresAt: null,
    })
    expect(state.lessons[join(t.cwd, "lesson.json")]).not.toHaveProperty("claimToken")
    // The expired one lost its token too, and still expires.
    expect(state.lessons[join(t.cwd, "other.json")].expiresAt).not.toBeNull()
    expect(state.lessons[join(t.cwd, "other.json")]).not.toHaveProperty("claimToken")
  })

  it("keeps a claim token when the claim fails for a passing reason", async () => {
    const t = setup({
      ...signInRoutes(),
      "POST /api/lessons": [created("aaaa1111"), created("bbbb2222")],
      "POST /api/lessons/aaaa1111/claim": offline,
      "POST /api/lessons/bbbb2222/claim": {
        status: 503,
        body: { ok: false, error: "storage_not_configured" },
      },
    })
    await run(["publish", "lesson.json"], t.io)
    writeFileSync(join(t.cwd, "other.json"), lesson)
    await run(["publish", "other.json"], t.io)
    expect(
      await run(["login", "--email", "ada@example.com", "--code", "123456"], t.io)
    ).toBe(0)
    expect(t.out.join("\n")).toMatch(/No lessons from this folder to keep/)
    const state = JSON.parse(readFileSync(join(t.cwd, ".learn/state.json"), "utf8"))
    for (const saved of Object.values(state.lessons) as { claimToken?: string }[])
      expect(saved.claimToken).toMatch(/^claim-/)
  })

  it("asks for the email and code at a terminal", async () => {
    const t = setup(signInRoutes())
    const answers = ["ada@example.com", "123456"]
    t.io.prompt = async () => answers.shift()!
    expect(await run(["login"], t.io)).toBe(0)
    expect(readCredentials(t)["https://learn.ninja"].apiKey).toBe(KEY)
    expect(t.out.join("\n")).toMatch(/No lessons from this folder to keep/)
  })

  it("explains a wrong code", async () => {
    const t = setup(signInRoutes())
    expect(
      await run(["login", "--email", "ada@example.com", "--code", "000000"], t.io)
    ).toBe(1)
    expect(t.err.join("\n")).toMatch(/Couldn't sign in: Invalid OTP/)
    expect(existsSync(join(t.io.configDir, CREDENTIALS_FILE))).toBe(false)
  })

  it("needs an email without a terminal", async () => {
    const t = setup()
    expect(await run(["login"], t.io)).toBe(1)
    expect(t.err.join("\n")).toMatch(/learn login --email/)
  })

  it("reports in JSON", async () => {
    const t = setup(signInRoutes())
    expect(
      await run(["login", "--email", "ada@example.com", "--json"], t.io)
    ).toBe(0)
    expect(JSON.parse(t.out.join(""))).toMatchObject({
      ok: true,
      sent: true,
      next: "learn login --email ada@example.com --code <code>",
    })
    t.out.length = 0
    expect(
      await run(
        ["login", "--email", "ada@example.com", "--code", "123456", "--json"],
        t.io
      )
    ).toBe(0)
    expect(JSON.parse(t.out.join(""))).toMatchObject({
      ok: true,
      email: "ada@example.com",
      handle: "ada",
      kept: [],
    })
  })
})

describe("learn whoami and logout", () => {
  it("prints the account, or says to sign in", async () => {
    const t = setup(signInRoutes())
    expect(await run(["whoami"], t.io)).toBe(1)
    expect(t.err.join("\n")).toMatch(/Not signed in\. Run `learn login`/)
    writeCredentials(t, {
      "https://learn.ninja": { apiKey: KEY, keyId: "key1", email: "ada@example.com" },
    })
    expect(await run(["whoami"], t.io)).toBe(0)
    expect(t.out.at(-1)).toBe("ada@example.com (@ada)")
  })

  it("revokes the key and forgets it", async () => {
    const t = setup({
      ...signInRoutes(),
      "DELETE /api/keys/key1": (call) =>
        call.apiKey === KEY ? { status: 200, body: { ok: true } } : { status: 401, body: {} },
    })
    writeCredentials(t, {
      "https://learn.ninja": { apiKey: KEY, keyId: "key1", email: "ada@example.com" },
      "https://other.test": { apiKey: "learn_other", email: "b" },
    })
    expect(await run(["logout"], t.io)).toBe(0)
    expect(t.methods()).toEqual(["DELETE /api/keys/key1"])
    expect(t.out.at(-1)).toBe("Signed out of https://learn.ninja. The key was revoked.")
    // Other servers' keys stay.
    expect(readCredentials(t)).toEqual({
      "https://other.test": { apiKey: "learn_other", email: "b" },
    })
    expect(await run(["logout"], t.io)).toBe(0)
    expect(t.out.at(-1)).toBe("Not signed in.")
    // A key from the environment can't be forgotten from here; say so.
    t.io.env.LEARN_API_KEY = KEY
    expect(await run(["logout"], t.io)).toBe(0)
    expect(t.out.at(-1)).toMatch(/LEARN_API_KEY is set.*Unset it to sign out\./)
  })
})
