import Svg, { Path } from "react-native-svg"

import type { Strings } from "@workspace/player-core/strings"

import { Button } from "@/components/ui/button"
import { tap } from "@/lib/haptics"
import { soundOf } from "@/lib/preferences"
import { usePreferences } from "@/lib/use-preferences"
import { colors } from "../../tokens"

// The Sound setting, at the end of the lesson's header until the app has its own menu (phase 4):
// the web's Sound item (Volume2 or VolumeX), which mutes the ninja's voice and the effects. Like
// the web's, it shows only in a language he speaks; the caller checks that.

export function SoundToggle({ t }: { t: Strings }) {
  const [prefs, update] = usePreferences()
  const on = soundOf(prefs)
  return (
    <Button
      variant="ghost"
      size="icon"
      // The web's icon-sm (32px) with the phone's larger tap area around it.
      className="h-8 w-8"
      hitSlop={6}
      accessibilityLabel={t.sound}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={() => {
        tap()
        update({ sound: on ? "off" : "on" })
      }}
    >
      <Svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.foreground}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Lucide's Volume2 and VolumeX: the speaker, then waves or a cross. */}
        <Path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
        {on ? (
          <>
            <Path d="M16 9a5 5 0 0 1 0 6" />
            <Path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
          </>
        ) : (
          <>
            <Path d="m16.5 14.5 5-5" />
            <Path d="m16.5 9.5 5 5" />
          </>
        )}
      </Svg>
    </Button>
  )
}
