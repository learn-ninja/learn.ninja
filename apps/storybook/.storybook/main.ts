import { fileURLToPath } from "node:url"

import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"

const config: StorybookConfig = {
  // Stories live next to the components they show.
  stories: [
    "../../../packages/*/src/**/*.stories.@(ts|tsx)",
    "../../web/components/**/*.stories.@(ts|tsx)",
  ],
  framework: { name: "@storybook/react-vite", options: {} },
  // apps/web/public holds lesson-visuals.css, which HTML visuals load inside their sandbox.
  staticDirs: ["../../web/public"],
  async viteFinal(config) {
    config.plugins = [...(config.plugins ?? []), tailwindcss()]
    // The web app's tsconfig says "jsx": "preserve" (Next.js compiles JSX itself); here esbuild has to.
    config.esbuild = { ...(config.esbuild || {}), jsx: "automatic" }
    // The web app's own imports (@/components, @/lib), for its stories.
    config.resolve = {
      ...config.resolve,
      alias: {
        ...(config.resolve?.alias as Record<string, string> | undefined),
        "@": fileURLToPath(new URL("../../web", import.meta.url)),
      },
    }
    return config
  },
}

export default config
