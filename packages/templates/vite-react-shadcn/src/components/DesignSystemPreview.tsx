import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const roles = [
  { name: "Primary", token: "bg-primary", description: "Key actions" },
  { name: "Surface", token: "bg-surface", description: "Raised panels" },
  { name: "Accent", token: "bg-accent", description: "One highlight" },
  { name: "Muted", token: "bg-muted", description: "Quiet fills" },
] as const

export function DesignSystemPreview() {
  return (
    <Card id="design-system" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>A design system, not just defaults</CardTitle>
        <CardDescription>
          Colors, type, and components share one set of semantic tokens, so the
          first thing you ship already looks deliberate in light and dark mode.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Color roles
          </h3>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {roles.map((role) => (
              <li key={role.name} className="flex flex-col gap-2">
                <span
                  className={`h-12 w-full rounded-md border border-border ${role.token}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">{role.name}</span>
                <span className="text-xs text-muted-foreground">
                  {role.description}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Type and components
          </h3>
          <div className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
            <p className="font-heading text-2xl font-semibold tracking-tight">
              Heading set in weight, not noise
            </p>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              Body copy holds a comfortable measure and a 4.5:1 contrast floor.
              Buttons carry the same focus ring and pressed feedback everywhere
              they appear.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm">Save changes</Button>
              <Button size="sm" variant="secondary">
                Preview
              </Button>
              <Button size="sm" variant="ghost">
                Discard
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
