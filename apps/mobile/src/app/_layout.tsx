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

/** A link opened from outside (learn.ninja/l/…) lands with the tabs under it, so closing goes home. */
export const unstable_settings = { anchor: "(tabs)" }

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
          {/* The tabs: Explore and the learner's profile, each its own stack. */}
          <Stack.Screen name="(tabs)" />
          {/* A lesson slides up over everything, as Duolingo's and Brilliant's do, and closes
              with its X: no edge swipe, which a drag near the edge in sort or order would
              otherwise set off. */}
          <Stack.Screen
            name="l/[slugId]"
            options={{ presentation: "fullScreenModal", gestureEnabled: false }}
          />
          <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
