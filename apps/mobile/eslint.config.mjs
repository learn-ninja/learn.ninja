import globals from "globals"

import { config } from "@workspace/eslint-config/react-internal"

/** @type {import("eslint").Linter.Config} */
export default [
  { ignores: [".expo/**", "ios/**", "android/**", "expo-env.d.ts"] },
  ...config,
  // The linter parses with the repo's own Babel setup, not the app's babel.config.js (Expo's preset).
  {
    languageOptions: {
      parserOptions: { babelOptions: { configFile: false, babelrc: false } },
    },
  },
  // The Metro, Babel, and Tailwind configs and the scripts run in Node.
  {
    files: ["*.js", "scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
]
