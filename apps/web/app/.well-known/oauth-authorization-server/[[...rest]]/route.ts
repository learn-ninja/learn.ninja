import { getAuth } from "@/lib/auth/auth"

// RFC 8414 discovery for the OAuth server chat apps log in through. Better Auth serves it for
// its issuer (https://learn.ninja/api/auth) at the path-insertion form, /.well-known/
// oauth-authorization-server/api/auth, matching on the full pathname, but Next only routes
// /api/auth/* to it: this hands the request over. The /api/auth/.well-known/… form already works.

async function handler(req: Request) {
  return (await getAuth()).handler(req)
}

export { handler as GET, handler as HEAD }
