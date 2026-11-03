# Security

## Reporting a vulnerability

Please don't open a public issue. Report it privately through GitHub instead: on this repository's **Security** tab, choose **Report a vulnerability** ([direct link](https://github.com/learn-ninja/learn.ninja/security/advisories/new)). Only the maintainers can see the report.

Tell us what you found, how to reproduce it, and what someone could do with it. We reply within a week, keep you posted while we fix it, and credit you in the advisory if you'd like.

## What we care about most

- **Lesson content running code.** Lesson visuals are LLM-written HTML shown in a sandboxed iframe with no scripts (`packages/player/src/visuals.tsx`), under a Content-Security-Policy that only allows same-origin resources (`apps/web/next.config.ts`). Any way for a published lesson to run script, load something off-site, or reach the page around it is a vulnerability.
- **Accounts and tokens**: sign-in, the OAuth server that chat apps connect through, API keys, and the edit tokens that let someone change a published lesson.
- **The publish API and the MCP server** (`/api/lessons`, `/mcp`).

## Supported versions

We fix the hosted site at https://learn.ninja and the `main` branch. The skill's guides and the lesson checker come from the site, so most fixes reach every install on deploy; a fix to the `learn` command itself tells older installs to update.
