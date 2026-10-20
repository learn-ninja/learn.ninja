// Tags: up to five free words per lesson that say what it's specifically about (`git`,
// `compound-interest`). They're stored from day one and shown nowhere yet; once enough lessons
// share a tag, it can earn a filter inside its subject. Free tags drift into variants within
// weeks (Stack Overflow's lesson), so the checker normalizes spelling before validating and maps
// known variants to one canonical tag through the synonym table below. plans/subjects-and-tags.md
// says why.

/** Lowercase words (any script) joined by single hyphens: `claude-code`, `bronze-age`, `historia`. */
export const TAG_PATTERN =
  /^[\p{Ll}\p{Lo}\p{Lm}\p{M}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{Lm}\p{M}\p{N}]+)*$/u

export const TAG_LIMITS = { min: 2, max: 30, perLesson: 5 } as const

/**
 * Known variants of a tag, each mapped to the one the lesson keeps. Grown by hand from the tag
 * report (`npm run tags -w web`, phase 2). Keys and values are already normalized.
 */
export const TAG_SYNONYMS: Record<string, string> = {
  // Programming
  js: "javascript",
  ts: "typescript",
  py: "python",
  golang: "go",
  "c-plus-plus": "cpp",
  "c-sharp": "csharp",
  node: "nodejs",
  "node-js": "nodejs",
  reactjs: "react",
  "react-js": "react",
  "next-js": "nextjs",
  vuejs: "vue",
  "vue-js": "vue",
  postgres: "postgresql",
  k8s: "kubernetes",
  regexp: "regex",
  "regular-expressions": "regex",
  "regular-expression": "regex",
  cicd: "ci-cd",
  oop: "object-oriented-programming",
  "object-oriented": "object-oriented-programming",
  "unit-tests": "unit-testing",
  "unit-test": "unit-testing",
  // AI
  claudecode: "claude-code",
  "claude-code-cli": "claude-code",
  llms: "llm",
  "large-language-models": "llm",
  "large-language-model": "llm",
  ml: "machine-learning",
  prompting: "prompt-engineering",
  prompts: "prompt-engineering",
  genai: "generative-ai",
  "gen-ai": "generative-ai",
  // Tools
  vscode: "vs-code",
  "visual-studio-code": "vs-code",
  "git-hub": "github",
  "ms-excel": "excel",
  "microsoft-excel": "excel",
  gsheets: "google-sheets",
  "mac-os": "macos",
  osx: "macos",
  // Design
  ux: "user-experience",
  "ux-design": "user-experience",
  ui: "user-interface",
  "ui-design": "user-interface",
  "design-systems": "design-system",
  // Business and marketing
  startup: "startups",
  "start-up": "startups",
  "start-ups": "startups",
  "ab-testing": "a-b-testing",
  "ab-tests": "a-b-testing",
  "search-engine-optimization": "seo",
  "product-manager": "product-management",
  "project-managers": "project-management",
  // Money and math
  compounding: "compound-interest",
  stats: "statistics",
  // Everything else
  "how-to-learn": "learning",
  "job-interviews": "interviews",
  "job-interview": "interviews",
  interviewing: "interviews",
}

/**
 * The spelling the checker settles on before validating: trimmed, lowercased, a leading `#` gone,
 * and runs of spaces, underscores, punctuation, or symbols folded to one hyphen. Then the synonym
 * table. Anything that still breaks the pattern is for the schema to report.
 */
export function normalizeTag(tag: string): string {
  const folded = tag
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[\s_\p{P}\p{S}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
  return TAG_SYNONYMS[folded] ?? folded
}

/** What normalizing a lesson's tags changed, as the checker tells the agent (a note, not an error). */
export interface TagChange {
  path: string
  from: string
  to: string
}

/**
 * Normalizes `tags` on parsed lesson data in place of the original, so the schema sees canonical
 * spellings. Returns what changed; unchanged tags, and anything that isn't an array of strings
 * (the schema reports those), pass through as they are.
 */
export function normalizeLessonTags(data: unknown): {
  data: unknown
  changes: TagChange[]
} {
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return { data, changes: [] }
  const { tags } = data as { tags?: unknown }
  if (!Array.isArray(tags)) return { data, changes: [] }
  const changes: TagChange[] = []
  const normalized = tags.map((tag, i) => {
    if (typeof tag !== "string") return tag
    const to = normalizeTag(tag)
    if (to !== tag) changes.push({ path: `tags[${i}]`, from: tag, to })
    return to
  })
  return changes.length
    ? { data: { ...data, tags: normalized }, changes }
    : { data, changes }
}
