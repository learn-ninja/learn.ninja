import { getAuth } from "@/lib/auth/auth"

// RFC 9728 metadata for the MCP server: which authorization server issues its tokens and which
// scopes it takes. The `mcp` plugin serves it at /.well-known/oauth-protected-resource and
// /.well-known/oauth-protected-resource/mcp (the 401 from /mcp points at the latter); this route
// hands those requests to Better Auth, which Next otherwise only reaches under /api/auth.

async function handler(req: Request) {
  return (await getAuth()).handler(req)
}

export { handler as GET, handler as HEAD }
