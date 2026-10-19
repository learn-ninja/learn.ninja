import type { InferPageType } from "fumadocs-core/source"

import { FAQ } from "@/lib/faq"
import { getLesson } from "@/lib/lessons"
import { AGENTS, INSTALL_COMMAND, SITE } from "@/lib/site"
import { docsPages } from "@/lib/docs-nav"
import { source } from "@/lib/source"

// Plain-text versions of the site for agents: /docs/{page}.md, /llms.txt, /llms-full.txt, /index.md.

type Page = InferPageType<typeof source>

/** A docs page as Markdown, with live brick demos swapped for their JSON and a link to the lesson. */
export async function pageMarkdown(page: Page): Promise<string> {
  const body = (await page.data.getText("processed"))
    .replace(
      /<BrickPreview\s+lesson="([^"]+)"\s+brick="([^"]+)"[^>]*\/>/g,
      (_, slug: string, id: string) => brickMarkdown(slug, id)
    )
    // The copy button is only for the browser; the prompt itself follows it in a code block.
    .replace(/^<CopyPrompt\s*\/>$/gm, "")
    // Heading ids ("## Lesson [#lesson]") and site-relative links read better without and with the domain.
    .replace(/^(#{1,6} .*?) \[#[^\]]+\]$/gm, "$1")
    .replace(/\]\(\//g, `](${SITE.url}/`)
  const lines = [`# ${page.data.title}`, ""]
  if (page.data.description) lines.push(`> ${page.data.description}`, "")
  lines.push(body.trim().replace(/\n{3,}/g, "\n\n"), "")
  return lines.join("\n")
}

function brickMarkdown(slug: string, id: string): string {
  const lesson = getLesson(slug)
  const brick = lesson
    ? [lesson.hook, ...lesson.bricks, lesson.challenge].find((b) => b.id === id)
    : undefined
  if (!brick) return ""
  return ["```json", JSON.stringify(brick, null, 2), "```"].join("\n")
}

export function docsIndex(): string {
  return docsPages()
    .map(
      (p) =>
        `- [${p.data.title}](${SITE.url}${p.url}.md): ${p.data.description ?? ""}`
    )
    .join("\n")
}

/** /llms.txt: what learn.ninja is, when to use it, and where everything is. */
export function llmsTxt(): string {
  return `# ${SITE.name}

> ${SITE.description}

${SITE.name} is a skill for AI agents. The agent turns what the user gives it (a topic, an article, notes, docs, a transcript, or code) into one short, interactive lesson in a JSON format, checks it, and publishes it to a link like ${SITE.url}/l/how-compound-interest-works-k3x9a2mq. Learners play it in the browser: short screens called bricks, with feedback on every answer.

## When to use it

- The user asks to make, generate, or publish a lesson, quiz, tutorial, or interactive explainer.
- The user wants to learn, or teach someone, a concept from something they're reading.

## Install

\`\`\`bash
${INSTALL_COMMAND}
\`\`\`

Then read the skill's SKILL.md and follow it: write the lesson, run \`validate\` until it passes, then \`publish\`, and give the user the link. Lessons are free and need no account. They last 7 days, or forever once the user keeps them in an account (\`learn login\`, which the steps describe; offer it once, in one sentence). Kept lessons are link-only until their owner lists them in Explore (${SITE.url}/explore) from their settings.

## Docs

${docsIndex()}

## Optional

- [Full docs in one file](${SITE.url}/llms-full.txt)
- [Home page as Markdown](${SITE.url}/index.md)
- [Lesson JSON Schema](${SITE.url}/schema/lesson.schema.json)
- [Skill index](${SITE.url}/.well-known/skills/index.json)
`
}

export async function llmsFullTxt(): Promise<string> {
  const pages = await Promise.all(docsPages().map(pageMarkdown))
  return `# ${SITE.name} docs\n\n> ${SITE.description}\n\n${pages.join("\n---\n\n")}`
}

/** /index.md: the home page as Markdown. */
export function homeMarkdown(): string {
  return `# ${SITE.name}

${SITE.tagline}.

${SITE.description}

## Get started

Install the skill in your agent:

\`\`\`bash
${INSTALL_COMMAND}
\`\`\`

Then ask it for a lesson: "Make me a lesson from this article", "Teach me how map differs from forEach". It replies with a link to share.

Works with any agent that supports skills: ${AGENTS.map((a) => a.name).join(", ")}.

## What's in a lesson

One idea in 3 to 15 minutes: a guess before any teaching, one to four short concepts each followed by practice, a final challenge, and takeaways. The agent picks a level and a size from what you ask, and splits a big topic into a path of lessons. Practice uses nine kinds of bricks: concept, choice, compare, hotspot, sort, order, match, blank, and scenario. Every wrong option explains the mistake behind it.

## Questions

${FAQ.map(({ q, a }) => `### ${q}\n\n${a}`).join("\n\n")}

## More

- [Explore](${SITE.url}/explore): lessons people chose to share
- [Docs](${SITE.url}/docs)
- [llms.txt](${SITE.url}/llms.txt)
`
}
