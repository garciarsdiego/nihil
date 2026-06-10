import { ArrowRight, BookOpen } from "lucide-react"

import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
      <div className="mx-auto w-full max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
          <span
            className="size-1.5 rounded-full bg-primary"
            aria-hidden="true"
          />
          Your project is live and ready to edit
        </p>

        <h1 className="mt-6 font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          A blank canvas that already knows how to build.
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          This is the starting point for your new app. The toolchain, the
          component library, and a considered design system are wired up and
          waiting. Describe the first screen you want, and shape it from here.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg">
            <a href="#whats-ready">
              Start building
              <ArrowRight aria-hidden="true" />
            </a>
          </Button>

          <Button asChild size="lg" variant="outline">
            <a href="#design-system">
              <BookOpen aria-hidden="true" />
              Explore the design system
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
