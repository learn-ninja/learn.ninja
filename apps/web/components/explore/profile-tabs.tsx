"use client"

import * as React from "react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

/**
 * A profile's tabs: the lessons they made and the lessons they liked, each with a count. The panels
 * are rendered on the server and passed in.
 */
export function ProfileTabs({
  lessons,
  likes,
}: {
  lessons: { count: number; panel: React.ReactNode }
  likes: { count: number; panel: React.ReactNode }
}) {
  return (
    <Tabs className="gap-6">
      <TabsList variant="line" aria-label="Profile" className="-ms-1.5">
        <TabsTrigger id="lessons">
          Lessons
          <Count n={lessons.count} />
        </TabsTrigger>
        <TabsTrigger id="likes">
          Likes
          <Count n={likes.count} />
        </TabsTrigger>
      </TabsList>
      <TabsContent id="lessons" className="flex flex-col gap-8">
        {lessons.panel}
      </TabsContent>
      <TabsContent id="likes" className="flex flex-col gap-8">
        {likes.panel}
      </TabsContent>
    </Tabs>
  )
}

function Count({ n }: { n: number }) {
  return <span className="text-muted-foreground tabular-nums">{n}</span>
}
