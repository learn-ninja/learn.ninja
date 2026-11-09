import { router, Stack } from "expo-router"
import { useEffect, useState, type ReactNode } from "react"
import { Alert, Pressable, ScrollView, Switch, View } from "react-native"

import {
  UI_LANGUAGES,
  UI_TRANSLATIONS,
  type Strings,
} from "@workspace/player-core/strings"

import { DirectionView } from "@/components/direction"
import { CheckIcon, LogOutIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { API_BASE_URL } from "@/lib/config"
import { handleProblem, normalizeHandle } from "@/lib/handle"
import { remindersSwitched } from "@/lib/reminders"
import { selection, tap } from "@/lib/haptics"
import { saveHandle } from "@/lib/save-handle"
import { signOut, useSession } from "@/lib/session"
import { usePreferences } from "@/lib/use-preferences"
import { useAppStrings } from "@/lib/use-strings"

// The account's settings off iOS (settings.ios.tsx draws iOS's own form, with SwiftUI and the
// system's text prompt, neither of which Android has): the same page in React Native, as phase 4
// had it. Who's logged in, the handle in a text field (saved as the web's settings save it), the
// app's language, and Log out, confirmed first.

export default function Settings() {
  const { t, lang, dir } = useAppStrings()
  const session = useSession()
  useEffect(() => {
    if (session.state === "out") router.replace("/")
  }, [session.state])
  if (session.state !== "in") return null
  const { account } = session
  return (
    <DirectionView dir={dir} className="flex-1 bg-background">
      <Stack.Screen options={{ title: t.settings, headerLargeTitle: false }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-8 px-4 pb-16 pt-2"
      >
        <Section title={t.account.title}>
          <Text className="text-sm text-muted-foreground">
            {t.account.loggedInAs(`⁨${account.email}⁩`)}
          </Text>
          <HandleField current={account.handle ?? ""} t={t} />
        </Section>
        {UI_TRANSLATIONS ? <LanguageSection current={lang} t={t} /> : null}
        <RemindersRow t={t} />
        <Button variant="outline" size="lg" onPress={() => confirmLogOut(t)}>
          <LogOutIcon />
          <Text>{t.signIn.logOut}</Text>
        </Button>
      </ScrollView>
    </DirectionView>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-base font-semibold" accessibilityRole="header">
        {title}
      </Text>
      <View className="gap-3 rounded-xl bg-card p-4 shadow-xs">{children}</View>
    </View>
  )
}

function HandleField({ current, t }: { current: string; t: Strings }) {
  const [value, setValue] = useState(current)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean }>()
  const handle = normalizeHandle(value)
  const save = async () => {
    const problem = handleProblem(handle, t)
    if (problem) return setMessage({ text: problem, error: true })
    setBusy(true)
    setMessage(undefined)
    const refused = await saveHandle(handle, t)
    setBusy(false)
    if (refused) return setMessage({ text: refused, error: true })
    setValue(handle)
    setMessage({ text: t.account.saved, error: false })
  }
  const host = API_BASE_URL.replace(/^https?:\/\//, "")
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">{t.account.handle}</Text>
      <View className="flex-row gap-2">
        <Input
          // Uncontrolled: a controlled field drops keys typed quickly.
          defaultValue={current}
          key={current}
          onChangeText={setValue}
          accessibilityLabel={t.account.handle}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          editable={!busy}
          className="flex-1"
          style={{ writingDirection: "ltr" }}
        />
        <Button
          variant="outline"
          disabled={busy || handle === current}
          onPress={() => void save()}
        >
          <Text>{t.account.save}</Text>
        </Button>
      </View>
      <Text
        className={
          message?.error
            ? "text-sm text-destructive"
            : "text-sm text-muted-foreground"
        }
        accessibilityLiveRegion="polite"
      >
        {message?.text ??
          t.account.handleHint(`⁨${host}/u/${handle || current}⁩`)}
      </Text>
    </View>
  )
}

/** The app's language, the one the lesson menu also sets (kept in the web's preferences). */
function LanguageSection({ current, t }: { current: string; t: Strings }) {
  const [, update] = usePreferences()
  return (
    <Section title={t.language}>
      <View className="-mx-2 -my-1">
        {UI_LANGUAGES.map((l) => {
          const on = l.code === current
          return (
            <Pressable
              key={l.code}
              onPress={() => {
                selection()
                update({ uiLanguage: l.code })
              }}
              className="min-h-11 flex-row items-center gap-3 rounded-lg px-2 py-2 active:bg-accent"
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <View className="h-4 w-4 items-center justify-center">
                {on ? <CheckIcon /> : null}
              </View>
              <Text className="text-base">{l.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </Section>
  )
}

/** Log out, after confirming, back to the home. */
function confirmLogOut(t: Strings) {
  Alert.alert(t.signIn.logOut, undefined, [
    { text: t.cancel, style: "cancel" },
    {
      text: t.signIn.logOut,
      style: "destructive",
      onPress: async () => {
        tap()
        await signOut()
        router.dismissAll()
        router.replace("/")
      },
    },
  ])
}

/** The evening streak reminder's switch (reminders.ts): on until switched off. */
function RemindersRow({ t }: { t: Strings }) {
  const [prefs, update] = usePreferences()
  const on = prefs.reminders !== false
  return (
    <View className="flex-row items-center justify-between gap-4 rounded-xl bg-card p-4 shadow-xs">
      <Text className="flex-1 text-sm font-medium">{t.reminders.setting}</Text>
      <Switch
        value={on}
        accessibilityLabel={t.reminders.setting}
        onValueChange={(next) => {
          selection()
          update({ reminders: next })
          void remindersSwitched(next)
        }}
      />
    </View>
  )
}
