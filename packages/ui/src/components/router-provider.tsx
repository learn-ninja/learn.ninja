"use client"

import type * as React from "react"
import { RouterProvider as RouterProviderPrimitive } from "react-aria-components"

/**
 * Tells React Aria's links (Link, LinkButton, a Tab with an href) how to navigate, so the app's
 * router handles the click instead of the browser. Without one, every such link reloads the page.
 */
function RouterProvider(
  props: React.ComponentProps<typeof RouterProviderPrimitive>
) {
  return <RouterProviderPrimitive {...props} />
}

export { RouterProvider }
