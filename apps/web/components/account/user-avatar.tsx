import { UserRoundIcon } from "lucide-react"
import { getImageProps } from "next/image"

import { LearnLogo } from "@workspace/player/logo"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"

/** Where a picture shows, which sets its size: a feed row's 20px author, the header's 28px control, the settings form, a profile's 24px heading, the mission page's signature and wall. */
const SIZES = {
  signature: { avatar: "size-12", fallback: "text-base", px: 48 },
  wall: { avatar: "size-10", fallback: "text-sm", px: 40 },
  row: { avatar: "size-5", fallback: "text-xs", px: 20 },
  header: { avatar: "size-7", fallback: "text-xs", px: 28 },
  settings: { avatar: "size-20", fallback: "text-2xl", px: 80 },
  profile: { avatar: "size-6", fallback: "text-xs", px: 24 },
}

/**
 * An off-site picture (a GitHub profile picture) goes through Next's image optimizer, so it loads
 * from our own origin: a page reached client-side from a lesson keeps the lesson's CSP, which
 * blocks off-site images. Uploads and previews are already ours.
 */
function pictureProps(image: string, px: number) {
  if (!image.startsWith("https://")) return { src: image }
  const { props } = getImageProps({
    src: image,
    alt: "",
    width: px,
    height: px,
  })
  return { src: props.src, srcSet: props.srcSet }
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
      {image ? (
        <AvatarImage
          key={image}
          {...pictureProps(image, SIZES[size].px)}
          alt=""
        />
      ) : null}
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

/** The ninja in a person's place, for a lesson nobody has kept yet. Decorative, like UserAvatar. */
export function AnonymousAvatar({
  size,
  className,
}: {
  size: keyof typeof SIZES
  className?: string
}) {
  return (
    <Avatar className={cn(SIZES[size].avatar, className)}>
      <AvatarFallback>
        <LearnLogo className="size-[70%]" />
      </AvatarFallback>
    </Avatar>
  )
}
