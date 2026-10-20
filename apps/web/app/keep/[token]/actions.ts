"use server"

import { headers } from "next/headers"

import { currentActor } from "@/lib/auth/session"
import { claimLesson } from "@/lib/publish/handlers"
import { getLessonStore } from "@/lib/publish/store"

export interface KeepResult {
  ok: boolean
  message: string
  url?: string
  title?: string
  /** The owner's handle, or null when they haven't picked one yet. */
  handle?: string | null
  /** Whether the kept lesson is listed in Explore. */
  listed?: boolean
}

/** The Keep button on /keep/{token}: claims the lesson for the signed-in user. */
export async function keepLesson(
  _previous: KeepResult | null,
  formData: FormData
): Promise<KeepResult> {
  const token = formData.get("token")
  const actor = await currentActor()
  if (!actor) return { ok: false, message: "Sign in first." }
  if (typeof token !== "string" || !token)
    return { ok: false, message: "This keep link is incomplete." }
  const h = await headers()
  const origin =
    process.env.LEARN_PUBLIC_URL ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`
  const reply = await claimLesson(
    { claimToken: token, ownerId: actor.userId },
    // The keeper is the signed-in user, so their handle needs no lookup.
    { store: await getLessonStore(), origin, handleOf: async () => actor.handle }
  )
  if (!reply.body.ok)
    return { ok: false, message: reply.body.message as string }
  return {
    ok: true,
    message: "Kept.",
    url: reply.body.url as string,
    title: reply.body.title as string,
    handle: actor.handle,
    listed: reply.body.visibility === "public",
  }
}
