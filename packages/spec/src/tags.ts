// Tags: one to five short labels per lesson that say what it's specifically about, written the way
// a reader should see them ("Claude Code", "Compound interest"). The first is the lesson's label on
// Explore rows and the title screen. Each label also has a key (`claude-code`, `compound-interest`):
// the slug the checker derives from it, which the redundancy and duplicate rules compare and the
// lesson_tag table indexes, so "JavaScript" and "JS" count as one tag. Free tags drift into variants
// within weeks (Stack Overflow's lesson), so the key folds spelling and maps known variants through
// the synonym table below.

/**
 * A label as the lesson keeps it: letters (any script), digits, spaces, and - + # . & / ' between
 * them ("Higher-order functions", "C++", "A/B testing"), not starting with #. The checker trims it
 * and collapses whitespace first (normalizeLabel).
 */
export const TAG_LABEL_PATTERN =
  /^[\p{L}\p{M}\p{N}\-+.&/'’](?:[\p{L}\p{M}\p{N}\-+#.&/'’ ]*[\p{L}\p{M}\p{N}\-+#.&/'’])?$/u

/** A key: lowercase words (any script) joined by single hyphens: `claude-code`, `bronze-age`, `historia`. */
export const TAG_PATTERN =
  /^[\p{Ll}\p{Lo}\p{Lm}\p{M}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{Lm}\p{M}\p{N}]+)*$/u

export const TAG_LIMITS = { min: 2, max: 30, perLesson: 5 } as const

/**
 * Known variants of a key, each mapped to the one the index keeps. Grown by hand from the tag
 * report (`npm run tags -w web`). Keys and values are already in key form.
 */
export const TAG_SYNONYMS: Record<string, string> = {
  // Programming
  js: "javascript",
  ts: "typescript",
  py: "python",
  golang: "go",
  "c-plus-plus": "cpp",
  "c-sharp": "csharp",
  "f-sharp": "fsharp",
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
 * Names whose punctuation means something, mapped to a key before punctuation is folded away, so
 * "C++" never becomes "c". Matched against the whole lowercased label.
 */
const SYMBOL_NAMES: Record<string, string> = {
  "c++": "cpp",
  "c#": "csharp",
  "f#": "fsharp",
  ".net": "dotnet",
}

/**
 * How a key is written as a label when nothing better is known: the proper nouns among the keys
 * the synonym table settles on, plus the ones seen on lessons. Anything else gets sentence case
 * (labelForTag). The 0.8 upgrade uses it to turn older lessons' slug tags into labels.
 */
export const TAG_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  go: "Go",
  cpp: "C++",
  csharp: "C#",
  fsharp: "F#",
  dotnet: ".NET",
  nodejs: "Node.js",
  react: "React",
  nextjs: "Next.js",
  vue: "Vue",
  postgresql: "PostgreSQL",
  kubernetes: "Kubernetes",
  regex: "Regex",
  "ci-cd": "CI/CD",
  git: "Git",
  github: "GitHub",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  api: "API",
  apis: "APIs",
  json: "JSON",
  ai: "AI",
  llm: "LLM",
  "claude-code": "Claude Code",
  claude: "Claude",
  chatgpt: "ChatGPT",
  "vs-code": "VS Code",
  excel: "Excel",
  "google-sheets": "Google Sheets",
  notion: "Notion",
  macos: "macOS",
  ios: "iOS",
  android: "Android",
  linux: "Linux",
  windows: "Windows",
  figma: "Figma",
  "a-b-testing": "A/B testing",
  seo: "SEO",
  prd: "PRD",
  "rule-of-72": "Rule of 72",
  "bronze-age": "Bronze Age",
  spanish: "Spanish",
  english: "English",
  french: "French",
  german: "German",
}

/**
 * The key of a label: trimmed, a leading `#` gone, lowercased, symbol names like "C++" mapped
 * (SYMBOL_NAMES), apostrophes dropped ("Ohm's law" → `ohms-law`), and runs of spaces, underscores,
 * punctuation, or symbols folded to one hyphen. Then the synonym table. The same label always
 * gives the same key, whatever its casing or spacing.
 */
export function normalizeTag(label: string): string {
  const lowered = label.trim().replace(/^#+/, "").toLowerCase()
  const named = SYMBOL_NAMES[lowered]
  if (named) return TAG_SYNONYMS[named] ?? named
  const folded = lowered
    .replace(/['’]/g, "")
    .replace(/[\s_\p{P}\p{S}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
  return TAG_SYNONYMS[folded] ?? folded
}

/**
 * A label as the checker keeps it: trimmed, runs of whitespace collapsed to one space, and a
 * leading `#` gone. Casing is the agent's and stays.
 */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/^#+\s*/, "").replace(/\s+/g, " ")
}

/** True when `label` is a label a lesson can keep: the pattern and the length limits. */
export function isTagLabel(label: string): boolean {
  return (
    label.length >= TAG_LIMITS.min &&
    label.length <= TAG_LIMITS.max &&
    TAG_LABEL_PATTERN.test(label)
  )
}

/**
 * A key written as a label: the known spelling (TAG_LABELS), else the words in sentence case
 * ("compound-interest" → "Compound interest"), which is how the guide asks for common nouns.
 */
export function labelForTag(key: string): string {
  const known = TAG_LABELS[key]
  if (known) return known
  const words = key.split("-").join(" ")
  return words.charAt(0).toLocaleUpperCase("en") + words.slice(1)
}

/** What normalizing a lesson's tags changed, as the checker tells the agent (a note, not an error). */
export interface TagChange {
  path: string
  from: string
  to: string
}

/**
 * Normalizes the labels in `tags` on parsed lesson data (normalizeLabel), so the schema sees tidy
 * ones. Returns what changed; unchanged tags, and anything that isn't an array of strings (the
 * schema reports those), pass through as they are.
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
    const to = normalizeLabel(tag)
    if (to !== tag) changes.push({ path: `tags[${i}]`, from: tag, to })
    return to
  })
  return changes.length
    ? { data: { ...data, tags: normalized }, changes }
    : { data, changes }
}
