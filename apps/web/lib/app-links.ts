// The apple-app-site-association file: which of the site's links open in the iOS app instead of
// Safari. A lesson (/l/{slug}-{id}) and a profile (/u/{handle}), nothing else, for the app with
// bundle id ninja.learn.ios (apps/mobile/app.config.ts) under the Team ID in APPLE_TEAM_ID. Without
// one there's no app to name, so the file isn't served: iOS keeps opening links in Safari.
// `webcredentials` lets the app's GitHub log-in sheet end on https://learn.ninja/app/signed-in
// (lib/auth/app-github.ts): iOS hands that URL only to an app the site names here.

export const APP_BUNDLE_ID = "ninja.learn.ios"

/** The paths the app opens, as the app's own routes have them. */
export const APP_LINK_PATHS = ["/l/*", "/u/*"]

export function appSiteAssociation(teamId: string | undefined) {
  const team = teamId?.trim()
  if (!team || !/^[A-Z0-9]{10}$/.test(team)) return null
  const appID = `${team}.${APP_BUNDLE_ID}`
  return {
    applinks: {
      details: [
        {
          appIDs: [appID],
          components: APP_LINK_PATHS.map((path) => ({ "/": path })),
        },
      ],
    },
    webcredentials: { apps: [appID] },
  }
}
