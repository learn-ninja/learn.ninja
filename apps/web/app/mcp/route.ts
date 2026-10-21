import { getDb } from "@/lib/publish/store"
import { mcpResourceFromEnv, oauthIssuerFromEnv } from "@/lib/auth/auth"
import { revalidateExplore } from "@/lib/explore/cache"
import { PostgresDraftStore } from "@/lib/mcp/drafts"
import { gateMcp } from "@/lib/mcp/gate"
import { createLearnMcp } from "@/lib/mcp/server"
import { getRateLimiter } from "@/lib/publish/rate-limit"
import { depsFor } from "@/lib/publish/request"
import { skillBundle } from "@/lib/skill-files"

// /mcp: the learn.ninja MCP server (spec 2026-07-28, stateless; 2025-era clients fall back to
// stateless Streamable HTTP). No cookies: lessons publish anonymously until the chat app signs the
// user in over OAuth (lib/mcp/gate.ts), after which every call carries a token and publishes to
// the account. /mcp/{key} is the twin for apps that can't sign in.

async function handler(req: Request) {
  const db = await getDb()
  const deps = {
    ...(await depsFor(req)),
    validateLimiter: getRateLimiter("validate"),
    guide: skillBundle,
    drafts: new PostgresDraftStore(db),
    exploreChanged: revalidateExplore,
  }
  return gateMcp({
    db,
    issuer: oauthIssuerFromEnv(),
    resource: mcpResourceFromEnv(),
    build: (actor) => createLearnMcp({ ...deps, actor }),
  })(req)
}

export { handler as GET, handler as POST }
