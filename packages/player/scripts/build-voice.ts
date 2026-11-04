// Speaks the ninja's English lines (player-core/src/locales/voices/en.ts and src/footer-lines.ts) with his
// ElevenLabs voice: one mp3 per line in apps/web/public/voice/en/, named by a hash of the voice,
// model, and text, and the tables they're looked up in (player-core/src/voice-clips.json for the player,
// src/footer-clips.json for the site's footer). Only new or changed lines cost credits; clips for
// lines that are gone are deleted. Run it after changing the English lines:
// `npm run voice -w @workspace/player`. It reads ELEVENLABS_API_KEY from apps/web/.env.local.

import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { FOOTER_LINES } from "../src/footer-lines"
import { en } from "@workspace/player-core/locales/voices/en"
import type { VoiceClips } from "@workspace/player-core/voices"

/** "learn.ninja ninja" in the maintainers' ElevenLabs account: deep and husky, with a Japanese accent. */
const VOICE = "WWVG27H1yLMxNlCOoavQ"
const MODEL = "eleven_v3"
/** Mono speech: 96 kbps keeps the rasp without making the clips heavy. */
const FORMAT = "mp3_44100_96"
/** The Starter plan's limit on requests at once. */
const AT_ONCE = 3

const here = fileURLToPath(new URL(".", import.meta.url))
const manifestPath = join(here, "../../player-core/src/voice-clips.json")
const footerManifestPath = join(here, "../src/footer-clips.json")
const dir = join(here, "../../../apps/web/public/voice/en")

try {
  process.loadEnvFile(join(here, "../../../apps/web/.env.local"))
} catch {
  // No env file: the key may be in the environment, or every clip already exists.
}

const lessonLines = [
  ...new Set(
    Object.values(en).flatMap((voice) =>
      Object.values(voice).flatMap(({ plain, flavor }) => [...plain, ...flavor])
    )
  ),
]
const lines = [...new Set([...lessonLines, ...FOOTER_LINES])]
const clip = (text: string) =>
  createHash("sha256")
    .update(`${VOICE}\n${MODEL}\n${text}`)
    .digest("hex")
    .slice(0, 12)
const clips = Object.fromEntries(lines.map((text) => [text, clip(text)]))

mkdirSync(dir, { recursive: true })
const missing = lines.filter(
  (text) => !existsSync(join(dir, `${clips[text]}.mp3`))
)
if (missing.length && !process.env.ELEVENLABS_API_KEY)
  throw new Error("ELEVENLABS_API_KEY is not set (apps/web/.env.local)")

const queue = [...missing]
await Promise.all(
  Array.from({ length: AT_ONCE }, async () => {
    for (let text = queue.shift(); text; text = queue.shift()) {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=${FORMAT}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY!,
            "content-type": "application/json",
          },
          body: JSON.stringify({ text, model_id: MODEL, language_code: "en" }),
        }
      )
      if (!res.ok)
        throw new Error(`"${text}": ${res.status} ${await res.text()}`)
      writeFileSync(
        join(dir, `${clips[text]}.mp3`),
        Buffer.from(await res.arrayBuffer())
      )
      console.log(`${clips[text]}  ${text}`)
    }
  })
)

const kept = new Set(Object.values(clips).map((id) => `${id}.mp3`))
const stale = readdirSync(dir).filter((file) => !kept.has(file))
for (const file of stale) rmSync(join(dir, file))

const manifest: VoiceClips = {
  voice: VOICE,
  model: MODEL,
  clips: {
    en: Object.fromEntries(lessonLines.map((text) => [text, clips[text]!])),
  },
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(
  footerManifestPath,
  `${JSON.stringify(
    Object.fromEntries(FOOTER_LINES.map((text) => [text, clips[text]])),
    null,
    2
  )}\n`
)
console.log(
  `${lines.length} lines: ${missing.length} spoken, ${stale.length} stale clips removed`
)
