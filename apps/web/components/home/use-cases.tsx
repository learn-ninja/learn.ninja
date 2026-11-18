import { USE_CASES } from "@/lib/site"

/**
 * Who it's for, right under the hero: four people and what each would ask their agent. The hero
 * shows how a lesson is made (an agent, a terminal), which on its own reads as a developer tool;
 * these say who makes one and why, in everyday subjects.
 */
export function UseCases() {
  return (
    <section
      aria-labelledby="use-cases-heading"
      className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-20 sm:px-6 sm:py-28"
    >
      <h2
        id="use-cases-heading"
        className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
      >
        Who it&apos;s for
      </h2>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        {USE_CASES.map((useCase) => (
          <li
            key={useCase.title}
            className="flex flex-col gap-4 rounded-xl bg-card p-5 text-card-foreground shadow-xs ring-1 ring-foreground/10"
          >
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-pretty sm:text-lg">
                {useCase.title}
              </h3>
              <p className="text-sm text-pretty text-muted-foreground">
                {useCase.body}
              </p>
            </div>
            {/* What you'd type, as a line in a prompt box. */}
            <p className="mt-auto rounded-lg bg-muted px-3 py-2 font-mono text-sm text-pretty dark:bg-input/30">
              <span aria-hidden className="me-2 text-muted-foreground">
                ❯
              </span>
              {useCase.prompt}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
