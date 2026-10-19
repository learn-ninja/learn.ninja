import type { Visibility } from "./queries"

// What the like button, the report dialog, and the settings page call from the browser. The
// components take it as a prop so Storybook can hand them a fake.

export interface Outcome {
  error?: string
}

/** How long a report's reason can be. */
export const REASON_MAX = 1000

export interface ExploreApi {
  like(id: string): Promise<Outcome & { likes?: number }>
  unlike(id: string): Promise<Outcome & { likes?: number }>
  report(id: string, reason: string): Promise<Outcome>
  setVisibility(
    id: string,
    visibility: Visibility
  ): Promise<Outcome & { visibility?: Visibility }>
}

async function call<T extends object>(
  path: string,
  init?: RequestInit
): Promise<(T & { ok: true }) | { ok: false; error: string; message: string }> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  })
  return (await res.json().catch(() => ({
    ok: false,
    error: "server_error",
    message: `The server replied HTTP ${res.status}.`,
  }))) as (T & { ok: true }) | { ok: false; error: string; message: string }
}

export const exploreApi: ExploreApi = {
  async like(id) {
    const reply = await call<{ likes: number }>(`/api/lessons/${id}/like`, {
      method: "POST",
    })
    return reply.ok ? { likes: reply.likes } : { error: reply.message }
  },
  async unlike(id) {
    const reply = await call<{ likes: number }>(`/api/lessons/${id}/like`, {
      method: "DELETE",
    })
    return reply.ok ? { likes: reply.likes } : { error: reply.message }
  },
  async report(id, reason) {
    const reply = await call(`/api/lessons/${id}/report`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })
    return reply.ok ? {} : { error: reply.message }
  },
  async setVisibility(id, visibility) {
    const reply = await call<{ visibility: Visibility }>(`/api/lessons/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ visibility }),
    })
    return reply.ok ? { visibility: reply.visibility } : { error: reply.message }
  },
}

/** "1.2K" for counts on cards. */
export function compact(n: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)
}
