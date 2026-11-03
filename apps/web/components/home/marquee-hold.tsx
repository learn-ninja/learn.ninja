"use client"

import { useState } from "react"

// A field of marquee rows that stops while a finger (or the mouse button) is down on it, so a
// card can be read before it's tapped (lesson-cards.css pauses the rows under [data-held]).
// Only the holding is client-side; the cards inside are server-rendered.

export function MarqueeHold({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const [held, setHeld] = useState(false)
  const release = () => setHeld(false)
  return (
    <div
      className={className}
      data-held={held || undefined}
      onPointerDown={() => setHeld(true)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      {children}
    </div>
  )
}
