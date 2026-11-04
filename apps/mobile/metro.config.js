// Expo configures Metro for the npm workspace on its own (SDK 52+); NativeWind adds the CSS.
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, {
  input: "./src/global.css",
  // A rem is 16 points, as on the web, so p-4 is 16 and h-12 is 48. NativeWind's own default is 14,
  // which drew every spacing, height, and width class at seven eighths of the web's.
  inlineRem: 16,
})
