import { Boxes, PenLine, Rocket } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DesignSystemPreview } from "@/components/DesignSystemPreview"

const stack = [
  "Vite for instant dev server and fast production builds",
  "React 19 with TypeScript in strict mode",
  "Tailwind CSS v4 driven entirely by semantic tokens",
  "shadcn/ui primitives, already styled to this theme",
] as const

const steps = [
  "Tell the builder what the first screen should do.",
  "Edit copy, swap a token, or add a component to make it yours.",
  "Iterate in place — every change builds and reloads on save.",
] as const

export function Highlights() {
  return (
    <section
      id="whats-ready"
      className="scroll-mt-16 border-t border-border bg-surface px-5 py-16 sm:px-8 sm:py-24"
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="max-w-2xl">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything you need is already in place
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            A fresh project ships with a working stack and a coherent look. You
            are not starting from a blank file — you are starting from a
            foundation you can trust.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Boxes
                  className="size-5 text-primary"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <CardTitle>The stack, wired and verified</CardTitle>
              </div>
              <CardDescription>
                Installed, configured, and building green right now.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {stack.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed">
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Rocket
                  className="size-5 text-accent-foreground"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <CardTitle>Three steps to your first feature</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-4">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <DesignSystemPreview />
          </div>

          <Card className="flex flex-col justify-center lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <PenLine
                  className="size-5 text-primary"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <CardTitle>This page is yours to replace</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                It lives at{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  src/pages/Landing.tsx
                </code>
                . Keep what helps, delete the rest, and let this become the home
                screen your project actually needs.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
