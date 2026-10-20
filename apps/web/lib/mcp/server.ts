import { createMcpHandler } from "mcp-handler"
import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { LIMITS } from "@workspace/spec"

import {
  checkLesson,
  publishLesson,
  reissueClaimToken,
  updateLesson,
  type Deps,
  type Reply,
} from "../publish/handlers"
import { tokenMatches } from "../publish/ids"
import type { RateLimiter } from "../publish/rate-limit"
import { clientKey } from "../publish/request"
import { StorageNotConfiguredError } from "../publish/store"
import { applyPatches, PatchError, type DraftStore, type Patch } from "./drafts"

// The learn.ninja MCP server at /mcp: the guide and the publish API as tools, for chat apps that
// can't run the skill's CLI. No accounts: lessons publish anonymously, and a user keeps one by
// opening the link `keep_lesson` (or `publish_lesson`) returns, which signs them in on learn.ninja.

export interface McpDeps extends Deps {
  /** The looser limit checks use, as /api/validate does. */
  validateLimiter: RateLimiter
  /** The skill's synced files (steps, guides, levels, schema), by path. */
  guide: () => { files: Record<string, string> }
  /** Lessons sent to the tools, kept so later calls can send patches. */
  drafts: DraftStore
}

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
            { text, client: clientOf(ctx) },
            { limiter: deps.validateLimiter }
          )
          return { reply, keepDraft: true }
        },
        ["ok", "spec"]
      )
  )

  server.registerTool(
    "publish_lesson",
    {
      title: "Publish a lesson",
      description:
        "Checks and publishes a lesson, and returns its link (`url`), which lasts 7 days. If the check fails, nothing is published: it returns the issues and a `draftId`, so call it again with `draftId` and `patches` that fix every issue, not the whole lesson. Keep the `id` and `editToken` to change it later with `update_lesson`. After the link, tell the user once, in one sentence: \"It lasts 7 days. To keep it, say so and I'll give you a link that saves it.\" Don't repeat it, and don't paste the keep link (`claimUrl`) until they say they want to keep the lesson; then paste it, or call `keep_lesson` for a fresh one. When `owner` is set, say instead that it's saved to @handle and, if `visibility` is public, listed in Explore.",
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
          const client = clientOf(ctx)
          // Check first against the looser limit, so fixing a lesson doesn't use up publishes.
          const checked = await checkLesson(
            { text, client },
            { limiter: deps.validateLimiter }
          )
          if (checked.body.ok !== true)
            return { reply: checked, keepDraft: true }
          const reply = await publishLesson(
            { text, client, ownerId: null },
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
      title: "Get a link that keeps a lesson",
      description:
        "Returns a link (`claimUrl`) that saves a published lesson to the user's learn.ninja account, so it stops expiring and is listed in Explore under their handle. Call it only when the user says they want to keep the lesson, then paste the link into the chat: opening it signs them in and keeps the lesson. Pass the `id` and `editToken` from `publish_lesson`. Each call makes a new link and the previous one stops working; a lesson already saved to an account answers `already_claimed`.",
      inputSchema: z.object({
        id: z.string().describe("The lesson's id, from `publish_lesson`."),
        editToken: z
          .string()
          .describe("The secret edit token, from `publish_lesson`."),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ({ id, editToken }, ctx) =>
      toolResult(
        // Minting a token is cheap, and chat apps share an egress IP: the checks' limit, not the publish one.
        () =>
          reissueClaimToken(
            { id, editToken, client: clientOf(ctx) },
            { ...deps, limiter: deps.validateLimiter }
          ),
        ["ok", "id", "url", "claimUrl", "expiresAt"]
      )
  )

  server.registerTool(
    "update_lesson",
    {
      title: "Update a published lesson",
      description:
        "Replaces a published lesson with a new version at the same link. Pass the `id` and `editToken` that `publish_lesson` returned, and either `patches` alone (applied to the published lesson: the quickest way to change a few things), the whole `lesson`, or a `draftId` with `patches`. If the check fails, it returns the issues and a `draftId` to patch.",
      inputSchema: z.object({
        id: z.string().describe("The lesson's id, from `publish_lesson`."),
        editToken: z
          .string()
          .describe("The secret edit token, from `publish_lesson`."),
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
      const client = clientOf(ctx)
      const update = (text: string) =>
        updateLesson({ id, editToken, text, client }, deps)
      // Patches alone change the published lesson. Read it only for the right token, so a wrong
      // one gets updateLesson's own not_found or unauthorized reply.
      let base: string | null = null
      if (!input.lesson && !input.draftId && input.patches) {
        const existing = await deps.store.get(id)
        if (!existing || !tokenMatches(editToken, existing.editTokenHash))
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
        ["ok", "id", "url", "expiresAt", "owner", "visibility"]
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

/** The caller's IP for rate limits, from the HTTP request the tool call came in on. */
function clientOf(ctx: { http?: { req?: Request } }): string {
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
