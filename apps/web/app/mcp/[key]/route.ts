import { getAuth } from "@/lib/auth/auth"
import { revalidateExplore } from "@/lib/explore/cache"
import { PostgresDraftStore } from "@/lib/mcp/drafts"
import { handlePersonalMcp } from "@/lib/mcp/personal"
import { getRateLimiter } from "@/lib/publish/rate-limit"
import { depsFor } from "@/lib/publish/request"
import { getDb } from "@/lib/publish/store"
import { skillBundle } from "@/lib/skill-files"

// /mcp/{key}: the learn.ninja MCP server for one account, from "Apps that can't log in" in the
// settings. The same tools as /mcp, but every lesson is published to the account (unlisted),
// and a key that doesn't work answers 401: nothing publishes anonymously here.

async function handler(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const db = await getDb()
  return handlePersonalMcp(req, (await params).key, await getAuth(), db, {
    ...(await depsFor(req)),
    validateLimiter: getRateLimiter("validate"),
    guide: skillBundle,
    drafts: new PostgresDraftStore(db),
    exploreChanged: revalidateExplore,
  })
}

export { handler as GET, handler as POST }
