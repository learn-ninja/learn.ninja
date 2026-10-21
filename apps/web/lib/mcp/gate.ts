import { createMcpProtectedRequestHandler } from "@better-auth/mcp"

import type { Db } from "@workspace/db"

import { getActorByUserId, type McpActor } from "../auth/actor"
import { MCP_SCOPE } from "../auth/auth"

// The sign-in gate in front of the public /mcp. Anyone can call the tools that need no account;
// when a chat app calls one that does (`keep_lesson`) without a token, the HTTP request itself is
// refused with 401 and a `WWW-Authenticate` header naming the server's discovery document. That is
// what makes Claude, ChatGPT, and Claude Code show their sign-in prompt, run the OAuth flow against
// Better Auth, and retry the same call with a token; a tool result saying "sign in" would not. A
// request that carries a token is verified whichever tool it calls (signature against /jwks,
// issuer, audience, scope), and the tools then act as that account.

/** Tools that need the user's account. Everything else works anonymously, and better with a token. */
export const PROTECTED_TOOLS: ReadonlySet<string> = new Set(["keep_lesson"])

/** Whether a JSON-RPC body (one message or a batch) calls a tool in PROTECTED_TOOLS. */
export function callsProtectedTool(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body]
  return messages.some((m) => {
    if (!m || typeof m !== "object") return false
    const { method, params } = m as { method?: unknown; params?: { name?: unknown } }
    return (
      method === "tools/call" &&
      typeof params?.name === "string" &&
      PROTECTED_TOOLS.has(params.name)
    )
  })
}

export interface GateOptions {
  db: Db
  /** The OAuth issuer: Better Auth's base URL (https://learn.ninja/api/auth). Tokens must name it. */
  issuer: string
  /** The MCP server's canonical URL; tokens are bound to it. */
  resource: string
  /** Builds the MCP handler for one request, as the actor (null: anonymous). */
  build: (actor: McpActor | null) => (req: Request) => Promise<Response>
}

/** Wraps the MCP handler with the gate described above. */
export function gateMcp({
  db,
  issuer,
  resource,
  build,
}: GateOptions): (req: Request) => Promise<Response> {
  const withToken = createMcpProtectedRequestHandler(
    {
      issuer,
      audience: resource,
      jwksUrl: `${issuer}/jwks`,
      requiredScopes: [MCP_SCOPE],
      // A session JWT from the jwt plugin is signed with the same keys; only OAuth tokens carry `azp`.
      jwtVerifyOptions: { requiredClaims: ["azp"] },
    },
    async (req, claims) => {
      const actor =
        typeof claims.sub === "string" ? await getActorByUserId(db, claims.sub) : null
      if (!actor) return noSuchAccount(resource)
      return build(actor)(req)
    }
  )
  return async (req) => {
    if (req.headers.has("authorization")) return withToken(req)
    if (req.method === "POST") {
      const body: unknown = await req
        .clone()
        .json()
        .catch(() => null)
      // No token and a protected tool: this is the 401 that starts sign-in.
      if (callsProtectedTool(body)) return withToken(req)
    }
    return build(null)(req)
  }
}

/** The 401 for a valid token whose user is gone or banned: the app treats it as signed out. */
function noSuchAccount(resource: string): Response {
  const metadata = new URL(resource)
  metadata.pathname = `/.well-known/oauth-protected-resource${metadata.pathname}`
  return Response.json(
    { error: "invalid_token", error_description: "This account can't sign in." },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer error="invalid_token", error_description="This account can't sign in.", resource_metadata="${metadata.href}", scope="${MCP_SCOPE}"`,
      },
    }
  )
}
