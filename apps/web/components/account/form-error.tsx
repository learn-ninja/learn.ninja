/** One line of red text under a form, announced when it appears. Renders nothing without a message. */
export function FormError({ children }: { children?: string | null }) {
  return (
    <p role="alert" aria-live="polite" className="text-sm text-destructive">
      {children}
    </p>
  )
}
