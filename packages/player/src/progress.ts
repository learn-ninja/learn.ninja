import type { Lesson } from "@workspace/spec"
import {
  fingerprint,
  PROGRESS_PREFIX,
  PROGRESS_VERSION,
} from "@workspace/player-core/progress"
import { UI_TRANSLATIONS } from "@workspace/player-core/strings"

// The web side of saved progress: the browser's localStorage, and the inline script that hides a
// server-rendered page about to change. The rest (what's kept, how it's restored) is shared with
// the app in @workspace/player-core/progress.

export * from "@workspace/player-core/progress"

/** The browser's localStorage, or null where it's blocked: reading the global throws then. */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * An inline script for the server-rendered page, placed first inside the player's root: before
 * anything paints, it marks the root `data-resuming` when what the server drew is about to change,
 * so it stays hidden (`data-resuming:invisible`) until the player has made the change and clears
 * the mark. That's when the browser holds progress for this lesson (with `key`), or the learner's
 * saved preferences differ from the server's defaults: another language (or ?ui= asks for one),
 * another text size, the tray closed, or another ninja (Sensei, once called Caffeinated, is the
 * server's; another would start Sensei's entrance and then cut to his own). A fresh visit with no preferences, or blocked storage,
 * leaves the root alone.
 */
export function resumeScript(key: string | null, lesson: Lesson): string {
  const progress = key
    ? `var s=JSON.parse(localStorage.getItem(${JSON.stringify(PROGRESS_PREFIX + key)}));` +
      `if(s&&(s.v===1||s.v===${PROGRESS_VERSION})&&s.fingerprint===${JSON.stringify(fingerprint(lesson))})h=1;`
    : ""
  const script =
    "(function(){var r=document.currentScript.parentNode,h=0;" +
    `try{${progress}}catch(e){}` +
    // The preferences shell.tsx keeps (PREFERENCES_KEY); the server draws English-or-the-lesson's
    // language, medium text, the tray open, and the Sensei.
    'try{var p=JSON.parse(localStorage.getItem("learn:preferences")||"{}"),' +
    `u=new URLSearchParams(location.search).get("ui")${UI_TRANSLATIONS ? "||p.uiLanguage" : ""};` +
    'if((u&&String(u).toLowerCase()!==(r.getAttribute("lang")||"").toLowerCase())||' +
    '(p.textSize&&p.textSize!=="md")||p.tray==="closed"||' +
    '(p.ninja&&p.ninja!=="sensei"&&p.ninja!=="caffeinated"))h=1}catch(e){}' +
    'if(h)r.setAttribute("data-resuming","")})()'
  return script.replace(/</g, "\\u003c")
}
