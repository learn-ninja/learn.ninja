import { router, Stack } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { useRef, useState, type ComponentRef } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { DirectionView } from "@/components/direction"
import { CloseButton } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { authClient } from "@/lib/auth-client"
import { API_BASE_URL } from "@/lib/config"
import { tap } from "@/lib/haptics"
import { looksLikeEmail, signInError } from "@/lib/sign-in-errors"
import { useAppStrings } from "@/lib/use-strings"
import { cn } from "@/lib/utils"
import { useSafeAreaInsets } from "react-native-safe-area-context"

// Log in with a six-digit email code, as the web's /login does (apps/web/components/account/
// login-form.tsx): the email first, then the code, with the same words and errors. GitHub stays on
// the website. The screen is a sheet over whatever opened it, and closes itself once signed in.

const CODE_LENGTH = 6

export default function SignIn() {
  const { t, dir } = useAppStrings()
  const s = t.signIn
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Each wrong code starts the field over, empty. */
  const [attempt, setAttempt] = useState(0)

  async function sendCode() {
    if (busy) return
    const address = email.trim()
    if (!looksLikeEmail(address)) return setError(s.badEmail)
    setBusy(true)
    setError(null)
    const { error } = await authClient.emailOtp
      .sendVerificationOtp({ email: address, type: "sign-in" })
      .catch(() => ({ error: {} }))
    setBusy(false)
    if (error) return setError(signInError(error, t))
    setCode("")
    setStep("code")
  }

  async function verify(value = code) {
    if (value.length < CODE_LENGTH || busy) return
    setBusy(true)
    setError(null)
    const { error } = await authClient.signIn
      .emailOtp({ email: email.trim(), otp: value })
      .catch(() => ({ error: {} }))
    setBusy(false)
    if (error) {
      setCode("")
      setAttempt((n) => n + 1)
      return setError(signInError(error, t))
    }
    tap()
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }

  return (
    // The screen and its text run the app language's way (direction.tsx).
    <DirectionView dir={dir} className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View className="h-14 flex-row items-center px-4">
          <CloseButton
            label={t.cancel}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow items-center justify-center px-4 py-12"
        >
          <View className="w-full max-w-sm items-center gap-8">
            {step === "email" ? (
              <>
                <Heading title={s.title}>{s.body}</Heading>
                <View className="w-full gap-3">
                  <Input
                    // Uncontrolled: a controlled field drops keys typed quickly (autofill, paste).
                    defaultValue={email}
                    onChangeText={(text) => {
                      setEmail(text)
                      if (error) setError(null)
                    }}
                    placeholder="you@example.com"
                    accessibilityLabel={s.email}
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="send"
                    onSubmitEditing={() => void sendCode()}
                    editable={!busy}
                    // An address reads left to right in every language.
                    style={{ writingDirection: "ltr" }}
                  />
                  {error ? <FormError>{error}</FormError> : null}
                  <Button
                    size="lg"
                    disabled={busy}
                    onPress={() => void sendCode()}
                  >
                    <Text>{s.sendCode}</Text>
                  </Button>
                </View>
                <Text className="text-center text-sm text-muted-foreground">
                  {s.noPassword}
                </Text>
              </>
            ) : (
              <>
                <Heading title={s.codeTitle}>
                  {s.codeSent(`⁨${email.trim()}⁩`)}
                </Heading>
                <CodeField
                  key={attempt}
                  value={code}
                  label={s.code}
                  disabled={busy}
                  onChange={(value) => {
                    setCode(value)
                    if (value.length === CODE_LENGTH) void verify(value)
                  }}
                />
                {error ? <FormError>{error}</FormError> : null}
                <View className="w-full gap-2">
                  <Button
                    size="lg"
                    disabled={busy || code.length < CODE_LENGTH}
                    onPress={() => void verify()}
                  >
                    <Text>{s.submit}</Text>
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    disabled={busy}
                    onPress={() => {
                      setError(null)
                      setStep("email")
                    }}
                  >
                    <Text>{s.otherEmail}</Text>
                  </Button>
                </View>
              </>
            )}
          </View>
        </ScrollView>
        <View
          className="px-4 pt-2"
          style={{ paddingBottom: Math.max(24, insets.bottom) }}
        >
          <Legal t={t} />
        </View>
      </KeyboardAvoidingView>
    </DirectionView>
  )
}

/** The panel's heading and the line under it (the web's AuthHeading). */
function Heading({ title, children }: { title: string; children: string }) {
  return (
    <View className="gap-2">
      <Text
        className="text-center text-2xl font-semibold tracking-tight"
        accessibilityRole="header"
      >
        {title}
      </Text>
      <Text className="text-center text-base text-muted-foreground">
        {children}
      </Text>
    </View>
  )
}

function FormError({ children }: { children: string }) {
  return (
    <Text
      className="text-sm text-destructive"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      {children}
    </Text>
  )
}

/**
 * Six boxes for the code, as the web's InputOTP draws them, over one field that takes the typing,
 * the paste, and iOS's code from Mail.
 */
function CodeField({
  value,
  label,
  disabled,
  onChange,
}: {
  value: string
  label: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessible={false}
      // Digits run left to right in every language.
      style={{ direction: "ltr" }}
    >
      <View className="flex-row">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <View
            key={i}
            className={cn(
              "h-11 w-11 items-center justify-center border-y border-e border-input bg-background dark:bg-input/30",
              i === 0 && "rounded-s-lg border-s",
              i === CODE_LENGTH - 1 && "rounded-e-lg",
              i === Math.min(value.length, CODE_LENGTH - 1) &&
                !disabled &&
                "border-ring"
            )}
          >
            <Text className="text-base font-medium">{value[i] ?? ""}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        // Uncontrolled, as the email field: a controlled one drops digits typed or pasted quickly.
        // A cleared code (after a wrong one) remounts it empty through its key.
        onChangeText={(text) =>
          onChange(text.replace(/\D/g, "").slice(0, CODE_LENGTH))
        }
        accessibilityLabel={label}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        autoFocus
        editable={!disabled}
        caretHidden
        className="absolute inset-0 text-transparent"
        style={{ color: "transparent" }}
      />
    </Pressable>
  )
}

/** The web's LegalConsent: the Terms and the Privacy Policy, opened in the in-app browser. */
function Legal({ t }: { t: Strings }) {
  const open = (path: string) =>
    void WebBrowser.openBrowserAsync(`${API_BASE_URL}${path}`)
  const parts = t.signIn.legal.split(/(\{terms\}|\{privacy\})/)
  return (
    <Text className="text-center text-sm text-muted-foreground">
      {parts.map((part, i) =>
        part === "{terms}" ? (
          <Text
            key={i}
            className="text-sm font-medium text-foreground underline"
            accessibilityRole="link"
            onPress={() => open("/terms")}
          >
            {t.terms}
          </Text>
        ) : part === "{privacy}" ? (
          <Text
            key={i}
            className="text-sm font-medium text-foreground underline"
            accessibilityRole="link"
            onPress={() => open("/privacy")}
          >
            {t.privacy}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  )
}
