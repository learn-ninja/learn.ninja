import "../global.css"

import { DarkTheme, Stack, ThemeProvider } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"

import { SessionEffects } from "@/lib/session"
import { colors } from "../../tokens"

// Dark is the brand, and the app is dark-only for now (app.config.ts's userInterfaceStyle), as the site is.
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.foreground,
    border: colors.border,
    primary: colors.primary.DEFAULT,
  },
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <SessionEffects />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: "learn.ninja" }} />
          <Stack.Screen name="l/[slugId]" options={{ title: "" }} />
          <Stack.Screen
            name="sign-in"
            options={{ presentation: "modal", headerShown: false }}
          />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
