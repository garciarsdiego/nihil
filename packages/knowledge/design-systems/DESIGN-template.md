# DESIGN.md — Per-Project Design Contract Template

Use this template to lock the design rules for a single Nihil project before any component work begins. Copy it into the project root as `DESIGN.md`, fill every section, and treat late changes as breaking architectural revisions.

---

## 1. Palette Tokens

### Template
- Background:
- Surface:
- Primary:
- Accent:
- Text (main):
- Text (muted):
- Border:
- Error:
- Success:

Dark-mode values must be listed alongside light-mode values for every token. Every pair must meet WCAG AA contrast.

### Worked Example: Meridian (Team Scheduling)

| Token | Light | Dark |
|---|---|---|
| Background | `#f8f9fb` | `#0b0d10` |
| Surface | `#ffffff` | `#14161b` |
| Primary | `#2563eb` | `#3b82f6` |
| Accent | `#d97706` | `#f59e0b` |
| Text (main) | `#111827` | `#f3f4f6` |
| Text (muted) | `#6b7280` | `#9ca3af` |
| Border | `#e5e7eb` | `#272b33` |
| Error | `#dc2626` | `#ef4444` |
| Success | `#059669` | `#10b981` |

Roles: Primary drives actions (buttons, links). Accent highlights urgent shifts and warnings. Text muted is used for metadata and secondary labels.

---

## 2. Type Scale

### Template
- Font families (max 2):
- Base size:
- Scale ratio:
- Sizes:
  - Display:
  - H1:
  - H2:
  - H3:
  - Body:
  - Caption:
- Weights per role:
  - Headings:
  - Body:
  - Labels:
- Line heights:
  - Headings:
  - Body:
  - Captions:

### Worked Example: Meridian

- Font families: Inter (body + headings), JetBrains Mono (timestamps + code).
- Base size: 16px.
- Scale ratio: 1.25.
- Sizes: Display 3.815rem, H1 3.052rem, H2 2.441rem, H3 1.953rem, Body 1rem, Caption 0.8rem.
- Weights: Headings 600, Body 400, Labels 500.
- Line heights: Headings 1.3, Body 1.5, Captions 1.7.

All sizes use rem units. Uppercase is reserved for captions and badges only, with 0.05em letter-spacing.

---

## 3. Spacing

### Template
- Spacing scale (list increments):
- Global max-width:
- Reading-width cap:
- Section separation:
- Card internal padding:
- Touch target minimum:
- Breakpoints:
  - Small:
  - Medium:
  - Large:
  - Extra-large:

### Worked Example: Meridian

- Scale: 0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px.
- Global max-width: 1280px.
- Reading-width cap: 65ch (~640px).
- Section separation: 96px between major sections, 48px between related blocks.
- Card internal padding: 24px.
- Touch target minimum: 44 x 44 px.
- Breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px.

---

## 4. Component Inventory

### Template
List every component the project uses, noting whether it comes from the template's shadcn/ui set, extends an existing primitive, or is custom.

| Component | Source | Variant Notes |
|---|---|---|

### Worked Example: Meridian

| Component | Source | Variant Notes |
|---|---|---|
| Button | shadcn/ui | default, outline, ghost, danger |
| Card | shadcn/ui | default, flat (no shadow) |
| Input | shadcn/ui | default, with inline icon |
| Badge | shadcn/ui | default, warning, error |
| Table | shadcn/ui | default, with sticky header |
| Sheet | shadcn/ui | used for mobile sidebar |
| ShiftCard | Custom | extends Card; shows time range, assignee, status |
| EmptyState | Custom | accepts title, description, actionLabel |
| OfflineBanner | Custom | fixed bar above bottom nav |

Rule: no new custom component may be added unless a variant of an existing inventory item cannot serve the need.

---

## 5. Voice & Tone

### Template
- Voice summary (one sentence):
- Tone by context:
  - Success:
  - Error:
  - Onboarding:
  - Empty state:
- Terminology glossary (domain-specific words and their canonical forms):

### Worked Example: Meridian

- Voice: Direct, calm, and precise — like a capable shift supervisor who never panics.
- Tone:
  - Success: Brief and warm. "Shift published."
  - Error: Plain and helpful. "We couldn't save the shift. Check your connection and try again."
  - Onboarding: Encouraging but not casual. "Add your first team to start scheduling."
  - Empty state: Educational. "No shifts this week. Create a shift to see it on the calendar."
- Terminology:
  - Shift (not "slot" or "block")
  - Coverage (not "staffing")
  - Publish (not "finalize")
  - Unassigned (not "open")

---

## Sign-off

Lock this document at the start of component development. Changes after that point require an explicit design review and updates to every token reference in the codebase.
