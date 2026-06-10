import { Hero } from "@/components/Hero"
import { Highlights } from "@/components/Highlights"
import { SiteFooter } from "@/components/SiteFooter"
import { SiteHeader } from "@/components/SiteHeader"

export function Landing() {
  return (
    <div id="top" className="flex min-h-svh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Highlights />
      </main>
      <SiteFooter />
    </div>
  )
}
