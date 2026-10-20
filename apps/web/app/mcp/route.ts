import { getAuth } from "@/lib/auth/auth"
import { revalidateExplore } from "@/lib/explore/cache"
import { PostgresDraftStore } from "@/lib/mcp/drafts"
import { createLearnMcp } from "@/lib/mcp/server"
import { getRateLimiter } from "@/lib/publish/rate-limit"
import { depsFor } from "@/lib/publish/request"
import { getDb } from "@/lib/publish/store"
import { skillBundle } from "@/lib/skill-files"

// /mcp: the learn.ninja MCP server (spec 2026-07-28, stateless; 2025-era clients fall back to
// stateless Streamable HTTP). No accounts, no cookies: lessons publish anonymously, and
// `keep_lesson` moves one into an account with an email code. /mcp/{key} is the signed-in twin.

async function handler(req: Request) {
  const mcp = createLearnMcp({
    ...(await depsFor(req)),
    auth: await getAuth(),
    validateLimiter: getRateLimiter("validate"),
    guide: skillBundle,
    drafts: new PostgresDraftStore(await getDb()),
    exploreChanged: revalidateExplore,
  })
  return mcp(req)
}

export { handler as GET, handler as POST }
