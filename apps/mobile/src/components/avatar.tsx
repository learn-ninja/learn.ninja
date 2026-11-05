import { Image } from "expo-image"
import { View } from "react-native"

import { Text } from "@/components/ui/text"
import { API_BASE_URL } from "@/lib/config"
import { cn } from "@/lib/utils"

// A person's picture, as the web's UserAvatar draws it: round, or their handle's first letter on
// the muted fill when they have none. Pictures we host come as site paths.

export function Avatar({
  image,
  handle,
  size = 20,
  className,
}: {
  image: string | null
  handle: string | null
  size?: number
  className?: string
}) {
  const uri = image?.startsWith("/") ? `${API_BASE_URL}${image}` : image
  return (
    <View
      className={cn(
        "items-center justify-center overflow-hidden rounded-full bg-muted",
        className
      )}
      style={{ width: size, height: size }}
      accessible={false}
    >
      {uri ? (
        // Cached across the feed's rows and launches, faded in as it arrives.
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : (
        <Text
          className="font-medium text-muted-foreground uppercase"
          style={{ fontSize: size * 0.5, lineHeight: size }}
        >
          {handle?.[0] ?? "?"}
        </Text>
      )}
    </View>
  )
}
