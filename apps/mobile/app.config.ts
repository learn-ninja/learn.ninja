import type { ConfigContext, ExpoConfig } from "expo/config"

// The app's Expo config. Where lessons come from depends on the build: a development build (a
// local `expo run:ios`, or EAS's "development" profile) reads the web dev server on localhost
// and may reach the local network; preview and production builds read https://learn.ninja and
// get no exception from App Transport Security. EXPO_PUBLIC_API_BASE_URL overrides the base URL
// for any build (src/lib/config.ts).

export type Profile = "development" | "preview" | "production"

/** EAS sets EAS_BUILD_PROFILE while it builds; anything else is a local development build. */
export function profileOf(
  env: Record<string, string | undefined> = process.env
): Profile {
  const profile = env.EAS_BUILD_PROFILE
  return profile === "preview" || profile === "production"
    ? profile
    : "development"
}

export function apiFor(profile: Profile) {
  return profile === "development"
    ? { baseUrl: "http://localhost:3000", localNetworking: true }
    : { baseUrl: "https://learn.ninja", localNetworking: false }
}

/**
 * The site the app opens links from: https://learn.ninja/l/{slug}-{id} and /u/{handle} open in the
 * app once iOS has read the site's apple-app-site-association (apps/web/app/.well-known/), which
 * names this app by its Apple Team ID. Not www.learn.ninja: it answers every path, the association
 * file included, with a redirect to learn.ninja (Vercel's domain setting, before the app runs), and
 * Apple's CDN doesn't follow redirects, so a www entry could never validate. A www link opens in
 * the browser instead (links the site and the app share use learn.ninja).
 */
export const LINK_DOMAINS = ["applinks:learn.ninja"]

/** The App Group the app shares with its widget; src/lib/widget-snapshot.ts writes to the same one. */
export const APP_GROUP = "group.ninja.learn.app"

export default ({ config }: ConfigContext): ExpoConfig => {
  const api = apiFor(profileOf())
  return {
    ...config,
    name: "learn.ninja",
    slug: "learn-ninja",
    // The App Store version; the build number is EAS's (eas.json: remote, raised on each production build).
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "learnninja",
    userInterfaceStyle: "dark",
    backgroundColor: "#121212",
    ios: {
      bundleIdentifier: "ninja.learn.app",
      // iPhone only for the first release: an iPad app must support every
      // orientation or run full screen, and the player is portrait only.
      supportsTablet: false,
      // No encryption beyond HTTPS: answers App Store Connect's export compliance question.
      config: { usesNonExemptEncryption: false },
      // The reasons the app (and its widget) read UserDefaults, for Apple's privacy manifest: its
      // own settings (CA92.1), and the App Group it shares with the widget (1C8F.1). The Expo
      // modules bring their own manifests.
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType:
              "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1", "1C8F.1"],
          },
        ],
      },
      associatedDomains: LINK_DOMAINS,
      // Shared with the home screen widget (targets/widget), which reads the streak the app
      // writes there (src/lib/widget.ts).
      entitlements: { "com.apple.security.application-groups": [APP_GROUP] },
      ...(api.localNetworking
        ? {
            infoPlist: {
              NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
            },
          }
        : {}),
    },
    android: {
      package: "ninja.learn.app",
      adaptiveIcon: {
        backgroundColor: "#121212",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
    },
    plugins: [
      "expo-router",
      // The Apple targets in targets/ (the widget), added to the generated Xcode project.
      "@bacons/apple-targets",
      "expo-secure-store",
      // Right to left when the device's language is (I18nManager.isRTL at launch); a screen in
      // another direction than the app's sets its own (src/components/direction.tsx).
      ["expo-localization", { supportsRTL: true }],
      [
        "expo-splash-screen",
        {
          backgroundColor: "#121212",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      ],
    ],
    experiments: { reactCompiler: true },
    extra: { apiBaseUrl: api.baseUrl },
  }
}
