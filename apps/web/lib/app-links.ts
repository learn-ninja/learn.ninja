// The apple-app-site-association file: which of the site's links open in the iOS app instead of
// Safari. A lesson (/l/{slug}-{id}) and a profile (/u/{handle}), nothing else, for the app with
// bundle id ninja.learn.app (apps/mobile/app.config.ts) under the Team ID in APPLE_TEAM_ID. Without
// one there's no app to name, so the file isn't served: iOS keeps opening links in Safari.

export const APP_BUNDLE_ID = "ninja.learn.app"

/** The paths the app opens, as the app's own routes have them. */
export const APP_LINK_PATHS = ["/l/*", "/u/*"]

export function appSiteAssociation(teamId: string | undefined) {
  const team = teamId?.trim()
  if (!team || !/^[A-Z0-9]{10}$/.test(team)) return null
  return {
    applinks: {
      details: [
        {
          appIDs: [`${team}.${APP_BUNDLE_ID}`],
          components: APP_LINK_PATHS.map((path) => ({ "/": path })),
        },
      ],
    },
  }
}
