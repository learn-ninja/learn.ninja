import { createContext, use, type ReactNode } from "react"
import { I18nManager, View, type ViewProps } from "react-native"

// Which way a screen runs. The app's own screens follow the app's language, a lesson the
// player's language for it (ui-language.ts), so one screen can be right to left while the rest of
// the app isn't: the screen's root sets Yoga's `direction`, which mirrors rows and every start and
// end inside it, and Text reads this context to set its writing direction, since iOS's natural
// alignment follows the app's direction rather than the view's. A language the whole app runs
// in also sets I18nManager on the next launch (ui-language-effects.ts), so the system's own
// pieces (the back swipe, the keyboard) follow too.

export type Direction = "ltr" | "rtl"

const DirectionContext = createContext<Direction>(
  I18nManager.isRTL ? "rtl" : "ltr"
)

export const useDirection = () => use(DirectionContext)

/** A view that runs `dir`, with everything inside it. */
export function DirectionView({
  dir,
  style,
  children,
  ...props
}: ViewProps & { dir: Direction; children: ReactNode }) {
  return (
    <DirectionContext value={dir}>
      <View {...props} style={[{ direction: dir }, style]}>
        {children}
      </View>
    </DirectionContext>
  )
}

/** Just the context, for a subtree whose root view sets `direction` itself. */
export const DirectionProvider = DirectionContext
