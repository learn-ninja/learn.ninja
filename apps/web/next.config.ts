import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { NextConfig } from "next"
import optimizeLocales from "@react-aria/optimize-locales-plugin"
import { createMDX } from "fumadocs-mdx/next"

// Languages whose built-in React Aria strings we ship: one per player language (UI_LANGUAGES in
// packages/player/src/strings.ts). React Aria keys them by full locale, Arabic as ar-AE: a code it
// doesn't know (e.g. ar-EG) silently strips that language's strings.
const LOCALES = [
  "en-US",
  "es-ES",
  "pt-BR",
  "fr-FR",
  "de-DE",
  "it-IT",
  "nl-NL",
  "pl-PL",
  "ru-RU",
  "uk-UA",
  "tr-TR",
  "ar-AE",
  "he-IL",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "zh-TW",
]

// Requests that don't accept HTML (curl, agents) get Markdown for the home page and docs.
// The router's own RSC requests don't ask for HTML either, so they're left out.
const NOT_HTML = {
  has: [
    { type: "header" as const, key: "accept", value: "^(?!.*text/html).*$" },
  ],
  missing: [{ type: "header" as const, key: "rsc" }],
}

// Lesson pages show LLM-written HTML in sandboxed frames (see HtmlFrame in packages/player). A srcdoc
// frame inherits the page's policy, so this is what stops a visual from loading or navigating to
// anything off-site, whatever the publish-time checks missed. Scripts stay 'unsafe-inline' because
// Next.js streams its own inline scripts; the sandbox already blocks scripts inside visuals.
const DEV = process.env.NODE_ENV === "development"
const LESSON_CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${DEV ? " ws: wss:" : ""}`,
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

// The stylesheet lesson visuals load (public/lesson-visuals.css, built by predev/prebuild before this
// runs). Its URL carries a hash of its contents, so versioned requests are cached for a year: a deploy
// that changes the file changes the URL. Without the file, the plain URL keeps the default no-cache.
function visualsCssUrl(): string {
  try {
    const css = readFileSync(join(process.cwd(), "public/lesson-visuals.css"))
    const v = createHash("sha256").update(css).digest("hex").slice(0, 12)
    return `/lesson-visuals.css?v=${v}`
  } catch {
    return "/lesson-visuals.css"
  }
}

/** Files prepareLesson() and the diagram check read at runtime (see outputFileTracingIncludes). */
const PREPARE_FILES = [
  "../../node_modules/tailwindcss/*.css",
  "../../node_modules/tailwindcss/package.json",
  "../../node_modules/@terrastruct/d2/package.json",
  "../../node_modules/@terrastruct/d2/dist/node-esm/*",
]

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_VISUALS_CSS: visualsCssUrl() },
  transpilePackages: [
    "@workspace/ui",
    "@workspace/cli",
    "@workspace/player",
    "@workspace/spec",
    "@workspace/db",
  ],
  // PGlite (lesson storage in development) loads its WebAssembly and data files from its own folder;
  // D2.js finds its WASM build and worker next to its own file. Bundling would move both. OpenChemLib
  // is a megabyte of compiled Java, already minified: bundling it again only slows the build.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@terrastruct/d2",
    "openchemlib",
  ],
  // GitHub profile pictures are served from our own origin (see UserAvatar): after a client-side
  // visit to a lesson page, the document keeps LESSON_CSP, which blocks off-site images.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/u/**",
      },
    ],
  },
  // PGlite (21 MB) is the database only when DATABASE_URL is unset, which a deployment never is: its
  // file system is read-only, so Neon is the only database there. Kept out of every function.
  outputFileTracingExcludes: {
    "*": ["../../node_modules/@electric-sql/pglite/**"],
  },
  // prepareLesson() reads Tailwind's own stylesheets at runtime to compile each lesson's visuals CSS,
  // and D2.js loads its WASM build and worker by path, so they must ship with the server functions
  // that check, publish, and render lessons.
  outputFileTracingIncludes: {
    "/api/lessons": PREPARE_FILES,
    "/api/lessons/[id]": PREPARE_FILES,
    "/api/validate": PREPARE_FILES,
    // The MCP server also serves the skill's guides at runtime (get_guide reads skills/learn/).
    ...Object.fromEntries(
      ["/mcp", "/mcp/[key]"].map((route) => [
        route,
        [
          ...PREPARE_FILES,
          "../../skills/learn/*.md",
          "../../skills/learn/levels/*.md",
          "../../skills/learn/reference/*.md",
          "../../skills/learn/schema/*.json",
        ],
      ])
    ),
    "/lessons/[slug]": PREPARE_FILES,
    "/docs/[[...slug]]": PREPARE_FILES,
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", ...NOT_HTML, destination: "/index.md" },
        { source: "/docs", ...NOT_HTML, destination: "/llm" },
        // Not /docs/{page}.md: that's already Markdown (see afterFiles).
        {
          source: "/docs/:path((?!.*\\.md$).+)",
          ...NOT_HTML,
          destination: "/llm/:path",
        },
      ],
      afterFiles: [
        { source: "/docs.md", destination: "/llm" },
        { source: "/docs/:path*.md", destination: "/llm/:path*" },
      ],
      fallback: [],
    }
  },
  async headers() {
    return [
      ...["/", "/docs", "/docs/:path*"].map((source) => ({
        source,
        headers: [{ key: "Vary", value: "Accept" }],
      })),
      ...["/l/:path*", "/lessons/:path*"].map((source) => ({
        source,
        headers: [{ key: "Content-Security-Policy", value: LESSON_CSP }],
      })),
      // Only the hashed URL (see visualsCssUrl) is safe to keep; a plain request still revalidates.
      {
        source: "/lesson-visuals.css",
        has: [{ type: "query" as const, key: "v" }],
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // The ninja's spoken lines: each clip's name is a hash of its voice and text, so it never changes.
      {
        source: "/voice/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
  async redirects() {
    // Pages that were cut or moved; their Markdown moved too. The docs are a page per file in
    // docs/, so a cut page points at the page that covers it now, with an anchor where there's a heading.
    const moved = (from: string, to: string) => [
      { source: from, destination: to, permanent: true },
      { source: `${from}.md`, destination: `${to.split("#")[0]}.md`, permanent: true },
    ]
    return [
      // Once logged in, Explore is home. The header's marker cookie (lib/auth/browser.ts) says so
      // without a session check, so the home page stays static for everyone else. A stale marker
      // lands on Explore logged out, which clears it; logging out clears it before going home.
      {
        source: "/",
        has: [{ type: "cookie", key: "learn.account", value: ".+" }],
        destination: "/explore",
        permanent: false,
      },
      { source: "/create", destination: "/docs", permanent: false },
      // The login page was /sign-in until October 2026; old links and keep emails still point there.
      { source: "/sign-in", destination: "/login", permanent: true },
      // The contributors list became part of the mission page in November 2026.
      { source: "/contributors", destination: "/mission", permanent: true },
      ...moved("/docs/install", "/docs#install"),
      ...moved("/docs/quick-start", "/docs"),
      ...moved("/docs/reference/agents", "/docs#plain-text"),
      ...moved("/docs/lessons/how-lessons-work", "/docs/lessons/lesson-format"),
      ...moved("/docs/lessons/sharing", "/docs/reference/api"),
      ...moved("/docs/katas", "/docs/lessons/lesson-format#the-question-katas"),
      // Subjects were folded into the skill's teaching guide.
      ...moved("/docs/subjects", "/docs"),
      ...moved("/docs/skills", "/docs"),
      {
        source: "/docs/katas/:path+",
        destination: "/docs/lessons/lesson-format#the-question-katas",
        permanent: true,
      },
      {
        source: "/docs/:dir(skills|subjects)/:path+.md",
        destination: "/docs.md",
        permanent: true,
      },
      {
        source: "/docs/:dir(skills|subjects)/:path+",
        destination: "/docs",
        permanent: true,
      },
    ]
  },
  // Builds use webpack (next dev/build --webpack): the locale plugin doesn't support Turbopack.
  webpack(config, { isServer }) {
    if (!isServer) {
      config.plugins.push(optimizeLocales.webpack({ locales: LOCALES }))
    }
    return config
  },
}

export default createMDX()(nextConfig)
