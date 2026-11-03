import { SKILL_VERSION } from "@workspace/cli/version"

// The skill's version lives in the CLI (packages/cli/src/version.ts), so the latest version served
// here is always the one this repo builds. Guides and checker rules reach every install through
// `learn sync` and /api/validate, so it only changes when the CLI itself does.

export { SKILL_VERSION }

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
    Boolean(version) && compareVersions(version!, SKILL_VERSION) < 0
  return {
    latest: SKILL_VERSION,
    updateAvailable,
    ...(updateAvailable ? { updateCommand: SKILL_UPDATE_COMMAND } : {}),
  }
}
