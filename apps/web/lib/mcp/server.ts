import { createMcpHandler } from "mcp-handler"
import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { LIMITS } from "@workspace/spec"

import type { McpActor } from "../auth/actor"
import { MCP_SCOPE } from "../auth/auth"
import {
  checkLesson,
  claimLesson,
  mayEdit,
  publishLesson,
  updateLesson,
  type Deps,
  type Reply,
} from "../publish/handlers"
import type { RateLimiter } from "../publish/rate-limit"
import { clientKey } from "../publish/request"
import { StorageNotConfiguredError } from "../publish/store"
import { applyPatches, PatchError, type DraftStore, type Patch } from "./drafts"

// The learn.ninja MCP server: the guide and the publish API as tools, for chat apps that can't
// run the skill's CLI. At /mcp, lessons publish anonymously until the chat app logs in: the gate
// in front of the route (gate.ts) answers `keep_lesson` from a logged-out app with a 401 that
// makes the app run OAuth against Better Auth, and from then on every call carries a token and
// `actor` is the account. At /mcp/{key}, a personal URL from the settings page, the key in the
// path is the account instead. Either way, lessons are published to it, unlisted.

export interface McpDeps extends Deps {
  /** The looser limit checks use, as /api/validate does. */
  validateLimiter: RateLimiter
  /** The skill's synced files (steps, guides, levels, schema), by path. */
  guide: () => { files: Record<string, string> }
  /** Lessons sent to the tools, kept so later calls can send patches. */
  drafts: DraftStore
  /** The logged-in account (an OAuth token, or a personal URL's key); null or absent when anonymous. */
  actor?: McpActor | null
  /** Called when a lesson becomes listed in Explore (a keep), so cached lists refresh. */
  exploreChanged?: () => void
}

/** The keep sentence the model says once after an anonymous publish, on every surface (steps.md step 6). */
export const KEEP_SENTENCE =
  "It lasts 7 days. Say \"keep it\" and I'll save it to your learn.ninja account; you'll log in once."

/**
 * Per-tool `securitySchemes`, as ChatGPT reads them from a tool's metadata when a server is added
 * with "OAuth or no authentication": which tools work logged out, and which need the account.
 */
const OPTIONAL_AUTH = {
  securitySchemes: [
    { type: "noauth" },
    { type: "oauth2", scopes: [MCP_SCOPE] },
  ],
}
const NEEDS_AUTH = {
  securitySchemes: [{ type: "oauth2", scopes: [MCP_SCOPE] }],
}

const INSTRUCTIONS =
  "learn.ninja turns anything into one short, interactive lesson with a shareable link. Call `get_guide` once before writing a lesson: it returns the whole guide, then follow its steps, including what to tell the user once a lesson is published."

const LEVELS = ["beginner", "intermediate", "advanced"]

/** Which guide files each `get_guide` section returns. */
export const GUIDE_SECTIONS = {
  // Everything a lesson needs, in one call: each extra round trip costs the model a turn.
  all: [
    "steps.md",
    "reference/planning.md",
    "reference/teaching-guide.md",
    "reference/lesson-format.md",
    "levels/index.md",
    ...LEVELS.map((l) => `levels/${l}.md`),
  ],
  steps: ["steps.md"],
  planning: ["reference/planning.md"],
  teaching: ["reference/teaching-guide.md"],
  format: ["reference/lesson-format.md"],
  levels: ["levels/index.md", ...LEVELS.map((l) => `levels/${l}.md`)],
  schema: ["schema/lesson.schema.json"],
} as const

type Section = keyof typeof GUIDE_SECTIONS
const SECTIONS = Object.keys(GUIDE_SECTIONS) as [Section, ...Section[]]

const PATH_HELP =
  "A path in the checker's syntax, e.g. `bricks[2].options[0].feedback`: an issue's `path` works as is."

const patch = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set"),
    path: z.string().describe(PATH_HELP),
    value: z
      .unknown()
      .describe("The new value: any JSON, such as a string or a whole brick."),
  }),
  z.object({
    op: z.literal("insert"),
    path: z.string().describe(`${PATH_HELP} The new item goes at that index.`),
    value: z.unknown().describe("The new array item."),
  }),
  z.object({ op: z.literal("remove"), path: z.string().describe(PATH_HELP) }),
])

/** The ways a tool can be given a lesson: the whole file, or a draft and the changes to it. */
const lessonInput = {
  lesson: z
    .string()
    .optional()
    .describe(
      "The whole lesson file as JSON text, following the lesson spec. Send it once; after that, use `draftId` and `patches`."
    ),
  draftId: z
    .string()
    .optional()
    .describe(
      "A draft that `validate_lesson`, `publish_lesson`, or `update_lesson` returned, instead of `lesson`."
    ),
  patches: z
    .array(patch)
    .optional()
    .describe(
      "Changes to apply to the draft, in order: `set` a value, `insert` an array item, or `remove` one. Fix every issue in one call."
    ),
}

/** Builds the /mcp request handler. Takes its dependencies so tests can pass an in-memory store. */
export function createLearnMcp(
  deps: McpDeps
): (req: Request) => Promise<Response> {
  return createMcpHandler((server) => registerTools(server, deps), {
    serverInfo: { name: "learn.ninja", version: "2.0.0" },
    instructions: INSTRUCTIONS,
  })
}

function registerTools(server: McpServer, deps: McpDeps) {
  const actor = deps.actor ?? null

  server.registerTool(
    "get_guide",
    {
      title: "Read the lesson guide",
      _meta: OPTIONAL_AUTH,
      description:
        "Returns the guide for writing a learn.ninja lesson: the steps to follow, and the planning, teaching, format, and level guides, together by default. Read it once before writing a lesson.",
      inputSchema: z.object({
        section: z
          .enum(SECTIONS)
          .default("all")
          .describe(
            "all: every guide but the schema. steps: what to do, in order. planning: scope, size, reading age. teaching: how to teach, which brick to use, visuals. format: every field of the lesson file. levels: picking the level, and each level's guide. schema: the formal JSON Schema, rarely needed."
          ),
      }),
      annotations: {
        title: "Read the lesson guide",
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    ({ section }) => {
      const { files } = deps.guide()
      const picked = GUIDE_SECTIONS[section].map((path) => ({
        path,
        text: files[path] ?? "",
      }))
      return {
        content: [
          {
            type: "text",
            text:
              picked.length === 1
                ? picked[0]!.text
                : picked
                    .map((f) => `<!-- ${f.path} -->\n\n${f.text}`)
                    .join("\n\n"),
          },
        ],
        structuredContent: { section, files: picked },
      }
    }
  )

  server.registerTool(
    "validate_lesson",
    {
      title: "Check a lesson",
      _meta: OPTIONAL_AUTH,
      description:
        "Checks a lesson with the rules publishing uses, without publishing it, and lists every issue. Returns a `draftId` either way, so fixes can be sent as `patches` against the draft instead of the whole lesson. `publish_lesson` runs the same checks, so a lesson that's ready can go straight there.",
      inputSchema: z.object(lessonInput),
      annotations: {
        title: "Check a lesson",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (input, ctx) =>
      withDraft(
        deps,
        input,
        null,
        async (text) => {
          const reply = await checkLesson(
            { text, client: clientOf(ctx, actor) },
            { limiter: deps.validateLimiter }
          )
          return { reply, keepDraft: true }
        },
        ["ok", "spec", "notes"]
      )
  )

  const owned = actor
    ? `Lessons are saved to ${actor.handle ? `@${actor.handle}` : "the user's account"} (this connection is theirs) and start unlisted, so drafts don't show in Explore; ${actor.handle ? `the switch is on their profile, learn.ninja/u/${actor.handle}` : "once they pick a handle at learn.ninja/settings, the switch is on their profile"}.`
    : null

  server.registerTool(
    "publish_lesson",
    {
      title: "Publish a lesson",
      _meta: OPTIONAL_AUTH,
      description: `Checks and publishes a lesson, and returns its link (\`url\`). If the check fails, nothing is published: the reply lists the issues and a \`draftId\`, so the fixes can be sent as \`patches\` against the draft instead of the whole lesson. The reply's \`id\`${actor ? "" : " and `editToken`"} let \`update_lesson\` change the lesson later. ${
        owned ??
        `Published anonymously, the link lasts 7 days; \`keep_lesson\` saves it to the user's account, and \`claimUrl\` is a link that does the same from a browser. The guide's steps cover what follows publishing.`
      }`,
      inputSchema: z.object(lessonInput),
      annotations: {
        title: "Publish a lesson",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    (input, ctx) =>
      withDraft(
        deps,
        input,
        null,
        async (text) => {
          const client = clientOf(ctx, actor)
          // Check first against the looser limit, so fixing a lesson doesn't use up publishes.
          const checked = await checkLesson(
            { text, client },
            { limiter: deps.validateLimiter }
          )
          if (checked.body.ok !== true)
            return { reply: checked, keepDraft: true }
          const reply = await publishLesson(
            {
              text,
              client,
              ownerId: actor?.userId ?? null,
              ownerHandle: actor?.handle ?? null,
              // A personal URL publishes everything, drafts included: keep them out of Explore.
              visibility: actor ? "unlisted" : undefined,
            },
            deps
          )
          return { reply, keepDraft: reply.body.ok !== true }
        },
        [
          "ok",
          "id",
          "url",
          // A logged-in app edits by account, so its chat never sees the token (chats get shared).
          ...(actor ? [] : ["editToken", "claimUrl"]),
          "expiresAt",
          "owner",
          "visibility",
        ]
      )
  )

  server.registerTool(
    "keep_lesson",
    {
      title: "Keep a lesson in an account",
      _meta: NEEDS_AUTH,
      description: actor
        ? `Saves a lesson that was published anonymously (in another chat, or before the user logged in) to ${actor.handle ? `@${actor.handle}` : "the user's account"}, given its \`id\` and \`editToken\`, and lists it in Explore. Lessons published here are already saved, so it's rarely needed.`
        : `Saves a published lesson to the user's learn.ninja account, given the \`id\` and \`editToken\` from \`publish_lesson\`: it stops expiring and is listed in Explore under their handle. For when the user asks to keep a lesson. It needs the user logged in; this app asks them to, once, then retries the call. The reply names the account (\`owner.handle\`, \`visibility\`), and a lesson already in an account answers \`already_claimed\`.`,
      inputSchema: z.object({
        id: z.string().describe("The lesson's id, from `publish_lesson`."),
        editToken: z
          .string()
          .describe("The secret edit token, from `publish_lesson`."),
      }),
      annotations: {
        title: "Keep a lesson in an account",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ id, editToken }, ctx) => {
      // Logged out: the gate answers this call with a 401 before it gets here; this is for a
      // client that ignored it.
      if (!actor) {
        return errorResult({
          ok: false,
          error: "sign_in_required",
          message:
            "Keeping a lesson needs the user logged in to learn.ninja. Connect this server with OAuth, or open the lesson's `claimUrl` in a browser.",
        })
      }
      // Keeping is cheap, and chat apps share an egress IP: the checks' limit, not the publish one.
      return toolResult(async () => {
        if (!(await deps.validateLimiter.allow(clientOf(ctx, actor))))
          return RATE_LIMITED
        const reply = await claimLesson(
          { id, editToken, ownerId: actor.userId },
          { ...deps, handleOf: async () => actor.handle }
        )
        if (reply.status === 200) deps.exploreChanged?.()
        return reply
      }, ["ok", "id", "url", "title", "expiresAt", "owner", "visibility"])
    }
  )

  server.registerTool(
    "update_lesson",
    {
      title: "Update a published lesson",
      _meta: OPTIONAL_AUTH,
      description: `Replaces a published lesson with a new version at the same link. Pass the \`id\`${
        actor
          ? " (the end of the lesson's URL); a lesson in the user's account needs no `editToken`, one published elsewhere does"
          : " and `editToken` that `publish_lesson` returned"
      }, and either \`patches\` alone (applied to the published lesson: the quickest way to change a few things), the whole \`lesson\`, or a \`draftId\` with \`patches\`. If the check fails, it returns the issues and a \`draftId\` to patch.`,
      inputSchema: z.object({
        id: z.string().describe("The lesson's id, from `publish_lesson`."),
        editToken: z
          .string()
          .optional()
          .describe(
            actor
              ? "The secret edit token, for a lesson that isn't in the user's account."
              : "The secret edit token, from `publish_lesson`."
          ),
        ...lessonInput,
      }),
      annotations: {
        title: "Update a published lesson",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, editToken, ...input }, ctx) => {
      const client = clientOf(ctx, actor)
      const update = (text: string) =>
        updateLesson(
          {
            id,
            editToken: editToken ?? null,
            actorId: actor?.userId ?? null,
            text,
            client,
          },
          deps
        )
      // Patches alone change the published lesson. Read it only for the right token or owner, so
      // anyone else gets updateLesson's own not_found or unauthorized reply.
      let base: string | null = null
      if (!input.lesson && !input.draftId && input.patches) {
        const existing = await deps.store.get(id)
        if (!existing || !mayEdit(existing, editToken, actor?.userId))
          return toolResult(() => update(""), [])
        base = JSON.stringify(existing.lesson)
      }
      return withDraft(
        deps,
        input,
        base,
        async (text) => {
          const reply = await update(text)
          return { reply, keepDraft: reply.body.ok !== true }
        },
        ["ok", "id", "url", "expiresAt", "owner", "visibility", "notes"]
      )
    }
  )
}

interface LessonInput {
  lesson?: string
  draftId?: string
  patches?: Patch[]
}

/**
 * Works out the lesson's text from a tool's input (the whole file, a draft, or `base`, each with
 * patches applied), runs `handle`, and keeps the text as a draft when `handle` says to, returning
 * its id with the result so the next call can send patches instead of the whole lesson.
 */
async function withDraft(
  deps: McpDeps,
  input: LessonInput,
  base: string | null,
  handle: (text: string) => Promise<{ reply: Reply; keepDraft: boolean }>,
  fields: string[]
) {
  return toolResult(async () => {
    let text: string
    try {
      text = await lessonText(deps, input, base)
    } catch (e) {
      if (!(e instanceof InputError)) throw e
      return {
        status: 400,
        body: { ok: false, error: e.code, message: e.message },
      }
    }
    const { reply, keepDraft } = await handle(text)
    const fits = new TextEncoder().encode(text).length <= LIMITS.lessonBytes
    if (keepDraft && fits) {
      const draftId = await deps.drafts.save(input.draftId ?? null, text)
      const body: Record<string, unknown> = { ...reply.body, draftId }
      if (body.ok !== true && Array.isArray(body.issues))
        body.message =
          `${String(body.message ?? "")} Send \`draftId\` with \`patches\` that fix every issue; don't resend the whole lesson.`.trim()
      return { ...reply, body }
    }
    if (input.draftId) await deps.drafts.delete(input.draftId)
    return reply
  }, [...fields, "draftId"])
}

class InputError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
  }
}

async function lessonText(
  deps: McpDeps,
  { lesson, draftId, patches }: LessonInput,
  base: string | null
): Promise<string> {
  if (lesson !== undefined && draftId !== undefined)
    throw new InputError(
      "bad_input",
      "Send either `lesson` or `draftId`, not both."
    )
  if (lesson !== undefined && patches?.length)
    throw new InputError(
      "bad_input",
      "Put the changes in `lesson`, or send `draftId` with `patches`."
    )
  if (lesson !== undefined) return lesson
  let source = base
  if (draftId !== undefined) {
    source = await deps.drafts.get(draftId)
    if (source === null)
      throw new InputError(
        "draft_not_found",
        "That draft doesn't exist or has expired (drafts last a day). Send the whole lesson as `lesson`."
      )
  }
  if (source === null)
    throw new InputError(
      "bad_input",
      "Send the lesson as `lesson`, or a `draftId` with `patches`."
    )
  if (!patches?.length) return source
  let data: unknown
  try {
    data = JSON.parse(source)
  } catch {
    throw new InputError(
      "bad_input",
      "The draft isn't valid JSON, so it can't be patched. Send the whole lesson as `lesson`."
    )
  }
  try {
    return JSON.stringify(applyPatches(data, patches))
  } catch (e) {
    if (e instanceof PatchError)
      throw new InputError("bad_patch", `${e.message} Nothing was changed.`)
    throw e
  }
}

const RATE_LIMITED: Reply = {
  status: 429,
  body: {
    ok: false,
    error: "rate_limited",
    message: "Too many requests from here recently. Try again later.",
  },
}

/**
 * Who the rate limits count: the logged-in account (one person, wherever they call from), or
 * else the IP of the HTTP request the tool call came in on.
 */
function clientOf(
  ctx: { http?: { req?: Request } },
  actor?: McpActor | null
): string {
  if (actor) return actor.limitKey
  return ctx.http?.req ? clientKey(ctx.http.req) : "local"
}

/**
 * Turns a handler's reply into a tool result. A failure keeps its whole body ({error, message,
 * issues}) so the model sees the checker's issues verbatim. Success keeps only `fields`: the
 * `skill` field nags CLI installs to update, and MCP clients always get the live guide.
 */
async function toolResult(handle: () => Promise<Reply>, fields: string[]) {
  let body: Record<string, unknown>
  try {
    body = (await handle()).body
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      body = { ok: false, error: "storage_not_configured", message: e.message }
    } else {
      console.error("MCP tool failed:", e)
      body = {
        ok: false,
        error: "server_error",
        message: "Something went wrong on the server. Try again in a minute.",
      }
    }
  }
  if (body.ok !== true) {
    const { skill: _skill, ...error } = body
    return errorResult(error)
  }
  const result = Object.fromEntries(
    fields.filter((f) => f in body).map((f) => [f, body[f]])
  )
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  }
}

function errorResult(error: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(error, null, 2) }],
    structuredContent: error,
    isError: true,
  }
}
