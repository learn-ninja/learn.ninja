import { useEffect } from "react"
import { I18nManager } from "react-native"

import { isRtl } from "./ui-language"
import { useAppStrings } from "./use-strings"

// The app's native direction follows its language. Each screen mirrors at once by itself
// (components/direction.tsx), so nothing waits on a reload; iOS reads I18nManager's choice only at
// launch, so the system's own pieces (the back swipe, the navigation transitions) follow from the
// next launch. Expo's guide sets it this way with expo-localization's supportsRTL (app.config.ts);
// it would reload the app to apply it now, which would drop the screen the learner is on.

export function DirectionEffect() {
  const { lang } = useAppStrings()
  const rtl = isRtl(lang)
  useEffect(() => {
    I18nManager.allowRTL(true)
    if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl)
  }, [rtl])
  return null
}
