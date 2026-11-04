"use client"

import { useSyncExternalStore } from "react"

import type { SetupId } from "@/lib/site"

const DEFAULT_SETUP: SetupId = "cli"

// A store rather than page state: the toggle sits in the header, outside the page's sections, and they follow it.
let current = DEFAULT_SETUP as SetupId
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setSetup(setup: SetupId) {
  current = setup
  listeners.forEach((listener) => listener())
}

/** The CLI or MCP choice, shared by the toggle and everything on the home page that follows it. */
export function useSetup() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_SETUP
  )
}
