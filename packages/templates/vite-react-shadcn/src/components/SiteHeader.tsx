import { ArrowUpRight, Hexagon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background/95">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <a
          href="#top"
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          <Hexagon
            className="size-5 text-primary"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <span className="font-heading text-base font-semibold tracking-tight">
            Atelier
          </span>
        </a>

        <nav aria-label="Primary">
          <Button asChild variant="ghost" size="sm">
            <a href="#whats-ready">
              What is ready
              <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        </nav>
      </div>
    </header>
  )
}
