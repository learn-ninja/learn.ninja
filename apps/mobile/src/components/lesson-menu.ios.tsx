import {
  Button,
  Divider,
  Host,
  Image,
  Menu,
  Picker,
  Section,
  Text,
  Toggle,
} from "@expo/ui/swift-ui"
import {
  accessibilityLabel,
  frame,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers"
import { Alert } from "react-native"

import {
  UI_LANGUAGES,
  UI_TRANSLATIONS,
  type NinjaLevel,
  type Strings,
  type TextSize,
} from "@workspace/player-core/strings"
import { timeLeft } from "@workspace/player-core/time"

import { useDirection } from "@/components/direction"
import { selection, tap } from "@/lib/haptics"
import { ninjaOf, soundOf, type Preferences } from "@/lib/preferences"
import { CONTROL, GlassCircle } from "@/components/shell"
import { colors } from "../../tokens"

// The lesson's menu at the header's end, as the web's PhoneMenu holds it on a phone
// (packages/player/src/shell.tsx), drawn by iOS itself: a SwiftUI Menu (through @expo/ui), the
// pull-down Mail and Notes use. The lesson's title and how long its link has left, Share and
// Restart, then the player's settings (PlayerSettingsItems and the language menu) as submenus
// with a check on the one in use: the ninja's character, the text size, the player's language,
// and Sound as a switch. The settings are kept in the web's
// `learn:preferences`, so a choice means the same on both players. It runs the player's
// direction, as the header around it does.

const NINJA_LEVELS: readonly NinjaLevel[] = [
  "off",
  "sensei",
  "casual",
  "unhinged",
]
const SIZES: readonly TextSize[] = ["sm", "md", "lg"]

export function LessonMenu({
  title,
  expiresAt,
  offline,
  lessonLanguage,
  uiLanguage,
  prefs,
  onPrefs,
  onShare,
  onRestart,
  moderation,
  t,
}: {
  title: string
  /** When a published lesson's link stops working, for the line under the title. */
  expiresAt?: number | null
  /** Opened from the copy kept on the phone, with no connection: said under the title. */
  offline?: boolean
  lessonLanguage: string
  /** The player's language now (the learner's choice, else the lesson's). */
  uiLanguage: string
  prefs: Preferences
  onPrefs: (patch: Partial<Preferences>) => void
  onShare: () => void
  onRestart: () => void
  /** Someone else's published lesson: Report it, or Block its maker (`name`, isolated). */
  moderation?: { name: string; onReport: () => void; onBlock: () => void }
  t: Strings
}) {
  const dir = useDirection()
  const ninja = ninjaOf(prefs)
  const size = prefs.textSize ?? "md"
  const sound = soundOf(prefs)
  const left = expiresAt ? timeLeft(expiresAt - Date.now()) : null
  const pick = (patch: Partial<Preferences>) => {
    selection()
    onPrefs(patch)
  }
  const restart = () =>
    Alert.alert(t.restartTitle, t.restartBody, [
      { text: t.stay, style: "cancel" },
      { text: t.restart, style: "destructive", onPress: onRestart },
    ])
  return (
    // In a glass circle on iOS 26 and later, as the close button at the header's other end.
    <GlassCircle>
      <Host
        matchContents
        colorScheme="dark"
        layoutDirection={dir === "rtl" ? "rightToLeft" : "leftToRight"}
      >
        <Menu
          label={
            // The header control's size (shell.tsx) as the tap target.
            <Image
              systemName="ellipsis"
              size={16}
              color={colors.foreground}
              modifiers={[frame({ width: CONTROL, height: CONTROL })]}
            />
          }
          modifiers={[accessibilityLabel(t.lessonMenu)]}
        >
          <Section title={title}>
            {offline ? <Text>{t.offlineCopy}</Text> : null}
            {left ? <Text>{t.expires[left.unit](left.count)}</Text> : null}
            <Button
              label={t.share}
              systemImage="square.and.arrow.up"
              onPress={() => {
                tap()
                onShare()
              }}
            />
            <Button
              label={t.restart}
              systemImage="arrow.counterclockwise"
              onPress={restart}
            />
          </Section>
          <Divider />
          <Picker
            label={t.ninja}
            systemImage="face.smiling"
            selection={ninja}
            onSelectionChange={(id: NinjaLevel) => pick({ ninja: id })}
            modifiers={[pickerStyle("menu")]}
          >
            {NINJA_LEVELS.map((id) => (
              <Text key={id} modifiers={[tag(id)]}>
                {t.ninjaLevels[id]}
              </Text>
            ))}
          </Picker>
          <Picker
            label={t.textSize}
            systemImage="textformat.size"
            selection={size}
            onSelectionChange={(id: TextSize) => pick({ textSize: id })}
            modifiers={[pickerStyle("menu")]}
          >
            {SIZES.map((id) => (
              <Text key={id} modifiers={[tag(id)]}>
                {id === "md"
                  ? `${t.sizes[id]} ${t.defaultOption}`
                  : t.sizes[id]}
              </Text>
            ))}
          </Picker>
          {UI_TRANSLATIONS ? (
            <Picker
              label={t.language}
              systemImage="globe"
              selection={uiLanguage}
              onSelectionChange={(code: string) => pick({ uiLanguage: code })}
              modifiers={[pickerStyle("menu")]}
            >
              {UI_LANGUAGES.map((l) => (
                <Text key={l.code} modifiers={[tag(l.code)]}>
                  {l.label}
                </Text>
              ))}
            </Picker>
          ) : null}
          {/* The web's Sound item, as the system's switch: on until muted. */}
          <Toggle
            label={t.sound}
            systemImage={sound ? "speaker.wave.2" : "speaker.slash"}
            isOn={sound}
            onIsOnChange={(on) => pick({ sound: on ? "on" : "off" })}
          />
          {moderation ? (
            <>
              <Divider />
              <Button
                label={t.moderation.report}
                systemImage="flag"
                onPress={moderation.onReport}
              />
              <Button
                label={t.moderation.block(moderation.name)}
                systemImage="hand.raised"
                role="destructive"
                onPress={moderation.onBlock}
              />
            </>
          ) : null}
        </Menu>
      </Host>
    </GlassCircle>
  )
}
