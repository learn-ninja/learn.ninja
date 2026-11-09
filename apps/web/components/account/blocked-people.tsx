"use client"

import * as React from "react"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"

import { BlockDialog } from "@/components/explore/block-dialog"
import { exploreApi, type ExploreApi } from "@/lib/explore/browser"
import type { BlockedPerson } from "@/lib/explore/queries"
import { relative } from "@/lib/relative-time"

import { SettingsList } from "./settings-section"
import { UserAvatar } from "./user-avatar"

/**
 * "Blocked people": everyone the user blocked from a lesson or a profile, with Unblock, after
 * which their lessons show for the user again.
 */
export function BlockedPeople({
  initial,
  api = exploreApi,
}: {
  initial: BlockedPerson[]
  api?: ExploreApi
}) {
  const [people, setPeople] = React.useState(initial)
  const [unblocking, setUnblocking] = React.useState<BlockedPerson | null>(null)
  // Kept while the dialog closes, so its words don't change as it fades.
  const [last, setLast] = React.useState<BlockedPerson | null>(null)

  if (!people.length)
    return (
      <p className="text-sm text-muted-foreground">
        Nobody. Block someone from their profile or a lesson&apos;s menu, and
        their lessons stop showing for you.
      </p>
    )
  return (
    <>
      <SettingsList>
        {people.map((person) => (
          <Item key={person.id} role="listitem">
            <ItemMedia>
              <UserAvatar
                image={person.image}
                handle={person.handle}
                size="row"
              />
            </ItemMedia>
            <ItemContent className="min-w-0 gap-0.5">
              <ItemTitle>
                {person.handle ? (
                  <Link
                    href={`/u/${person.handle}`}
                    className="hover:underline"
                  >
                    <bdi dir="ltr">{person.handle}</bdi>
                  </Link>
                ) : (
                  person.name
                )}
              </ItemTitle>
              <ItemDescription>
                Blocked {relative(new Date(person.blockedAt).toISOString())}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  setLast(person)
                  setUnblocking(person)
                }}
              >
                Unblock
              </Button>
            </ItemActions>
          </Item>
        ))}
      </SettingsList>
      {last ? (
        <BlockDialog
          person={last}
          unblock
          isOpen={unblocking !== null}
          onOpenChange={(open) => {
            if (!open) setUnblocking(null)
          }}
          onDone={() => setPeople(people.filter((p) => p.id !== last.id))}
          api={api}
        />
      ) : null}
    </>
  )
}
