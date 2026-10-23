"use client"

import * as React from "react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

/**
 * A profile's tabs: the lessons they made and the lessons they liked, each with a count. They sit
 * in one box with the year of activity, as Agendolo's week band sits over its chips: the activity
 * on a card at the top, the tabs in a muted strip under it, and the open tab's panel below the
 * box. The activity and panels are rendered on the server and passed in.
 */
export function ProfileTabs({
  activity,
  lessons,
  likes,
}: {
  activity: React.ReactNode
  lessons: { label: string; count: number; panel: React.ReactNode }
  likes: { count: number; panel: React.ReactNode }
}) {
  return (
    <Tabs className="gap-8">
      <div className="rounded-xl border bg-muted">
        <section
          aria-label="Activity"
          className="-m-px rounded-xl border bg-card px-3 py-5 sm:px-4"
        >
          {activity}
        </section>
        <div className="p-3 sm:px-4">
          <TabsList aria-label="Profile">
            <TabsTrigger id="lessons">
              {lessons.label}
              <Count n={lessons.count} />
            </TabsTrigger>
            <TabsTrigger id="likes">
              Likes
              <Count n={likes.count} />
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
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
