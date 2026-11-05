import { useState, type ReactNode } from "react"
import { Alert, Modal, Pressable, ScrollView, View } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import {
  UI_LANGUAGES,
  UI_TRANSLATIONS,
  uiLanguageFor,
  type NinjaLevel,
  type Strings,
  type TextSize,
} from "@workspace/player-core/strings"
import { timeLeft } from "@workspace/player-core/time"
import { hasVoice } from "@workspace/player-core/voices"

import { DirectionView, useDirection } from "@/components/direction"
import {
  BackIcon,
  CheckIcon,
  EllipsisIcon,
  GlobeIcon,
  RestartIcon,
  ShareIcon,
  TypeIcon,
} from "@/components/icons"
import { Ninja } from "@/components/ninja"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { tap } from "@/lib/haptics"
import { ninjaOf, soundOf, type Preferences } from "@/lib/preferences"
import { cn } from "@/lib/utils"
import { colors } from "../../tokens"

// The lesson's menu, as the web's PhoneMenu holds it on a phone (packages/player/src/shell.tsx):
// the lesson's title and how long its link has left, Share and Restart, then the player's settings
// (PlayerSettingsItems and the language menu): the ninja's character, the text size, the player's
// language, and Sound in a language he speaks. The settings are kept in the web's
// `learn:preferences`, so a choice means the same on both players. On a phone it's a sheet from
// the bottom, with each setting's choices on a page of their own.

const NINJA_LEVELS: readonly NinjaLevel[] = [
  "off",
  "sensei",
  "casual",
  "unhinged",
]
const SIZES: readonly TextSize[] = ["sm", "md", "lg"]

type Page = "main" | "ninja" | "size" | "language"

export function LessonMenu({
  title,
  expiresAt,
  lessonLanguage,
  uiLanguage,
  prefs,
  onPrefs,
  onShare,
  onRestart,
  t,
}: {
  title: string
  /** When a published lesson's link stops working, for the line under the title. */
  expiresAt?: number | null
  lessonLanguage: string
  /** The player's language now (the learner's choice, else the lesson's). */
  uiLanguage: string
  prefs: Preferences
  onPrefs: (patch: Partial<Preferences>) => void
  onShare: () => void
  onRestart: () => void
  t: Strings
}) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<Page>("main")
  const insets = useSafeAreaInsets()
  const dir = useDirection()
  const close = () => {
    setOpen(false)
    setPage("main")
  }
  const ninja = ninjaOf(prefs)
  const size = prefs.textSize ?? "md"
  const sound = soundOf(prefs)
  const language = uiLanguageFor(uiLanguage) ?? UI_LANGUAGES[0]
  const left = expiresAt ? timeLeft(expiresAt - Date.now()) : null
  const pick = (patch: Partial<Preferences>) => {
    tap()
    onPrefs(patch)
    setPage("main")
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        hitSlop={6}
        accessibilityLabel={t.lessonMenu}
        onPress={() => setOpen(true)}
      >
        <EllipsisIcon />
      </Button>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
        statusBarTranslucent
      >
        <DirectionView dir={dir} className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/50"
            onPress={close}
            accessibilityLabel={t.cancel}
          />
          <View
            className="max-h-[80%] rounded-t-2xl border-t border-border bg-popover"
            style={{ paddingBottom: Math.max(16, insets.bottom) }}
            accessibilityViewIsModal
          >
            <View className="items-center pt-2 pb-1" aria-hidden>
              <View className="h-1 w-9 rounded-full bg-muted-foreground/40" />
            </View>
            <ScrollView contentContainerClassName="px-2 pb-2">
              {page === "main" ? (
                <Animated.View entering={FadeIn.duration(150)}>
                  <View className="gap-0.5 px-3 pt-1 pb-2">
                    <Text numberOfLines={2} className="text-sm font-medium">
                      {title}
                    </Text>
                    {left ? (
                      <Text className="text-xs text-muted-foreground">
                        {t.expires[left.unit](left.count)}
                      </Text>
                    ) : null}
                  </View>
                  <Row
                    icon={<ShareIcon />}
                    label={t.share}
                    onPress={() => {
                      close()
                      onShare()
                    }}
                  />
                  <Row
                    icon={<RestartIcon />}
                    label={t.restart}
                    onPress={() => {
                      close()
                      Alert.alert(t.restartTitle, t.restartBody, [
                        { text: t.stay, style: "cancel" },
                        {
                          text: t.restart,
                          style: "destructive",
                          onPress: onRestart,
                        },
                      ])
                    }}
                  />
                  <Separator />
                  <Row
                    icon={
                      <Ninja
                        size={16}
                        level={ninja === "off" ? "sensei" : ninja}
                      />
                    }
                    label={t.ninja}
                    value={t.ninjaLevels[ninja]}
                    more
                    onPress={() => setPage("ninja")}
                  />
                  <Row
                    icon={<TypeIcon />}
                    label={t.textSize}
                    value={t.sizesShort[size]}
                    more
                    onPress={() => setPage("size")}
                  />
                  {UI_TRANSLATIONS ? (
                    <Row
                      icon={<GlobeIcon />}
                      label={t.language}
                      value={language.label}
                      more
                      onPress={() => setPage("language")}
                    />
                  ) : null}
                  {hasVoice(lessonLanguage) ? (
                    <Row
                      icon={<SoundIcon on={sound} />}
                      label={t.sound}
                      value={sound ? t.sound : t.muted}
                      role="switch"
                      checked={sound}
                      onPress={() => {
                        tap()
                        onPrefs({ sound: sound ? "off" : "on" })
                      }}
                    />
                  ) : null}
                </Animated.View>
              ) : (
                <Animated.View entering={FadeIn.duration(150)}>
                  <Row
                    icon={<BackIcon />}
                    label={
                      page === "ninja"
                        ? t.ninja
                        : page === "size"
                          ? t.textSize
                          : t.language
                    }
                    strong
                    onPress={() => setPage("main")}
                  />
                  <Separator />
                  {page === "ninja"
                    ? NINJA_LEVELS.map((id) => (
                        <Choice
                          key={id}
                          label={t.ninjaLevels[id]}
                          hint={t.ninjaHints[id]}
                          selected={id === ninja}
                          onPress={() => pick({ ninja: id })}
                        />
                      ))
                    : page === "size"
                      ? SIZES.map((id) => (
                          <Choice
                            key={id}
                            label={
                              id === "md"
                                ? `${t.sizes[id]} ${t.defaultOption}`
                                : t.sizes[id]
                            }
                            selected={id === size}
                            onPress={() => pick({ textSize: id })}
                          />
                        ))
                      : UI_LANGUAGES.map((l) => (
                          <Choice
                            key={l.code}
                            label={l.label}
                            selected={l.code === language.code}
                            onPress={() => pick({ uiLanguage: l.code })}
                          />
                        ))}
                </Animated.View>
              )}
            </ScrollView>
          </View>
        </DirectionView>
      </Modal>
    </>
  )
}

/** A menu row: the icon, the label, and the setting's value at the end. Rows a thumb can hit. */
function Row({
  icon,
  label,
  value,
  more,
  strong,
  role = "button",
  checked,
  onPress,
}: {
  icon: ReactNode
  label: string
  value?: string
  /** Opens a page of choices. */
  more?: boolean
  strong?: boolean
  role?: "button" | "switch"
  checked?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-3 rounded-lg px-3 py-2 active:bg-accent"
      accessibilityRole={role}
      accessibilityState={role === "switch" ? { checked } : undefined}
      accessibilityValue={value ? { text: value } : undefined}
    >
      <View className="h-4 w-4 items-center justify-center">{icon}</View>
      <Text
        className={cn("min-w-0 flex-1 text-base", strong && "font-medium")}
        numberOfLines={1}
      >
        {label}
      </Text>
      {value ? (
        <Text className="text-base text-muted-foreground" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {more ? (
        <View style={{ transform: [{ scaleX: -1 }] }}>
          <BackIcon color={colors.muted.foreground} />
        </View>
      ) : null}
    </Pressable>
  )
}

/** One of a setting's choices, with a check on the one in use. */
function Choice({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string
  hint?: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-3 rounded-lg px-3 py-2 active:bg-accent"
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View className="h-4 w-4 items-center justify-center">
        {selected ? <CheckIcon /> : null}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-base">{label}</Text>
        {hint ? (
          <Text className="text-sm text-muted-foreground">{hint}</Text>
        ) : null}
      </View>
    </Pressable>
  )
}

function Separator() {
  return <View className="mx-3 my-1 h-px bg-border" />
}

/** Lucide's Volume2 and VolumeX, as the header's Sound button had them. */
function SoundIcon({ on }: { on: boolean }) {
  return (
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
  )
}
