import { createContext, useContext } from "react"

import type { NinjaLevel } from "@workspace/player-core/strings"

/**
 * What the screens need from the player around them for the ninja and his smoke, so the screens
 * take it without new props: his setting (Off leaves him out), and whether the intro is vanishing.
 */
export interface Stage {
  ninja: NinjaLevel
  vanishing: boolean
}

export const StageContext = createContext<Stage>({
  ninja: "sensei",
  vanishing: false,
})

export const useStage = () => useContext(StageContext)
