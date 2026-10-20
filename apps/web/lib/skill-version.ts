// The skill's version lives in the installed CLI (packages/cli/src/cli.ts, SKILL_VERSION). Guides and
// checker rules reach every install through `learn sync` and /api/validate, so these only change when
// the CLI itself does.

/** The current CLI version. Bump it with SKILL_VERSION when the CLI or the installed SKILL.md changes. */
export const LATEST_SKILL_VERSION = "0.12.0"

/** The oldest CLI the served guides still work with. Raise it when a guide relies on new CLI behavior; `sync` stops below it. */
export const MIN_SKILL_VERSION = "0.9.0"

export const SKILL_UPDATE_COMMAND = "npx skills add https://learn.ninja -g"

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** What the API tells a CLI about its version: whether a newer skill exists, and how to get it. */
export function skillInfo(version?: string | null) {
  const updateAvailable =
    Boolean(version) && compareVersions(version!, LATEST_SKILL_VERSION) < 0
  return {
    latest: LATEST_SKILL_VERSION,
    updateAvailable,
    ...(updateAvailable ? { updateCommand: SKILL_UPDATE_COMMAND } : {}),
  }
}
