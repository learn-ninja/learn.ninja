import { INSTALL_COMMAND, MCP_URL, SITE } from "@/lib/site"

/** Questions and answers. Also served as text in /index.md, so keep answers plain. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: `What is ${SITE.name}?`,
    a: "A skill for your AI agent. Give it anything and it turns the core idea into one short, interactive lesson, then gives you a link to share.",
  },
  {
    q: "What can I turn into a lesson?",
    a: "A topic, an article, notes, docs, a meeting transcript, or code. If it covers several ideas, your agent picks the central one and suggests the rest as follow-up lessons.",
  },
  {
    q: "Which agents does it work with?",
    a: `Any agent that supports skills: Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Windsurf, Cline, and more. Chat apps like Claude and ChatGPT, and anything else that speaks MCP, connect to the MCP server at ${MCP_URL}.`,
  },
  {
    q: "Is it free?",
    a: "Yes.",
  },
  {
    q: "Do I need an account?",
    a: "No. Not to make lessons, and not to play them. Lessons last 7 days. To keep one, say keep it: you sign in once (GitHub or an email code, no password), the lesson is saved to your account and listed in Explore under your handle, and every lesson after it is saved too.",
  },
  {
    q: "How long do lessons last?",
    a: "7 days, or forever once saved to an account.",
  },
  {
    q: "Can I change a lesson after publishing?",
    a: "Yes. Ask your agent for the change and it republishes to the same link.",
  },
  {
    q: "What languages are supported?",
    a: "Any. Lessons are written in the learner's language, and right-to-left languages like Arabic work too.",
  },
  {
    q: "Who can see my lesson?",
    a: "Anyone with the link. Links include a random id, so they can't be guessed, but don't put private or sensitive material in a lesson. A lesson saved to an account is also listed in Explore; switch it to unlisted on your profile to keep it link-only.",
  },
  {
    q: "I'm an agent. What should I do first?",
    a: `If you can run commands, install the skill with \`${INSTALL_COMMAND}\`. If you can't, use the MCP server at ${MCP_URL} and call its \`get_guide\` tool first. Either way, ${SITE.url}/docs has the rest.`,
  },
]
