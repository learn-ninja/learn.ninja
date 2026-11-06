import { router, Stack } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable, ScrollView, View } from "react-native"

import {
  UI_LANGUAGES,
  UI_TRANSLATIONS,
  type Strings,
} from "@workspace/player-core/strings"

import { AppHeader } from "@/components/app-header"
import { DirectionView } from "@/components/direction"
import { CheckIcon, LogOutIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { apiFetch } from "@/lib/api"
import { API_BASE_URL } from "@/lib/config"
import { handleError, handleProblem, normalizeHandle } from "@/lib/handle"
import { tap } from "@/lib/haptics"
import { refreshSession, signOut, useSession } from "@/lib/session"
import { usePreferences } from "@/lib/use-preferences"
import { useAppStrings } from "@/lib/use-strings"

// The account's settings, from the gear on your own profile: who's logged in, the handle (the web's
// settings page sets it the same way, PATCH /api/account), the app's language, and Log out.

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
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader back title={t.settings} t={t} />
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
        <Button
          variant="outline"
          size="lg"
          onPress={async () => {
            tap()
            await signOut()
            router.dismissAll()
            router.replace("/")
          }}
        >
          <LogOutIcon />
          <Text>{t.signIn.logOut}</Text>
        </Button>
      </ScrollView>
    </DirectionView>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
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
    try {
      const res = await apiFetch("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle }),
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
      } | null
      if (!res.ok || !body?.ok)
        return setMessage({
          text: handleError(res.status, body?.error, t),
          error: true,
        })
      tap()
      setValue(handle)
      setMessage({ text: t.account.saved, error: false })
      await refreshSession()
    } catch {
      setMessage({ text: t.signIn.failed, error: true })
    } finally {
      setBusy(false)
    }
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
          className="h-11"
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
                tap()
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
