import { Platform, Share } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { API_BASE_URL } from "./config"
import { shareLink } from "./share"

/**
 * Opens the system share sheet with the challenge for a lesson, as the web's Challenge friend does
 * on a phone: the message daring a friend to beat the learner's first tries, and the lesson's web
 * page carrying them. iOS takes the link as its own item, so it previews as a link.
 */
export async function shareChallenge({
  title,
  path,
  first,
  total,
  t,
}: {
  title: string
  path: string
  first: number
  total: number
  t: Strings
}) {
  const url = shareLink(API_BASE_URL, path, first, total)
  const message = t.challengeMessage(first, total)
  try {
    await Share.share(
      Platform.OS === "ios"
        ? { title, message, url }
        : { title, message: `${message}\n${url}` }
    )
  } catch {
    // Dismissed, or the device can't share.
  }
}
