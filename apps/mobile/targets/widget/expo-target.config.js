/* global module */
// The home screen and lock screen widget: the day streak, the week's lanterns, and Continue with
// the lesson last left unfinished. Built into the Xcode project by @bacons/apple-targets on
// prebuild. It reads what the app writes to the shared App Group (src/lib/widget.ts) and runs no
// JavaScript. The colors are the app's (tokens.ts): the dark background and the streak's.

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "LearnWidget",
  displayName: "learn.ninja",
  icon: "../../assets/images/icon.png",
  deploymentTarget: "17.0",
  colors: {
    $widgetBackground: "#121212",
    $accent: "#ffb900",
    streakLit: "#ffb900",
    streakRest: "#2b7fff",
    streakCount: "#ff6900",
    muted: "#a1a1a1",
    foreground: "#fafafa",
  },
  images: {
    lantern: "./lantern.png",
    lanternLit: "./lantern-lit.png",
  },
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
})
