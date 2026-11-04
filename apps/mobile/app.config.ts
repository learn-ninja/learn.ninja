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

export default ({ config }: ConfigContext): ExpoConfig => {
  const api = apiFor(profileOf())
  return {
    ...config,
    name: "learn.ninja",
    slug: "learn-ninja",
    version: "0.0.1",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "learnninja",
    userInterfaceStyle: "dark",
    backgroundColor: "#121212",
    ios: {
      bundleIdentifier: "ninja.learn.app",
      supportsTablet: true,
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
