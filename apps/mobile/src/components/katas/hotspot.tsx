import { Visual } from "@/components/visuals/visual"

import type { QuestionKataProps } from "./options"

/** Tap the right part of the visual: the parts are the visual's own (visual.tsx takes the taps). */
export function HotspotKata({
  kata,
  answer,
  setAnswer,
  marks,
  locked,
}: QuestionKataProps) {
  if (kata.type !== "hotspot") return null
  const selected = answer.kind === "select" ? answer.ids : []
  const onToggle = (id: string) =>
    setAnswer({
      kind: "select",
      ids: kata.multiple
        ? selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [id, ...selected.filter((x) => x !== id)].sort()
        : [id],
    })
  return (
    <Visual
      visual={kata.visual}
      hotspots={{ selected, marks, onToggle, disabled: locked }}
      label={kata.prompt}
    />
  )
}
