import { colors } from "../../tokens"

// The launch screen and its handoff, shared by app.config.ts (the native launch screen) and
// src/components/splash.tsx (the same mark drawn in the app, which then vanishes in smoke).

/** The mark's width on the launch screen, in points. */
export const SPLASH_SIZE = 120

/** The launch screen's background: the app's own. */
export const SPLASH_BACKGROUND = colors.background

/**
 * The longest the launch screen waits for the session before the app shows anyway (ms), so a slow
 * or missing network never keeps anyone on it.
 */
export const SPLASH_MAX_WAIT = 1500

/** The handoff's beats, in ms: the smoke gathering behind the mark, then the burst. */
export const SPLASH_GATHER = 220
export const SPLASH_BURST = 650
