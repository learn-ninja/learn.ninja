import { UserRoundIcon } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"

/** Where a picture shows, which sets its size: the header's 28px control, the settings form, a profile's heading. */
const SIZES = {
  header: { avatar: "size-7", fallback: "text-xs" },
  settings: { avatar: "size-20", fallback: "text-2xl" },
  profile: { avatar: "size-16 sm:size-20", fallback: "text-xl sm:text-2xl" },
}

/**
 * A person's picture, or their handle's first letter while they have none (a generic figure for a
 * user without a handle). Decorative on its own: the control or heading beside it names the person.
 */
export function UserAvatar({
  image,
  handle,
  size,
  className,
}: {
  image: string | null
  handle: string | null
  size: keyof typeof SIZES
  className?: string
}) {
  return (
    <Avatar className={cn(SIZES[size].avatar, className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback
        className={cn("font-medium uppercase", SIZES[size].fallback)}
      >
        {handle ? (
          handle[0]
        ) : (
          <UserRoundIcon className="size-[55%]" aria-hidden="true" />
        )}
      </AvatarFallback>
    </Avatar>
  )
}
