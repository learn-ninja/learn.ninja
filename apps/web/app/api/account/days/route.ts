import { accountDays } from "@/lib/explore/app-api"
import { actorFor } from "@/lib/publish/request"
import { respond, SIGN_IN_REQUIRED } from "@/lib/publish/respond"
import { getDb } from "@/lib/publish/store"

// GET /api/account/days: the days the logged-in learner finished a lesson, for the iOS app's
// streak (lib/explore/app-api.ts).

export async function GET(req: Request) {
  return respond(async () => {
    const actor = await actorFor(req)
    if (!actor) return SIGN_IN_REQUIRED
    return accountDays({ actor }, { db: await getDb() })
  })
}
