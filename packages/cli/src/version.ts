// Its own file, so apps/web can import the version without loading the CLI (index.ts runs it).

/**
 * The skill's version, which apps/web serves as the latest. Bump it when the CLI or the installed
 * SKILL.md changes; older installs are then told to update.
 */
export const SKILL_VERSION = "0.19.0"
