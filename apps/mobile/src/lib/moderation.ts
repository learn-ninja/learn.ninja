import { router } from "expo-router"
import { useEffect, useState } from "react"
import { Alert, Linking, Platform } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { apiFetch } from "./api"
import { API_BASE_URL } from "./config"
import { result, tap } from "./haptics"

// Reporting a lesson and blocking its maker (App Store guideline 1.2), through the web's own
// endpoints: POST /api/lessons/{id}/report with the reason (the web's report dialog), and
// /api/blocks (apps/web/lib/explore/blocks.ts). A report needs no account; a block does, so
// signed out it opens the log-in. The text prompt and confirmations are the system's alerts.

/** Someone a block names: their user id, and the handle the alerts say. */
export interface Person {
  id: string
  handle: string | null
  name?: string
}

/** Someone the learner blocked, as Settings lists them (BlockedPerson on the web). */
export interface BlockedPerson {
  id: string
  handle: string | null
  name: string
  image: string | null
  blockedAt: number
}

/** How long a report's reason can be (REASON_MAX on the web). */
export const REASON_MAX = 1000

type Listener = (change: { userId: string; blocked: boolean }) => void
const listeners = new Set<Listener>()

/** Called after each block or unblock, so Explore and the profiles drop or bring back the person's lessons. */
export function onBlockChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function send(path: string, init: RequestInit): Promise<string | null> {
  try {
    const res = await apiFetch(path, {
      ...init,
      headers: { "content-type": "application/json" },
    })
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean
      message?: string
    } | null
    return res.ok && body?.ok ? null : (body?.message ?? `HTTP ${res.status}`)
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

/** Sends a report; the server's reason when it's refused, else null. */
export function sendReport(lessonId: string, reason: string) {
  return send(`/api/lessons/${encodeURIComponent(lessonId)}/report`, {
    method: "POST",
    body: JSON.stringify({ reason: reason.slice(0, REASON_MAX) }),
  })
}

/** Blocks or unblocks someone; the server's reason when it's refused, else null. */
export async function setBlocked(userId: string, blocked: boolean) {
  const problem = blocked
    ? await send("/api/blocks", {
        method: "POST",
        body: JSON.stringify({ userId }),
      })
    : await send(`/api/blocks/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      })
  if (!problem) for (const l of listeners) l({ userId, blocked })
  return problem
}

/** Everyone the learner blocked, most recently first. */
export async function fetchBlocked(): Promise<BlockedPerson[]> {
  const res = await apiFetch("/api/blocks")
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean
    blocked?: BlockedPerson[]
  } | null
  if (!res.ok || !body?.ok || !Array.isArray(body.blocked))
    throw new Error(`The server answered ${res.status}.`)
  return body.blocked
}

/**
 * The people the learner blocked, for Settings: null while they load (or if they didn't), and
 * fresh after each block or unblock.
 */
export function useBlocked(): BlockedPerson[] | null {
  const [people, setPeople] = useState<BlockedPerson[] | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      fetchBlocked()
        .then((p) => live && setPeople(p))
        .catch(() => {})
    void load()
    const off = onBlockChange(() => void load())
    return () => {
      live = false
      off()
    }
  }, [])
  return people
}

/** A handle as the alerts say it: isolated, so it reads left to right in a right-to-left sentence. */
export const nameOf = (person: Person) =>
  `⁨${person.handle ?? person.name ?? ""}⁩`

/**
 * Report a lesson: the system's text prompt with what's wrong, then a thank-you, or the reason it
 * didn't go. iOS only has the prompt; elsewhere the lesson opens on the web, whose menu reports it.
 */
export function askReport(
  lesson: { id: string; path: string },
  t: Strings,
  reason = ""
) {
  if (Platform.OS !== "ios") {
    void Linking.openURL(API_BASE_URL + lesson.path)
    return
  }
  Alert.prompt(
    t.moderation.reportTitle,
    t.moderation.reportBody,
    [
      { text: t.cancel, style: "cancel" },
      {
        text: t.moderation.sendReport,
        isPreferred: true,
        onPress: (value?: string) => {
          const text = (value ?? "").trim()
          if (!text) {
            Alert.alert(t.moderation.reportTitle, t.moderation.reportEmpty, [
              {
                text: t.moderation.done,
                onPress: () => askReport(lesson, t),
              },
            ])
            return
          }
          void sendReport(lesson.id, text).then((problem) => {
            result(!problem)
            if (problem)
              // Back to the prompt with what they wrote, so it isn't lost.
              Alert.alert(t.moderation.failed, problem, [
                { text: t.cancel, style: "cancel" },
                {
                  text: t.tryAgain,
                  onPress: () => askReport(lesson, t, text),
                },
              ])
            else
              Alert.alert(
                t.moderation.reportSentTitle,
                t.moderation.reportSentBody,
                [{ text: t.moderation.done }]
              )
          })
        },
      },
    ],
    "plain-text",
    reason
  )
}

/**
 * Block someone, after the system's confirmation that says what it does; signed out, the log-in
 * first. `onBlocked` runs once the server has it (a lesson screen closes, say).
 */
export function confirmBlock(
  person: Person,
  signedIn: boolean,
  t: Strings,
  onBlocked?: () => void
) {
  if (!signedIn) {
    router.push("/sign-in")
    return
  }
  const name = nameOf(person)
  Alert.alert(t.moderation.blockTitle(name), t.moderation.blockBody, [
    { text: t.cancel, style: "cancel" },
    {
      text: t.moderation.blockConfirm,
      style: "destructive",
      onPress: async () => {
        tap()
        const problem = await setBlocked(person.id, true)
        result(!problem)
        if (problem) Alert.alert(t.moderation.failed, problem)
        else onBlocked?.()
      },
    },
  ])
}

/** Unblock someone, after the system's confirmation. */
export function confirmUnblock(
  person: Person,
  t: Strings,
  onUnblocked?: () => void
) {
  Alert.alert(
    t.moderation.unblockTitle(nameOf(person)),
    t.moderation.unblockBody,
    [
      { text: t.cancel, style: "cancel" },
      {
        text: t.moderation.unblock,
        isPreferred: true,
        onPress: async () => {
          tap()
          const problem = await setBlocked(person.id, false)
          result(!problem)
          if (problem) Alert.alert(t.moderation.failed, problem)
          else onUnblocked?.()
        },
      },
    ]
  )
}
