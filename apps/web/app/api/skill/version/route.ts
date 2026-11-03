import { skillBundle } from "@/lib/skill-files"
import {
  SKILL_VERSION,
  MIN_SKILL_VERSION,
  SKILL_UPDATE_COMMAND,
} from "@/lib/skill-version"

// GET /api/skill/version: the bundle's hash and versions without the files, so the CLI can check
// for changes cheaply on every command and fetch /api/skill only when the hash moved.

export const dynamic = "force-static"

export function GET() {
  return Response.json({
    ok: true,
    version: SKILL_VERSION,
    minVersion: MIN_SKILL_VERSION,
    updateCommand: SKILL_UPDATE_COMMAND,
    hash: skillBundle().hash,
  })
}
