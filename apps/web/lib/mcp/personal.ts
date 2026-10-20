import { getActorByKey, InvalidApiKeyError } from "../auth/actor"
import type { Auth } from "../auth/auth"
import type { Db } from "@workspace/db"

import { createLearnMcp, type McpDeps } from "./server"

// /mcp/{key}: the MCP server for one account. The key comes from the settings page and stands
// for the account on its own, so the route checks it before any tool runs, and a bad key gets a
// 401 with nothing published: there's no anonymous fallback on this URL.

/** Handles one request to /mcp/{key}. Independent of Next.js so it can be tested directly. */
export async function handlePersonalMcp(
  req: Request,
  key: string,
  auth: Auth,
  db: Db,
  deps: Omit<McpDeps, "actor">
): Promise<Response> {
  let actor
  try {
    actor = await getActorByKey(auth, db, key)
  } catch (e) {
    if (!(e instanceof InvalidApiKeyError)) throw e
    return Response.json(
      { ok: false, error: "invalid_api_key", message: e.message },
      { status: 401 }
    )
  }
  return createLearnMcp({ ...deps, actor })(req)
}
