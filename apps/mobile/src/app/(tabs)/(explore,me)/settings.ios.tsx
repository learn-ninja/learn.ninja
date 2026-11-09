import {
  Button,
  Form,
  Host,
  LabeledContent,
  Picker,
  Section,
  Text,
  Toggle,
} from "@expo/ui/swift-ui"
import { foregroundStyle, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers"
import { router, Stack } from "expo-router"
import { useEffect, useRef } from "react"
import { Alert } from "react-native"

import {
  UI_LANGUAGES,
  UI_TRANSLATIONS,
  type Strings,
} from "@workspace/player-core/strings"

import { API_BASE_URL } from "@/lib/config"
import { handleProblem, normalizeHandle } from "@/lib/handle"
import { remindersSwitched } from "@/lib/reminders"
import { deleteAccount } from "@/lib/delete-account"
import { selection, tap } from "@/lib/haptics"
import { confirmUnblock, useBlocked } from "@/lib/moderation"
import { saveHandle } from "@/lib/save-handle"
import { signOut, useSession } from "@/lib/session"
import { usePreferences } from "@/lib/use-preferences"
import { useAppStrings } from "@/lib/use-strings"
import { colors } from "../../../../tokens"

// The account's settings on iOS (settings.tsx is the rest of the platforms'), from the gear on
// your own profile, as iOS's own Settings draws a page:
// a grouped form (SwiftUI's, through @expo/ui) with who's logged in and the handle, the app's
// language as a menu of the player's languages, the streak reminder's switch, the people blocked
// (each unblocked with a tap, confirmed), Log out in red, confirmed first, and Delete account,
// confirmed in the system's prompt with the email typed again (App Store guideline 5.1.1(v): an
// app that makes accounts deletes them too). The handle
// is changed in the system's text prompt and saved as the web's settings save it
// (PATCH /api/account).

export default function Settings() {
  const { t, lang, dir } = useAppStrings()
  const session = useSession()
  const [prefs, update] = usePreferences()
  const blocked = useBlocked()
  // Set once this screen's Log out takes it off the stack itself, so the effect below doesn't pop
  // a second screen (the profile under it, from Explore) as the session ends mid-transition.
  const leaving = useRef(false)
  // Logged out some other way (the session ended): off the stack, back to the profile's root.
  useEffect(() => {
    if (session.state !== "out" || leaving.current) return
    if (router.canGoBack()) router.back()
    else router.replace("/")
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
                {t.account.handleHint(`⁨${host}/u/${account.handle ?? ""}⁩`)}
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
            {/* The evening streak reminder (reminders.ts): on until switched off. */}
            <Toggle
              label={t.reminders.setting}
              systemImage="bell"
              isOn={prefs.reminders !== false}
              onIsOnChange={(on) => {
                selection()
                update({ reminders: on })
                void remindersSwitched(on)
              }}
            />
          </Section>
          {blocked ? (
            // The people blocked from a lesson's menu, a row's, or their profile, each with Unblock.
            <Section
              title={t.moderation.blockedTitle}
              footer={
                blocked.length ? undefined : (
                  <Text>{t.moderation.blockedNone}</Text>
                )
              }
            >
              {blocked.map((person) => (
                <Button
                  key={person.id}
                  onPress={() => confirmUnblock(person, t)}
                >
                  <LabeledContent label={person.handle ?? person.name}>
                    <Text
                      modifiers={[foregroundStyle(colors.muted.foreground)]}
                    >
                      {t.moderation.unblock}
                    </Text>
                  </LabeledContent>
                </Button>
              ))}
            </Section>
          ) : null}
          <Section>
            <Button
              role="destructive"
              label={t.signIn.logOut}
              onPress={() =>
                confirmLogOut(t, () => {
                  leaving.current = true
                })
              }
            />
          </Section>
          <Section>
            <Button
              role="destructive"
              label={t.account.deleteAccount}
              onPress={() => confirmDelete(t, leaving)}
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
        onPress: (value?: string) => void changeTo(value ?? "", current, t),
      },
    ],
    "plain-text",
    current
  )
}

async function changeTo(value: string, current: string, t: Strings) {
  const handle = normalizeHandle(value)
  // Unchanged: nothing to save. Anything else is checked first, so an answer that tidies away to
  // nothing ("@@", an emoji) says the rules instead of closing the prompt without a word.
  if (handle && handle === current) return
  const problem = handleProblem(handle, t) ?? (await saveHandle(handle, t))
  if (problem) Alert.alert(t.account.handle, problem)
}

/** Log out, after the system's confirmation, back to the home. */
function confirmLogOut(t: Strings, onLeave: () => void) {
  Alert.alert(t.signIn.logOut, undefined, [
    { text: t.cancel, style: "cancel" },
    {
      text: t.signIn.logOut,
      style: "destructive",
      onPress: async () => {
        tap()
        // Off the tab's stack first (Settings is pushed there, not a modal): once the session
        // ends this screen has nothing to show, and the tab would be left on it.
        onLeave()
        if (router.canGoBack()) router.back()
        await signOut()
        router.replace("/")
      },
    },
  ])
}

/**
 * Delete the account, after the system's prompt says what goes and that it can't be undone, with
 * the email typed in it to confirm; then back to the home, logged out. A wrong email or a failure
 * says so and leaves everything as it was.
 */
function confirmDelete(t: Strings, leaving: { current: boolean }) {
  Alert.prompt(
    t.account.deleteAccount,
    t.account.deleteWarning,
    [
      { text: t.cancel, style: "cancel" },
      {
        text: t.account.deleteAccount,
        style: "destructive",
        onPress: async (typed?: string) => {
          tap()
          // Set before the session ends (deleteAccount forgets it), so the effect above doesn't pop
          // a screen of its own while this one leaves.
          leaving.current = true
          const problem = await deleteAccount(typed ?? "", t)
          if (problem) {
            leaving.current = false
            Alert.alert(t.account.deleteAccount, problem)
            return
          }
          if (router.canGoBack()) router.back()
          router.replace("/")
        },
      },
    ],
    "plain-text",
    "",
    "email-address"
  )
}
