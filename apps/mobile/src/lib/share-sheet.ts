import { Platform, Share } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { API_BASE_URL } from "./config"
import { lessonLink, shareLink } from "./share"

// The system share sheet, for the lesson menu's Share and the wrap-up's Challenge friend. iOS takes
// the link as its own item, so it previews as a link.

async function share(title: string, url: string, message?: string) {
  try {
    await Share.share(
      Platform.OS === "ios"
        ? { title, url, ...(message ? { message } : {}) }
        : { title, message: message ? `${message}\n${url}` : url }
    )
  } catch {
    // Dismissed, or the device can't share.
  }
}

/** The lesson's web page, as the web's Share sends it. */
export const shareLesson = (title: string, path: string) =>
  share(title, lessonLink(API_BASE_URL, path))

/** The challenge, as the web's Challenge friend does on a phone. */
export async function shareChallenge({
  title,
  path,
  first,
  total,
  by,
  t,
}: {
  title: string
  path: string
  first: number
  total: number
  by?: string | null
  t: Strings
}) {
  await share(
    title,
    shareLink(API_BASE_URL, path, first, total, by),
    t.challengeMessage(first, total)
  )
}
