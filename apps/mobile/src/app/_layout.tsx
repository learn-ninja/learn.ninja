import "../global.css"

import { DarkTheme, Stack, ThemeProvider } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"

import { DirectionEffect } from "@/lib/direction-effect"
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
        <DirectionEffect />
        <Stack
          screenOptions={{
            // Every screen draws its own header, in its own direction (components/app-header.tsx).
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="l/[slugId]" />
          <Stack.Screen name="u/[handle]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
