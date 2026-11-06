import { appSiteAssociation } from "@/lib/app-links"

// GET /.well-known/apple-app-site-association: the links the iOS app opens (lib/app-links.ts). iOS
// fetches it through Apple's CDN when the app is installed, as JSON with no file extension.

export function GET() {
  const file = appSiteAssociation(process.env.APPLE_TEAM_ID)
  if (!file) return new Response("Not found", { status: 404 })
  return Response.json(file, {
    headers: { "cache-control": "public, max-age=3600" },
  })
}
