import { Separator } from "@workspace/ui/components/separator"

/** The line between the home page's sections, as wide as the page's column. */
export function SectionDivider() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <Separator />
    </div>
  )
}
