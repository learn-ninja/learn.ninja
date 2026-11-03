import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"

import { FAQ } from "@/lib/faq"

export function Faq() {
  return (
    <section
      id="faq"
      className="mx-auto flex w-full max-w-3xl scroll-mt-20 flex-col gap-10 px-4 py-20 sm:px-6 sm:py-28"
    >
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">FAQ</h2>
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
