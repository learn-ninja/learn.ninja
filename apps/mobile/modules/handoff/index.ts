import { requireOptionalNativeModule } from "expo"
import { useEffect } from "react"

// The app's own Handoff module (ios/HandoffModule.swift): while a lesson is open, a nearby Mac or
// iPad on the same Apple Account offers its web page. iOS only; elsewhere it isn't there and this
// does nothing.

interface HandoffModule {
  start(url: string, title: string): Promise<void>
  stop(): Promise<void>
}

const native = requireOptionalNativeModule<HandoffModule>("Handoff")

/** Offers `url` to Handoff while the calling screen is mounted (and `url` is set). */
export function useHandoff(url: string | null, title: string) {
  useEffect(() => {
    if (!native || !url) return
    void native.start(url, title).catch(() => {})
    return () => {
      void native.stop().catch(() => {})
    }
  }, [url, title])
}
