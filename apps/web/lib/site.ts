// Names, links, and copy shared by the home page, the docs, and the agent-facing files.

export const SITE = {
  /** Always lowercase, including at the start of a sentence. */
  name: "learn.ninja",
  url: "https://learn.ninja",
  tagline: "Vibe learn anything with your agent",
  description:
    "Give your AI agent an article, notes, docs, a transcript, or code. It writes one short, interactive lesson and gives you a link to share. Free, no account.",
  repo: "https://github.com/learn-ninja/learn.ninja",
  /** The contact named on the Privacy and Terms pages. */
  maker: "@cmicpace",
  makerUrl: "https://x.com/cmicpace",
  /** The X handles credited in the footer. */
  makers: [
    { handle: "@cmicpace", url: "https://x.com/cmicpace" },
    { handle: "@gkamenz", url: "https://x.com/gkamenz" },
  ],
  /** Placeholder until the learn.ninja account exists. */
  xUrl: "https://x.com",
}

export const INSTALL_COMMAND = "npx skills add https://learn.ninja -g"

/** The MCP server, for chat apps and agents that can't run the skill's commands. */
export const MCP_URL = `${SITE.url}/mcp`
export const MCP_INSTALL_COMMAND = `claude mcp add --transport http learn ${MCP_URL}`

/** What "Copy prompt for agent" copies. */
export const AGENT_PROMPT = `Connect to the learn.ninja MCP server at ${MCP_URL} (or install the skill with \`${INSTALL_COMMAND}\`), then read ${SITE.url}/docs and make me a lesson about `

/** The hero's copy button; the header shows its own once this scrolls under it. */
export const HERO_CTA_ID = "hero-cta"

/** Agents shown on the home page. Logos live in public/agents/ (see its README). */
export const AGENTS = [
  { name: "Claude Code", logo: "claudecode" },
  { name: "Codex", logo: "codex" },
  { name: "Cursor", logo: "cursor" },
  { name: "Gemini CLI", logo: "geminicli" },
  { name: "GitHub Copilot", logo: "copilot" },
  { name: "Windsurf", logo: "windsurf" },
  { name: "Cline", logo: "cline" },
  { name: "Roo Code", logo: "roocode" },
  { name: "Kiro", logo: "kiro" },
  { name: "Goose", logo: "goose" },
  { name: "Amp", logo: "amp" },
  { name: "OpenCode", logo: "opencode" },
  { name: "Antigravity", logo: "antigravity" },
  { name: "Junie", logo: "junie" },
] as const

/** Where the docs pages live in the repo, for "Edit on GitHub". */
export const DOCS_EDIT_BASE = `${SITE.repo}/edit/main/docs/`
