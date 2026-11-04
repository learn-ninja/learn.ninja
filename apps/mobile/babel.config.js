// Expo's preset plus NativeWind's plugins. These are the three plugins `nativewind/babel` adds
// (react-native-css-interop/babel.js), listed here so the JSX plugin resolves from this app: the
// repo root holds Babel 8 for the shared lint config, and NativeWind's preset would look there.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: [
      require("react-native-css-interop/dist/babel-plugin").default,
      [
        require.resolve("@babel/plugin-transform-react-jsx"),
        { runtime: "automatic", importSource: "react-native-css-interop" },
      ],
      "react-native-reanimated/plugin",
    ],
  }
}
