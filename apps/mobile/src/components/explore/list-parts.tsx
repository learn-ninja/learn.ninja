import { View } from "react-native"

import { Text } from "@/components/ui/text"

/** The hairline between two rows of a lesson list. */
export function Hairline() {
  return <View className="h-px bg-border" />
}

/** An empty list's dashed box, as the web's Explore and profiles draw it. */
export function Empty({ children }: { children: string }) {
  return (
    <View className="mt-4 rounded-xl border border-dashed border-border p-8">
      <Text className="text-center text-sm text-muted-foreground">
        {children}
      </Text>
    </View>
  )
}
