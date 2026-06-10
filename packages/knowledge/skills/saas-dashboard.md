Use this skill when the user asks for a SaaS dashboard, admin panel, analytics view, or any data-dense internal tool with navigation, tables, charts, and status-driven workflows. It also applies when the user requests user settings panels, billing views, or team-management screens that share the same two-column shell pattern.

## Page / feature structure

Build every dashboard as a two-column shell on `lg` viewports and a single-column stack below. Compose the view in this order.

1. **App shell** — `src/components/AppShell.tsx` with a collapsible sidebar (`w-64`) and a main content area that fills the remaining width. Use CSS Grid for the shell, not nested flex boxes. The shell itself must not scroll; only the main content area scrolls.
2. **Sidebar navigation** — group links into named sections such as Overview, Projects, Settings, and Billing. Use the template's `Collapsible` or `Accordion` primitives for groups. Include a bottom user card with avatar initials and a logout action. Mark the active route with a `primary` token background or a left border indicator. Never create a flat list of identical-weight links.
3. **Top bar** — `src/components/TopBar.tsx` containing a mobile menu trigger, a global search input, and a notification bell icon. Keep it sticky with `z-50` and a `surface` token background. Add a bottom border using the `border` token to separate it from scrolling content. The top bar height must remain fixed so the shell grid stays stable.
4. **Stat row** — `src/components/StatCards.tsx` displaying 3–4 key metrics as `Card` components in a grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`). Show trend indicators with `Badge` variants; never rely on raw color alone to signal positive or negative change. Keep card interiors uniform with `p-6` padding, label above value.
5. **Filter bar** — `src/components/FilterBar.tsx` placed between the stat row and the data surface. Include a search field, a date picker or dropdown, and a primary action button. Keep filters left-aligned and actions right-aligned. Use `gap-4` between controls and wrap them on mobile.
6. **Primary data surface** — a `Card`-wrapped table, chart, or list that occupies the main content width. Use `src/components/DataTable.tsx` for tabular data and `src/components/ChartCard.tsx` for visualizations. Tables must support horizontal scroll inside the card on small screens, never overflow the viewport.
7. **Empty state** — `src/components/EmptyState.tsx` with a headline, one-sentence explanation, and a primary action button. Render this as the default view; do not begin with mocked ideal data. Use a simple icon inside a muted circle rather than decorative SVG blobs or animated illustrations.
8. **Loading skeleton** — `src/components/DashboardSkeleton.tsx` that mirrors the stat row and table shape with animated pulse blocks. Match the exact number of stat cards and table rows so the transition causes zero layout shift.
9. **Error boundary** — `src/components/ErrorFallback.tsx` inside the main area with a retry button and a link to support. Keep the error message in sentence case, explain what failed, and offer a single clear recovery action. Never dump raw error objects into the UI.
10. **Detail drawer** — `src/components/DetailDrawer.tsx` for viewing or editing a selected row without leaving the page. Use the template's `Sheet` or `Dialog` primitive. Keep the drawer width at `max-w-lg` and trap focus inside while open.
11. **Breadcrumb bar** — `src/components/BreadcrumbBar.tsx` placed below the top bar on nested views. Use the template's `Breadcrumb` primitive with `ol` and `li` elements. Keep the current page as plain text, not a link.
12. **Batch action bar** — `src/components/BatchActionBar.tsx` that appears when one or more table rows are selected. Anchor it to the bottom of the data card with `sticky` positioning. Offer 2–3 context actions such as "Delete selected" or "Export selected".

## Step-by-step build order

1. Scaffold the app shell in `src/components/AppShell.tsx` using a single CSS Grid with `grid-cols-[16rem_1fr]`. Hide the sidebar off-canvas on viewports below `1024px` and toggle it with a hamburger button. Use `transform translate-x-0` transitions, not layout-triggering margin changes. On mobile, the sidebar should render as a full-height drawer with a backdrop overlay, not a permanently visible narrow column.
2. Build the sidebar in `src/components/Sidebar.tsx`. Map navigation items from a typed array defined in `src/lib/nav.ts`. Group items into collapsible sections with semantic `nav` and `ul` elements. Add a skip-link target as the first focusable element in the document. Ensure the active section auto-expands on page load so the user never lands with their location hidden.
3. Build the top bar in `src/components/TopBar.tsx`. Include a `SearchInput` with `aria-label="Search dashboard"`, a notification icon button with an `aria-label`, and the mobile menu trigger. Keep the top bar height fixed so the shell grid remains stable.
4. Create `src/components/EmptyState.tsx` first. Accept `title`, `description`, and `actionLabel` props. Style it centered inside the main area with `text-center` and a subdued `surface` background. Do not add decorative SVG blobs or animated illustrations. The empty state must be the first component rendered in the primary data surface, not a conditional branch added later.
5. Create `src/components/DashboardSkeleton.tsx`. Match the exact layout grid of the stat row and table so the transition from skeleton to content causes zero layout shift. Use rounded rectangles for stat cards and rows for table placeholders.
6. Create `src/components/StatCards.tsx`. Accept a `stats` prop array. Render each metric inside a `Card` with `p-6` padding. Use `text-2xl font-semibold` for values and `text-sm text-muted-foreground` for labels. Never bold the label and regular-weight the value. If a stat is a currency, include the symbol and format it with the user's locale.
7. Build `src/components/FilterBar.tsx` with a search input, category dropdown, and a primary action. Use `gap-4` between controls and wrap them on mobile. Keep the bar inside the same `Card` as the table or directly above it.
8. Build `src/components/DataTable.tsx` by extending the template's `Table` primitives. Include sortable headers, a `Checkbox` for row selection, and a `Badge` for status columns. Implement the five async states explicitly: render the skeleton for loading, the empty state for no rows, the error fallback for failures, partial rows for stale data, and the full table for the ideal state. Keep row height consistent across all five states to prevent vertical layout shift.
9. Add pagination or infinite scroll controls in `src/components/TablePagination.tsx`. Use the template's `Button` variants for previous and next actions. Show the current range and total count in muted text between the buttons.
10. Build `src/components/ChartCard.tsx` only if the user explicitly requests a chart. Wrap it in a `Card` with a `CardHeader` for the title and a `CardContent` with a fixed `aspect-video` container. Respect `prefers-reduced-motion` on any animated chart elements.
11. Build `src/components/DetailDrawer.tsx` using the template's `Sheet` primitive. Accept a `record` prop and render read-only fields first, then editable fields if the user requests an edit mode. Restore focus to the triggering row when the drawer closes.
12. Wire the dashboard page in `src/pages/Dashboard.tsx`. Compose the shell, top bar, stat row, filter bar, and primary data surface. Fetch data in a `useEffect` or via the project's chosen state layer; keep async logic separate from presentational components.
13. Add `src/components/ErrorFallback.tsx` with a human-readable message, a "Try again" button, and an optional "Contact support" link. Log the raw error to the console, never to the UI.
14. Verify responsive behavior at every breakpoint. Collapse the grid to a single column on `md` and below. Ensure every interactive element is at least `44px` square on touch devices. Test the sidebar toggle, search input, and table row actions on a narrow viewport.
15. Run automated contrast checks on the sidebar text against its background, the table row text against the card surface, and focus rings against both. Verify that `primary` and `accent` tokens do not collide on the same surface.
16. Add keyboard shortcuts for power users: `Esc` to close the sidebar drawer, `Enter` to activate the focused row, and arrow keys to navigate the sidebar groups. Document these in a `src/lib/keyboard.ts` utility.
17. Create `src/hooks/useDashboardData.ts` to encapsulate fetching, caching, and error handling. Return `{ data, isLoading, isError, refetch }` so presentational components remain pure.
18. Audit the finished dashboard for excessive re-renders. Memoize the stat row and table body with `useMemo` or `React.memo` if the parent re-renders frequently on filter changes.
19. Build `src/components/BreadcrumbBar.tsx` for nested routes. Accept a `crumbs` array with `label` and `href` fields. Omit the `href` on the final item so it renders as plain text.
20. Build `src/components/BatchActionBar.tsx` with a `selectedCount` prop. Show it only when count is greater than zero, anchored to the bottom of the table card. Include a "Clear selection" secondary action.
21. Document the dashboard's information architecture in a short comment block at the top of `src/lib/nav.ts` so future edits preserve the grouping logic.
22. Add a `src/components/MobileNav.tsx` component that renders a simplified bottom tab bar on viewports below `640px` if the sidebar drawer feels too heavy for the task count. Limit it to four tabs maximum.
23. Finalize by testing keyboard navigation end-to-end: tab from the skip link through the sidebar, top bar, filters, table, and pagination without losing focus visibility.
24. Ship only after verifying that no arbitrary Tailwind values such as `bg-[#3b82f6]` or `p-[13px]` appear in the dashboard code. All visual decisions must route through the project's semantic token system.

## Quality bar

- Navigation must reflect real information architecture: grouped, labeled sections with active-state indicators, not a flat list of identical links.
- Every data-bound region must handle all five async states explicitly, with the empty state built before any ideal-state mock data is added.
- Tables must use semantic `table`, `th`, and `td` elements, not CSS Grid layouts masquerading as tables.
- Stat values must use realistic numbers and units; never invent vanity metrics like "10,000+ users" without a data source.
- The layout must remain stable across state transitions: skeleton blocks and final content must share the same bounding boxes to prevent shift.
- Touch targets on mobile must meet the `44px` minimum; sidebar items and table rows must not shrink below this threshold.
- Dark mode must map every surface, border, and muted text token to an intentional dark value, never a global inversion.
- Focus order must follow the visual layout; trap focus inside modals and restore it to the trigger on close.
- Spacing must follow the project's fixed scale; do not insert arbitrary margin or padding values between dashboard sections.
- Typography must remain consistent: use the project's type scale for labels, values, and headings; never introduce arbitrary font sizes for dashboard-specific elements.
- Motion must be restrained: animate at most one element per viewport entry, keep transitions under 200ms, and respect `prefers-reduced-motion`.
- Color must be used intentionally: reserve the `primary` token for the most important action per view, and never fill an entire dashboard card with a saturated hue.
- Icons must be functional, not decorative: every icon needs a text label or `aria-label`; never use emoji as a substitute for the template's icon system.
- Copy must be specific: button labels should name the outcome ("Export CSV"), not the mechanism ("Submit"); error messages should explain the cause and the fix.
- Max-width containers must cap the content area at `1280px` or `1440px` centered with auto margins so dashboards do not stretch uncomfortably wide on 4K monitors.
- Scroll behavior must be isolated: the sidebar and top bar remain fixed while only the main content area scrolls, preventing chrome from jumping during data loads.
- Badge and status indicators must pair color with shape or text: a red badge alone is not enough; add labels like "Failed" or "Overdue" so meaning survives grayscale viewing.
- Form inputs inside drawers must use the template's existing `Input`, `Select`, and `Textarea` components with associated `label` elements, never unlabeled placeholders.
- Batch actions must be destructive only when explicitly confirmed; never allow a one-click bulk delete without a confirmation dialog that restates the number of affected items.
- Pagination must preserve filter and sort state across page transitions so the user does not lose context when navigating through large datasets.
- Avatar initials must be generated from realistic names, not generic labels like "User A"; use a consistent algorithm that produces the same initials for the same name on every render.
- Date and time formats must match the user's locale and use full ISO strings internally, rendering localized output only at display time.

## Five common mistakes

1. **Building the ideal state first and tacking on empty states later.** Always implement the empty state, loading skeleton, and error fallback before rendering any mocked data. The empty state is the default view, not an afterthought.
2. **Using a flat sidebar with five identical links and a user card.** Group links into collapsible sections, vary spacing by hierarchy, and reflect the actual product structure. A flat list wastes space and hides relationships.
3. **Replacing semantic tables with styled div grids.** Tabular data demands `table` markup for screen readers and keyboard navigation; use `Table`, `Thead`, `Tbody`, `Tr`, `Th`, and `Td`. Grid-based fakes break screen-reader table modes.
4. **Center-aligning dashboards or stretching tables to full viewport width.** Left-align data surfaces, cap the content area with a max-width wrapper, and constrain table columns so text does not exceed readable line lengths. Data is scanned, not read like prose.
5. **Inventing fake metrics or duplicate placeholder rows.** Use varied, domain-appropriate values for every stat and table cell; repeating the same name or number across rows signals generated slop. If you lack data, show the empty state.
