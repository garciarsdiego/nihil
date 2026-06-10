# vite-react-shadcn

The default Nihil web template: a production-ready single-page app you can start
editing immediately. The landing page demonstrates the design system; replace it
with your own screens.

## Stack

- **Vite** — dev server with HMR and an optimized production build.
- **React 19** + **TypeScript** (strict).
- **Tailwind CSS v4** — configured in CSS (`src/index.css`); no `tailwind.config`.
- **shadcn/ui** — accessible component primitives in `src/components/ui/`,
  driven by semantic design tokens (see below). Icons via `lucide-react`.
- Path alias `@/` → `src/` (Vite + TypeScript `paths`).

Dependencies are intentionally minimal — no router, no state library. Add them
when a screen actually needs them.

## Structure

```
src/
  components/        feature/section components (e.g. the landing sections)
  components/ui/     shadcn/ui primitives (button, card, …)
  pages/             page-level compositions
  lib/               utilities (cn() class merge)
  index.css          Tailwind v4 import + the semantic design tokens
  App.tsx            renders the current page
  main.tsx           React entry point
```

## Design tokens

Colors are semantic CSS custom properties defined for light (`:root`) and dark
(`.dark`) in `src/index.css`, mapped into Tailwind via `@theme inline`. Use the
role utilities (`bg-background`, `text-foreground`, `bg-card`, `bg-primary`,
`text-primary-foreground`, `bg-muted`, `border-border`, …) rather than raw color
values. Dark mode is class-based: add `.dark` to `<html>`.

## Workflows

Nihil runs these named workflows from `nihil.config.json` (never raw shell):

| Workflow | Command | Notes |
|---|---|---|
| `dev` | `npm run dev -- --port ${PORT} --strictPort --host 127.0.0.1` | Long-running dev server bound to IPv4 loopback (the daemon preview proxy reaches it at 127.0.0.1); Nihil assigns the port. |
| `build` | `npm run build` | `tsc -b && vite build` → `dist/`. |
| `lint` | `npm run lint` | ESLint across the project. |

Run them locally with `npm run dev` / `npm run build` / `npm run lint` after
`npm install`.
