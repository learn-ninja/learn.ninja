import {
  Button,
  Form,
  Host,
  LabeledContent,
  Picker,
  Section,
  Text,
} from "@expo/ui/swift-ui"
import { foregroundStyle, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers"
import { router, Stack } from "expo-router"
import { useEffect } from "react"
import { Alert } from "react-native"

import {
  UI_LANGUAGES,
  UI_TRANSLATIONS,
  type Strings,
} from "@workspace/player-core/strings"

import { apiFetch } from "@/lib/api"
import { API_BASE_URL } from "@/lib/config"
import { handleError, handleProblem, normalizeHandle } from "@/lib/handle"
import { selection, tap } from "@/lib/haptics"
import { refreshSession, signOut, useSession } from "@/lib/session"
import { usePreferences } from "@/lib/use-preferences"
import { useAppStrings } from "@/lib/use-strings"
import { colors } from "../../../../tokens"

// The account's settings, from the gear on your own profile, as iOS's own Settings draws a page:
// a grouped form (SwiftUI's, through @expo/ui) with who's logged in and the handle, the app's
// language as a menu of the player's languages, and Log out in red, confirmed first. The handle
// is changed in the system's text prompt and saved as the web's settings save it
// (PATCH /api/account).

export default function Settings() {
  const { t, lang, dir } = useAppStrings()
  const session = useSession()
  const [, update] = usePreferences()
  useEffect(() => {
    if (session.state === "out") router.replace("/")
  }, [session.state])
  if (session.state !== "in") return null
  const { account } = session
  const host = API_BASE_URL.replace(/^https?:\/\//, "")
  return (
    <>
      <Stack.Screen options={{ title: t.settings, headerLargeTitle: false }} />
      <Host
        style={{ flex: 1 }}
        colorScheme="dark"
        layoutDirection={dir === "rtl" ? "rightToLeft" : "leftToRight"}
      >
        <Form>
          <Section
            title={t.account.title}
            footer={
              <Text>
                {t.account.handleHint(
                  `⁨${host}/u/${account.handle ?? ""}⁩`
                )}
              </Text>
            }
          >
            <LabeledContent label={t.signIn.email}>
              <Text modifiers={[foregroundStyle(colors.muted.foreground)]}>
                {account.email}
              </Text>
            </LabeledContent>
            <Button onPress={() => changeHandle(account.handle ?? "", t)}>
              <LabeledContent label={t.account.handle}>
                <Text modifiers={[foregroundStyle(colors.muted.foreground)]}>
                  {account.handle ?? ""}
                </Text>
              </LabeledContent>
            </Button>
          </Section>
          {UI_TRANSLATIONS ? (
            <Section>
              <Picker
                label={t.language}
                systemImage="globe"
                selection={lang}
                onSelectionChange={(code: string) => {
                  selection()
                  update({ uiLanguage: code })
                }}
                modifiers={[pickerStyle("menu")]}
              >
                {UI_LANGUAGES.map((l) => (
                  <Text key={l.code} modifiers={[tag(l.code)]}>
                    {l.label}
                  </Text>
                ))}
              </Picker>
            </Section>
          ) : null}
          <Section>
            <Button
              role="destructive"
              label={t.signIn.logOut}
              onPress={() => confirmLogOut(t)}
            />
          </Section>
        </Form>
      </Host>
    </>
  )
}

/** The system's text prompt with the handle in it; saved, or the reason it can't be. */
function changeHandle(current: string, t: Strings) {
  Alert.prompt(
    t.account.handle,
    t.account.handleRules,
    [
      { text: t.cancel, style: "cancel" },
      {
        text: t.account.save,
        isPreferred: true,
        onPress: (value?: string) => void saveHandle(value ?? "", current, t),
      },
    ],
    "plain-text",
    current
  )
}

async function saveHandle(value: string, current: string, t: Strings) {
  const handle = normalizeHandle(value)
  if (!handle || handle === current) return
  const problem = handleProblem(handle, t)
  if (problem) return Alert.alert(t.account.handle, problem)
  try {
    const res = await apiFetch("/api/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle }),
    })
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean
      message?: string
    } | null
    if (!res.ok || !body?.ok)
      return Alert.alert(
        t.account.handle,
        handleError(res.status, body?.message, t)
      )
    tap()
    await refreshSession()
  } catch {
    Alert.alert(t.account.handle, t.signIn.failed)
  }
}

/** Log out, after the system's confirmation, back to the home. */
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
