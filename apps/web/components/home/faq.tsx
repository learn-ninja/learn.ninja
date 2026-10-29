import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Separator } from "@workspace/ui/components/separator"

import { FAQ } from "@/lib/faq"

export function Faq() {
  return (
    <section
      id="faq"
      className="mx-auto flex w-full max-w-3xl scroll-mt-20 flex-col gap-20 px-4 pb-20 sm:gap-28 sm:px-6 sm:pb-28"
    >
      <Separator />
      <div className="flex flex-col gap-10">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          FAQ
        </h2>
        <Accordion>
          {FAQ.map(({ q, a }) => (
            <AccordionItem key={q} id={q}>
              <AccordionTrigger className="text-base">{q}</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                <p>{renderCode(a)}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

/** Shows `backticked` text as code. */
function renderCode(text: string) {
  return text.split(/`([^`]+)`/).map((part, i) =>
    i % 2 ? (
      <code
        key={i}
        className="rounded-sm bg-muted px-1 py-0.5 font-mono text-sm"
      >
        {part}
      </code>
    ) : (
      part
    )
  )
}
