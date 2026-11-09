import { Link } from "expo-router"
import { useState } from "react"
import { View } from "react-native"

import type { Strings } from "@workspace/player-core/strings"

import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { cachedLessons } from "@/lib/lesson-cache"
import { deviceStorage } from "@/lib/progress-storage"

/**
 * With no connection, the lessons this phone kept (lesson-cache.ts), most recently opened first, to
 * play without learn.ninja: under the offline message on home. Nothing when none are kept.
 */
export function SavedLessons({ t }: { t: Strings }) {
  // Read once as the offline message shows; opening one moves it up next time, not under a finger.
  const [lessons] = useState(() => cachedLessons(deviceStorage))
  if (!lessons.length) return null
  return (
    <View className="gap-3 pb-8">
      <Text className="text-sm font-medium text-muted-foreground">
        {t.onThisPhone}
      </Text>
      {lessons.map((l) => (
        <Link
          key={l.param}
          href={{ pathname: "/l/[slugId]", params: { slugId: l.param } }}
          asChild
        >
          <Button variant="outline" size="lg" className="justify-start">
            <Text numberOfLines={1}>{l.title}</Text>
          </Button>
        </Link>
      ))}
    </View>
  )
}
