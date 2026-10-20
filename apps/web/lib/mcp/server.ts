import { createMcpHandler } from "mcp-handler"
import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { LIMITS } from "@workspace/spec"

import type { KeyActor } from "../auth/actor"
import type { Auth } from "../auth/auth"
import {
  checkLesson,
  claimLesson,
  mayEdit,
  publishLesson,
  reissueClaimToken,
  updateLesson,
  type Deps,
  type Reply,
} from "../publish/handlers"
import type { RateLimiter } from "../publish/rate-limit"
import { clientKey } from "../publish/request"
import { StorageNotConfiguredError } from "../publish/store"
import { applyPatches, PatchError, type DraftStore, type Patch } from "./drafts"
import { keepByEmail } from "./keep"

// The learn.ninja MCP server: the guide and the publish API as tools, for chat apps that can't
// run the skill's CLI. At /mcp there are no accounts: lessons publish anonymously, and a user
// keeps one from the chat with an email code (`keep_lesson`), or by opening the link it returns.
// At /mcp/{key}, a personal URL from the settings page, the route resolves the account first
// (`actor`) and every lesson is published to it, unlisted.

export interface McpDeps extends Deps {
  /** Better Auth, for the email code `keep_lesson` sends and checks. */
  auth: Auth
  /** The looser limit checks use, as /api/validate does. */
  validateLimiter: RateLimiter
  /** The skill's synced files (steps, guides, levels, schema), by path. */
  guide: () => { files: Record<string, string> }
  /** Lessons sent to the tools, kept so later calls can send patches. */
  drafts: DraftStore
  /** The account behind a personal URL; absent on the public /mcp. */
  actor?: KeyActor | null
  /** Called when a lesson becomes listed in Explore (a keep), so cached lists refresh. */
  exploreChanged?: () => void
}

/** The keep sentence the model says once after an anonymous publish, on every surface (steps.md step 6). */
export const KEEP_SENTENCE =
  "It lasts 7 days. To keep it, say so and I'll save it under your email."

const INSTRUCTIONS =
  "learn.ninja turns anything into one short, interactive lesson with a shareable link. Call `get_guide` once before writing a lesson: it returns the whole guide, then follow its steps."

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
    serverInfo: { name: "learn.ninja", version: "1.2.0" },
    instructions: INSTRUCTIONS,
  })
}

function registerTools(server: McpServer, deps: McpDeps) {
  const actor = deps.actor ?? null

  server.registerTool(
    "get_guide",
    {
      title: "Read the lesson guide",
      description:
        "Returns the guide for writing a learn.ninja lesson. Call it once with `all` (the default) before writing: the steps, planning, teaching, format, and level guides together.",
      inputSchema: z.object({
        section: z
          .enum(SECTIONS)
          .default("all")
          .describe(
            "all: every guide but the schema. steps: what to do, in order. planning: scope, size, reading age. teaching: how to teach, which brick to use, visuals. format: every field of the lesson file. levels: picking the level, and each level's guide. schema: the formal JSON Schema, rarely needed."
          ),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
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
      description:
        "Checks a lesson with the rules publishing uses, without publishing it. Usually skip this and call `publish_lesson`, which runs the same checks. Returns a `draftId` either way: fix the issues by sending `draftId` and `patches`, not the whole lesson.",
      inputSchema: z.object(lessonInput),
      annotations: { readOnlyHint: false, openWorldHint: false },
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
    ? `Lessons are saved to ${actor.handle ? `@${actor.handle}` : "the user's account"} (this URL is theirs) and start unlisted, so drafts don't show in Explore. After the link, say once: "Saved to ${actor.handle ? `@${actor.handle}` : "your account"}; list it in Explore at learn.ninja/settings${actor.handle ? "" : ", where you can also pick a handle"}."`
    : null

  server.registerTool(
    "publish_lesson",
    {
      title: "Publish a lesson",
      description: `Checks and publishes a lesson, and returns its link (\`url\`). If the check fails, nothing is published: it returns the issues and a \`draftId\`, so call it again with \`draftId\` and \`patches\` that fix every issue, not the whole lesson. Keep the \`id\` and \`editToken\` to change it later with \`update_lesson\`. ${
        owned ??
        `The link lasts 7 days. After it, tell the user once, in one sentence: "${KEEP_SENTENCE}" Don't repeat it, and never paste the keep link (\`claimUrl\`) on your own. When they say they want to keep the lesson, ask for their email and call \`keep_lesson\`.`
      }`,
      inputSchema: z.object(lessonInput),
      annotations: {
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
          "editToken",
          "claimUrl",
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
      description: actor
        ? `Saves a lesson that was published anonymously (in another chat, or through the public learn.ninja/mcp) to ${actor.handle ? `@${actor.handle}` : "the user's account"}, given its \`id\` and \`editToken\`. Lessons published here are already saved, so it's rarely needed.`
        : `Saves a published lesson to the user's learn.ninja account, so it stops expiring and is listed in Explore under their handle. Call it only when the user says they want to keep the lesson. Pass the \`id\` and \`editToken\` from \`publish_lesson\`. Three ways: with \`email\`, it emails them a six-digit code (then ask for the code); with \`email\` and \`code\`, it signs them in and keeps the lesson, and the reply names the account (\`owner.handle\`, \`visibility\`); with neither, it returns a link (\`claimUrl\`) to paste instead, which keeps the lesson when opened in a browser. A wrong code answers \`sign_in_failed\`: ask again, or call without a code for a new one. A lesson already in an account answers \`already_claimed\`.`,
      inputSchema: z.object({
        id: z.string().describe("The lesson's id, from `publish_lesson`."),
        editToken: z
          .string()
          .describe("The secret edit token, from `publish_lesson`."),
        email: z
          .string()
          .optional()
          .describe(
            "The user's email address, to send a sign-in code to. Ask them for it; never guess it."
          ),
        code: z
          .string()
          .optional()
          .describe(
            "The six-digit code the user got by email, on the second call. Needs `email` too."
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ({ id, editToken, email, code }, ctx) => {
      // Keeping is cheap, and chat apps share an egress IP: the checks' limit, not the publish one.
      const limited = { ...deps, limiter: deps.validateLimiter }
      const client = clientOf(ctx, actor)
      const kept = [
        "ok",
        "id",
        "url",
        "title",
        "expiresAt",
        "owner",
        "visibility",
      ]
      if (actor) {
        return toolResult(async () => {
          if (!(await limited.limiter.allow(client)))
            return RATE_LIMITED
          const reply = await claimLesson(
            { id, editToken, ownerId: actor.userId },
            { ...deps, handleOf: async () => actor.handle }
          )
          if (reply.status === 200) deps.exploreChanged?.()
          return reply
        }, kept)
      }
      if (code && !email) {
        return errorResult({
          ok: false,
          error: "bad_input",
          message: "Send `email` with the `code`: the same address the code was sent to.",
        })
      }
      if (email) {
        return toolResult(async () => {
          const reply = await keepByEmail(
            { id, editToken, email, code, client },
            limited
          )
          if (reply.status === 200 && reply.body.owned)
            deps.exploreChanged?.()
          return reply
        }, [...kept, "sent", "email", "message"])
      }
      return toolResult(
        () => reissueClaimToken({ id, editToken, client }, limited),
        ["ok", "id", "url", "claimUrl", "expiresAt", "notes"]
      )
    }
  )

  server.registerTool(
    "update_lesson",
    {
      title: "Update a published lesson",
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
 * Who the rate limits count: the key behind a personal URL (one person, wherever they call from),
 * or else the IP of the HTTP request the tool call came in on.
 */
function clientOf(
  ctx: { http?: { req?: Request } },
  actor?: KeyActor | null
): string {
  if (actor) return `key:${actor.keyId}`
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
