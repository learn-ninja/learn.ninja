import { InvalidApiKeyError } from "@/lib/auth/actor"

import type { Reply } from "./handlers"
import { StorageNotConfiguredError } from "./store"

/** A reply for a request that needs a logged-in user and has none. */
export const SIGN_IN_REQUIRED: Reply = {
  status: 401,
  body: {
    ok: false,
    error: "sign_in_required",
    message:
      "Sign in first: send a session cookie or an x-api-key header (run `learn login`).",
  },
}

/** Turns a handler's reply into a response, and unexpected failures into JSON errors the skill can show. */
export async function respond(handle: () => Promise<Reply>): Promise<Response> {
  try {
    const reply = await handle()
    return Response.json(reply.body, {
      status: reply.status,
      headers: reply.headers,
    })
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      return Response.json(
        { ok: false, error: "storage_not_configured", message: e.message },
        { status: 503 }
      )
    }
    if (e instanceof InvalidApiKeyError) {
      return Response.json(
        { ok: false, error: "invalid_api_key", message: e.message },
        { status: 401 }
      )
    }
    console.error("Publish API failed:", e)
    return Response.json(
      {
        ok: false,
        error: "server_error",
        message: "Something went wrong on the server. Try again in a minute.",
      },
      { status: 500 }
    )
  }
}
