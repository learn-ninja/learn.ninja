import { View } from "react-native"

import type { Answer, Mark } from "@workspace/player-core/check"
import type { Strings } from "@workspace/player-core/strings"
import type { QuestionKata, Visual as VisualSpec } from "@workspace/spec"

import {
  Control,
  controlStyles,
  CONTROL_TEXT_SIZE,
  MarkBadge,
  markColor,
  selectedStyles,
} from "@/components/controls"
import { RichText } from "@/components/rich-text"
import { Text } from "@/components/ui/text"
import { Visual } from "@/components/visuals/visual"
import { cn } from "@/lib/utils"
import { colors } from "../../../tokens"

export interface QuestionKataProps {
  kata: QuestionKata
  answer: Answer
  setAnswer: (answer: Answer) => void
  marks: Record<string, Mark>
  /** True after checking: the answer can't change until the learner tries again. */
  locked: boolean
  t: Strings
}

/**
 * Options with visuals (in a compare or a choice) show as cards: each card has the visual on a
 * panel, with its mark in the corner once checked, and an optional caption under it. Options that
 * are only text are rows, even in a compare.
 */
export function hasOptionCards(kata: QuestionKata): boolean {
  if (kata.type !== "compare" && kata.type !== "choice") return false
  return kata.options.some((o) => o.visual)
}

type Option = {
  id: string
  text?: string
  visual?: VisualSpec
  lang?: string
  outcome?: string
}

/**
 * A choice, compare, or scenario: rows to pick, or cards when the options are pictures. As on
 * the web's phone layout, a pair of cards stacks and three or more sit in two columns.
 */
export function OptionsKata({
  kata,
  answer,
  setAnswer,
  marks,
  locked,
  order,
  showOutcomes,
  tried = [],
  t,
}: QuestionKataProps & {
  order: string[]
  /** Scenario rows whose outcome shows under them (Every path). */
  showOutcomes: string[]
  /** A scenario's picks already rewound: crossed out, and they can't be picked again. */
  tried?: string[]
}) {
  if (
    kata.type !== "choice" &&
    kata.type !== "compare" &&
    kata.type !== "scenario"
  )
    return null
  const selected = answer.kind === "select" ? answer.ids : []
  const multiple = kata.type === "choice" && kata.multiple
  const toggle = (id: string) => {
    if (tried.includes(id)) return
    if (multiple)
      setAnswer({
        kind: "select",
        ids: selected.includes(id)
          ? selected.filter((x) => x !== id)
          : [...selected, id],
      })
    else setAnswer({ kind: "select", ids: [id] })
  }
  const options = order
    .map((id) => (kata.options as Option[]).find((o) => o.id === id))
    .filter((o): o is Option => Boolean(o))
  const cards = hasOptionCards(kata)
  const columns = cards && options.length >= 3

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={kata.prompt}
      className={cn("gap-3", columns && "flex-row flex-wrap")}
    >
      {options.map((o, i) =>
        cards ? (
          <OptionCard
            key={o.id}
            option={o}
            index={i}
            selected={selected.includes(o.id)}
            mark={marks[o.id]}
            disabled={locked}
            onPress={() => toggle(o.id)}
            columns={columns}
            t={t}
          />
        ) : (
          <OptionRow
            key={o.id}
            option={o}
            selected={selected.includes(o.id)}
            mark={marks[o.id]}
            disabled={locked || tried.includes(o.id)}
            tried={tried.includes(o.id) && !marks[o.id]}
            showOutcome={showOutcomes.includes(o.id)}
            onPress={() => toggle(o.id)}
            t={t}
          />
        )
      )}
    </View>
  )
}

/** A choice row: roomier than other controls, as on the web (min-h-12 px-4 py-3, rounded-lg). */
function OptionRow({
  option: o,
  selected,
  mark,
  disabled,
  tried,
  showOutcome,
  onPress,
  t,
}: {
  option: Option
  selected: boolean
  mark: Mark | undefined
  disabled: boolean
  tried: boolean
  showOutcome: boolean
  onPress: () => void
  t: Strings
}) {
  return (
    <Control
      selected={selected}
      mark={mark}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "min-h-12 w-full flex-row items-center gap-2 rounded-lg px-4 py-3",
        // Rewound: a dashed outline on nothing, its text struck through.
        tried && "border-dashed bg-transparent"
      )}
    >
      <View className="min-w-0 flex-1 gap-2">
        {o.text ? (
          <RichText
            text={o.text}
            size={CONTROL_TEXT_SIZE}
            className={cn(
              "text-lesson-sm font-medium",
              tried && "text-muted-foreground line-through"
            )}
          />
        ) : null}
        {o.visual ? <Visual visual={o.visual} /> : null}
        {o.outcome && showOutcome ? (
          <RichText
            text={o.outcome}
            size={CONTROL_TEXT_SIZE}
            className="text-lesson-sm text-muted-foreground"
          />
        ) : null}
      </View>
      {tried ? (
        <Text className="ms-auto shrink-0 font-mono text-xs text-muted-foreground">
          {t.tried}
        </Text>
      ) : (
        <MarkBadge mark={mark} className="ms-auto shrink-0" />
      )}
    </Control>
  )
}

/**
 * An option card: the visual on a panel in the page's color, the caption in a muted footer.
 * Selection and marks only recolor the border; the panel inherits it.
 */
function OptionCard({
  option: o,
  index,
  selected,
  mark,
  disabled,
  onPress,
  columns,
  t,
}: {
  option: Option
  index: number
  selected: boolean
  mark: Mark | undefined
  disabled: boolean
  onPress: () => void
  columns: boolean
  t: Strings
}) {
  const border = mark
    ? markColor(mark)
    : selected
      ? colors.primary.DEFAULT
      : colors.border
  return (
    <Control
      selected={selected}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={o.text ?? t.optionLabel(String(index + 1))}
      className={cn(
        controlStyles,
        selected && selectedStyles,
        "bg-surface overflow-hidden rounded-xl",
        columns ? "w-[48%] grow" : "w-full"
      )}
      style={{ borderColor: border }}
    >
      {o.visual ? (
        <View
          className={cn(
            "-m-px min-h-28 justify-center rounded-xl border bg-background px-1 py-5",
            !o.text && "-mb-px"
          )}
          style={{ borderColor: border }}
        >
          <MarkBadge mark={mark} className="absolute end-3 top-3 z-10" />
          <Visual visual={o.visual} plain />
        </View>
      ) : null}
      {o.text ? (
        <View className="flex-row items-start gap-3 px-4 py-3">
          <RichText
            text={o.text}
            size={CONTROL_TEXT_SIZE}
            className="text-lesson-sm flex-1 font-medium"
          />
          {o.visual ? null : <MarkBadge mark={mark} />}
        </View>
      ) : null}
    </Control>
  )
}
