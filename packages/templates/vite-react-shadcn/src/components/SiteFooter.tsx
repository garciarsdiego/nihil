import { Hexagon } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-2">
          <Hexagon
            className="size-4 text-primary"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <span className="text-sm text-muted-foreground">
            Built with Vite, React, and shadcn/ui.
          </span>
        </div>

        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <li>
              <a
                href="#whats-ready"
                className="rounded-md text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring"
              >
                What is ready
              </a>
            </li>
            <li>
              <a
                href="#design-system"
                className="rounded-md text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring"
              >
                Design system
              </a>
            </li>
            <li>
              <a
                href="#top"
                className="rounded-md text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring"
              >
                Back to top
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
