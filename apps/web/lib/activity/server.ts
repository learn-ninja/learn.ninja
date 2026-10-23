import { cookies } from "next/headers"

import { TZ_COOKIE } from "@/components/site/timezone-cookie"

import { isTimeZone } from "./activity"

/** The viewer's time zone from the tz cookie (components/site/timezone-cookie.tsx), or UTC. */
export async function viewerTimeZone(): Promise<string> {
  const raw = (await cookies()).get(TZ_COOKIE)?.value
  let tz: string | undefined
  try {
    tz = raw && decodeURIComponent(raw)
  } catch {
    tz = undefined
  }
  return isTimeZone(tz) ? tz : "UTC"
}
