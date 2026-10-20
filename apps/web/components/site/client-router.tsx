"use client"

import { useRouter } from "next/navigation"

import { RouterProvider } from "@workspace/ui/components/router-provider"

/**
 * Sends React Aria's links ("Sign in to like", the footer's LinkButtons) through
 * Next's router. React Aria only intercepts same-origin clicks without modifier keys, so links to
 * other sites and cmd-clicks still behave as the browser's own.
 */
export function ClientRouter({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      {children}
    </RouterProvider>
  )
}
