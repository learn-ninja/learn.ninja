import { skillBundle } from "@/lib/skill-files"
import {
  SKILL_VERSION,
  MIN_SKILL_VERSION,
  SKILL_UPDATE_COMMAND,
} from "@/lib/skill-version"

// GET /api/skill: the skill's guides as one JSON bundle, for `learn sync`. Built at build time from
// skills/learn/, like /.well-known/skills/, so a deploy is all it takes to update every install.

export const dynamic = "force-static"

export function GET() {
  const { hash, files } = skillBundle()
  return Response.json({
    ok: true,
    version: SKILL_VERSION,
    minVersion: MIN_SKILL_VERSION,
    updateCommand: SKILL_UPDATE_COMMAND,
    hash,
    files,
  })
}
