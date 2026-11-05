// From React Native Reusables (https://reactnativereusables.com, MIT), NativeWind flavor, with
// Nova's shape (rounded-lg) as the web's input has it.
import { cn } from "@/lib/utils"
import { Platform, TextInput, type TextInputProps } from "react-native"

import { colors } from "../../../tokens"

function Input({
  className,
  ...props
}: TextInputProps & {
  className?: string
  ref?: React.Ref<React.ComponentRef<typeof TextInput>>
}) {
  return (
    <TextInput
      className={cn(
        "min-h-11 w-full min-w-0 flex-row items-center rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground dark:bg-input/30",
        props.editable === false && "opacity-50",
        Platform.select({ ios: "leading-5" }),
        className
      )}
      placeholderTextColor={colors.muted.foreground}
      {...props}
    />
  )
}

export { Input }
