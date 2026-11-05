import { router } from "expo-router"
import { memo } from "react"
import { Pressable, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"

import { savedProgress } from "@workspace/player-core/progress"
import { directionOf, type Strings } from "@workspace/player-core/strings"
import { shortTimeAgo, timeAgo } from "@workspace/player-core/time"

import { Avatar } from "@/components/avatar"
import { EyeIcon } from "@/components/icons"
import { Text } from "@/components/ui/text"
import { lessonParam, type LessonRowData, type Viewer } from "@/lib/feed"
import { compact, rowBadge, rowTime, wedge } from "@/lib/lesson-row"
import { deviceStorage } from "@/lib/progress-storage"
import { colors } from "../../../tokens"

import { LikeButton } from "./like-button"

// A lesson as one row of Explore or a profile, as the web's LessonRow draws it on a phone: the
// byline (who made it, and how long ago at the end), the title, two lines of summary, and the meta
// line with the length (or Done, or the minutes left) and level, the views and likes at its end.
// The whole row opens the lesson; the author and the heart are their own targets. Rows sit
// between hairlines (the list draws them).

export const LessonRow = memo(function LessonRow({
  lesson,
  viewer,
  viewerId,
  lang,
  t,
}: {
  lesson: LessonRowData
  viewer: Viewer | undefined
  viewerId: string | undefined
  lang: string
  t: Strings
}) {
  const param = lessonParam(lesson)
  const local = safeProgress(`l/${param}`)
  const time = rowTime(lesson, viewer, local)
  const badge = rowBadge(lesson, viewerId)
  const author = lesson.author
  const now = Date.now()
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/l/[slugId]", params: { slugId: param } })
      }
      className="gap-3 py-5 active:opacity-70"
      accessibilityRole="link"
      accessibilityLabel={lesson.title}
    >
      <View className="flex-row items-center justify-between gap-3">
        {author ? (
          <Pressable
            disabled={!author.handle}
            onPress={() =>
              author.handle &&
              router.push({
                pathname: "/u/[handle]",
                params: { handle: author.handle },
              })
            }
            hitSlop={6}
            className="min-w-0 shrink flex-row items-center gap-1.5"
            accessibilityRole="link"
          >
            <Avatar image={author.image} handle={author.handle} />
            <Text
              numberOfLines={1}
              className="shrink text-sm text-foreground"
              // A handle reads left to right in every language (the web's <bdi dir="ltr">).
              style={{ writingDirection: "ltr" }}
            >
              {author.handle ?? author.name}
            </Text>
          </Pressable>
        ) : (
          <View className="min-w-0 shrink flex-row items-center gap-1.5">
            <Avatar image={null} handle={null} />
            <Text
              numberOfLines={1}
              className="shrink text-sm text-muted-foreground"
            >
              {t.feed.anonymous}
            </Text>
          </View>
        )}
        <Text
          className="shrink-0 text-sm text-muted-foreground"
          accessibilityLabel={timeAgo(lesson.createdAt, now, lang)}
        >
          {shortTimeAgo(lesson.createdAt, now, lang)}
        </Text>
      </View>
      <View className="gap-1">
        <Text
          className="text-base leading-snug font-medium"
          style={{ writingDirection: directionOf(lesson.language) }}
        >
          {lesson.title}
          {badge ? (
            <Text className="text-xs text-muted-foreground">
              {"  "}
              {badge === "hidden" ? t.feed.hidden : t.feed.private}
            </Text>
          ) : null}
        </Text>
        {lesson.summary ? (
          <Text
            numberOfLines={2}
            className="text-sm text-muted-foreground"
            style={{ writingDirection: directionOf(lesson.language) }}
          >
            {lesson.summary}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-x-1.5">
          <RowTimeLabel time={time} t={t} />
          <Text className="text-sm text-muted-foreground/60" aria-hidden>
            ·
          </Text>
          <Text className="text-sm text-muted-foreground">
            {t.levels[lesson.level]}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <View
            className="flex-row items-center gap-1"
            accessible
            accessibilityLabel={t.feed.views(lesson.views)}
          >
            <EyeIcon size={14} color={colors.muted.foreground} />
            <Text className="text-sm text-muted-foreground tabular-nums">
              {compact(lesson.views, lang)}
            </Text>
          </View>
          <LikeButton
            id={lesson.id}
            likes={lesson.likes}
            liked={viewer?.liked.includes(lesson.id) ?? false}
            signedIn={viewer?.signedIn ?? false}
            lang={lang}
            t={t}
          />
        </View>
      </View>
    </Pressable>
  )
})

function safeProgress(key: string) {
  try {
    return savedProgress(deviceStorage, key)
  } catch {
    return null
  }
}

/** Done with a green check, the minutes left beside an amber pie, or the length. */
function RowTimeLabel({
  time,
  t,
}: {
  time: ReturnType<typeof rowTime>
  t: Strings
}) {
  if (time.kind === "length")
    return (
      <Text className="text-sm text-muted-foreground">
        {t.minutes(time.minutes)}
      </Text>
    )
  if (time.kind === "done")
    return (
      <View className="flex-row items-center gap-1">
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill={colors.correct} />
          <Path
            d="m8.5 12 2.5 2.5 4.5-4.5"
            fill="none"
            stroke={colors.background}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text className="text-sm text-muted-foreground">{t.feed.done}</Text>
      </View>
    )
  return (
    <View
      className="flex-row items-center gap-1"
      accessible
      accessibilityLabel={`${t.feed.minutesLeft(time.minutes)}, ${t.feed.katasDone(time.done, time.total)}`}
    >
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Circle
          cx={12}
          cy={12}
          r={8.75}
          fill="none"
          stroke={colors.feedback.partial}
          strokeWidth={2.5}
        />
        <Path d={wedge(time.share)} fill={colors.feedback.partial} />
      </Svg>
      <Text className="text-sm text-muted-foreground">
        {t.feed.minutesLeft(time.minutes)}
      </Text>
    </View>
  )
}
