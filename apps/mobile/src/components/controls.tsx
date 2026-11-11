import type { ReactNode } from "react"
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"

import type { Mark } from "@workspace/player-core/check"

import { useMarkedAnswer } from "@/components/answer-marks"
import { RichText } from "@/components/rich-text"
import { useStage } from "@/components/stage-context"
import { Text } from "@/components/ui/text"
import { mix } from "@/lib/color"
import { tap } from "@/lib/haptics"
import { cn } from "@/lib/utils"
import { colors, fontSize } from "../../tokens"

// The one recipe for the controls inside a kata (options, chips, sort and order items, placed
// words), after the web's packages/player/src/controls.ts, so every kata's controls share a shape
// and a height. The colors are the tokens; the tints are worked out from them (tailwind.config.js).

/** A control's look without its states: for pictures of a control that take no pointer themselves. */
export const controlSurface =
  "rounded-md border border-border bg-surface shadow-xs"
/** A control on a card: pressed and selected states on top of the surface. */
export const controlStyles = cn(controlSurface, "active:bg-surface-active")
/** A selected control: the primary border on the muted fill. */
export const selectedStyles = "border-primary bg-muted"
/** A one-line control's padding; its text is text-lesson-sm font-medium. */
export const controlPadding = "px-3 py-2.5"
/** The text inside a one-line control. */
export const controlText = "text-lesson-sm font-medium"
/** An empty place a control can go: an open order slot, an empty sort lane, a used word's ghost. */
export const slotStyles =
  "rounded-md border border-dashed border-foreground/20 bg-slot"

/**
 * No shadow, for a control drawn as a dashed place or a bare line (a used word, a settled pair, a
 * rewound option, a blank's gap): its fill is clear, and a shadow needs a solid one. A style, not
 * a class, so the control's classes stay the same from state to state (class-names.test.ts).
 */
export const NO_SHADOW = { shadowOpacity: 0 } satisfies ViewStyle

/** The color a checked answer takes: green for correct, yellow for wrong, amber for partly right. */
export function markColor(mark: Mark): string {
  return mark === "correct"
    ? colors.feedback.good
    : mark === "partial"
      ? colors.feedback.partial
      : colors.feedback.warn
}

/**
 * A mark outranks the selected colors: a 10% tint inside a border of the color. The tint is mixed
 * into the page's color rather than laid over it, so the control's fill stays solid under its
 * shadow.
 */
export function markStyle(mark: Mark | undefined): ViewStyle | undefined {
  if (!mark) return undefined
  return {
    borderColor: markColor(mark),
    backgroundColor: mix(markColor(mark), 10, colors.background),
  }
}

/** The size of a sentence's text in a control, in points. */
export const CONTROL_TEXT_SIZE = fontSize.sm[0]

/**
 * An answer control: an option row, a chip, a tile. It takes a light tap as it's pressed, shows
 * selection with the primary border, and after checking takes its mark's color (unless `markTint`
 * is off: an option card colors only its border, itself). A marked control is one the player keeps
 * in view when the feedback opens (answer-marks.tsx).
 */
export function Control({
  selected = false,
  mark,
  markTint = true,
  disabled = false,
  onPress,
  className,
  style,
  children,
  accessibilityLabel,
  hitSlop,
}: {
  selected?: boolean
  mark?: Mark
  markTint?: boolean
  disabled?: boolean
  onPress?: () => void
  className?: string
  style?: StyleProp<ViewStyle>
  children?: ReactNode
  accessibilityLabel?: string
  hitSlop?: number
}) {
  const ref = useMarkedAnswer(mark)
  // The mark is a color and an icon: VoiceOver hears it as words after the control's label.
  const word = useStage().markWord(mark)
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled, checked: selected }}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={word ? { text: word } : undefined}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={() => {
        tap()
        onPress?.()
      }}
      className={cn(
        disabled ? controlSurface : controlStyles,
        selected && selectedStyles,
        className
      )}
      style={[markTint ? markStyle(mark) : undefined, style]}
    >
      {children}
    </Pressable>
  )
}

/**
 * After checking, the mark in the number key's place on an option: a filled square with a check
 * (green) or a cross (yellow). Touch screens show no key hint before that.
 */
export function MarkBadge({
  mark,
  className,
}: {
  mark: Mark | undefined
  className?: string
}) {
  if (!mark) return null
  const good = mark === "correct"
  return (
    <View
      aria-hidden
      className={cn(
        "h-5 w-5 items-center justify-center rounded-sm",
        className
      )}
      style={{
        backgroundColor: good
          ? colors.feedback.goodButton
          : colors.feedback.warn,
      }}
    >
      <Svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke={
          good ? colors.feedback.goodButtonText : colors.feedback.warnText
        }
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {good ? (
          <Path d="M20 6 9 17l-5-5" />
        ) : (
          <Path d="M18 6 6 18M6 6l12 12" />
        )}
      </Svg>
    </View>
  )
}

/**
 * The player's feedback under the answers, as the web's Note: a miss's hint or a scenario's
 * outcome in amber, the explanation in green, and the hint the learner asked for in neutral grey
 * with a lightbulb, with no box around it. One line per paragraph, so worked steps stack.
 */
export function Note({
  tone,
  text,
  className,
}: {
  tone: "good" | "warn" | "neutral"
  text: string
  className?: string
}) {
  const color =
    tone === "good"
      ? colors.feedback.good
      : tone === "warn"
        ? colors.feedback.warn
        : colors.border
  return (
    <View className={cn("flex-row items-start gap-2.5", className)}>
      {tone === "neutral" ? (
        <LightbulbIcon />
      ) : (
        <View
          aria-hidden
          className="mt-0.5 h-4 w-4 items-center justify-center rounded-full"
          style={{ backgroundColor: color }}
        >
          <Svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tone === "good" ? "#ffffff" : colors.feedback.warnText}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {tone === "good" ? (
              <Path d="M20 6 9 17l-5-5" />
            ) : (
              <Path d="M12 7v6M12 17h.01" />
            )}
          </Svg>
        </View>
      )}
      <View className="min-w-0 flex-1 gap-1">
        {text
          .split("\n")
          .filter((line) => line.trim())
          .map((line, i) => (
            <RichText
              key={i}
              text={line}
              className="text-lesson-sm"
              size={CONTROL_TEXT_SIZE}
            />
          ))}
      </View>
    </View>
  )
}

/** Lucide's lightbulb, the hint note's icon. */
function LightbulbIcon() {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.muted.foreground}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginTop: 2 }}
      aria-hidden
    >
      <Path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <Path d="M9 18h6" />
      <Path d="M10 22h4" />
    </Svg>
  )
}

/**
 * A quick sideways shake, as the web gives wrong items after checking (motion.ts), on the UI
 * thread. Still when the system asks for reduced motion.
 */
export function useShake() {
  const x = useSharedValue(0)
  const reduced = useReducedMotion()
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }))
  const shake = () => {
    if (reduced) return
    const step = (to: number) => withTiming(to, { duration: 50 })
    x.value = withSequence(step(-6), step(6), step(-4), step(4), step(0))
  }
  return { style, shake }
}

/**
 * A label over a kata's controls, in the quiet mono of the screen's eyebrow. Not in Arabic or
 * Hebrew: iOS's monospaced face sets every letter apart, which breaks Arabic's joined letters
 * (a browser falls back to a proportional face there, so the web keeps its look).
 */
export function Eyebrow({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  // Hebrew and Arabic letters (and the Syriac and Thaana between them).
  const rtl = /[\u0590-\u08ff]/.test(text)
  return (
    <Text
      className={cn(
        "text-lesson-sm text-muted-foreground",
        !rtl && "font-mono",
        className
      )}
    >
      {text}
    </Text>
  )
}

export { Animated }
