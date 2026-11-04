// Expo configures Metro for the npm workspace on its own (SDK 52+); NativeWind adds the CSS.
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: "./src/global.css" })
