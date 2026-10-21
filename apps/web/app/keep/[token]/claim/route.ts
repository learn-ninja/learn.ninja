import { NextResponse } from "next/server"

import { currentActor } from "@/lib/auth/session"
import { revalidateExplore } from "@/lib/explore/cache"
import { claimLesson } from "@/lib/publish/handlers"
import { depsFor } from "@/lib/publish/request"

// GET /keep/{token}/claim: where the keep link goes once the visitor is logged in. Keeps the lesson
// for them and opens it. Anyone logged out, or a token that no longer works, goes back to
// /keep/{token}, which logs them in or says there's nothing left to keep.

type Params = { params: Promise<{ token: string }> }

export async function GET(req: Request, { params }: Params) {
  const { token } = await params
  const back = NextResponse.redirect(new URL(`/keep/${token}`, req.url))
  const actor = await currentActor()
  if (!actor) return back
  const reply = await claimLesson(
    { claimToken: token, ownerId: actor.userId },
    await depsFor(req)
  )
  if (!reply.body.ok) return back
  // A kept lesson is listed straight away.
  revalidateExplore()
  return NextResponse.redirect(reply.body.url as string)
}
