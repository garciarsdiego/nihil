Enforce a predictable spatial system, mobile-first breakpoints, and deliberate layout choices so every screen feels composed rather than crowded.

## Spacing Scale
1. Use a fixed spacing scale built on 4 px increments: 0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
2. Never invent arbitrary gap, margin, or padding values that fall outside the scale.
3. Apply the scale to every spatial property: padding, margins, gaps, inset shadows, and component internal offsets.
4. Choose larger increments to separate distinct sections; use smaller increments for related sibling elements.
5. Always document the scale in the design tokens so spacing remains programmatically enforceable.
6. Use fluid spacing between fixed scale steps only through clamp() or relative units; never hard-code intermediate pixel values.
7. Maintain consistent density within a single view; do not mix airy marketing spacing with cramped data spacing without a clear transition.
8. Never use spacing as the sole indicator of grouping; pair it with alignment or proximity so the hierarchy is unmistakable.

## Whitespace
9. Default to more whitespace rather than less; crowding signals low confidence and poor hierarchy.
10. Establish vertical rhythm by repeating the same spacing values between sections and sibling blocks.
11. Never let text or interactive elements touch the edge of a viewport, card, or modal; provide at least one spacing unit of padding.
12. Separate unrelated content groups with larger spacing increments instead of relying solely on borders or dividers.
13. Use padding to create breathable interior space; use margins to create separation between external siblings.
14. Avoid negative margins or magic numbers to fix visual alignment; solve the root layout cause instead.
15. Use asymmetric whitespace intentionally for emphasis; never leave uneven gaps by accident.
16. Use min-height for section vertical sizing rather than fixed heights that break when content reflows.

## Container Widths
17. Cap reading-width containers at a maximum of 65 characters per line or roughly 640 px for body text.
18. Use a global max-width wrapper of 1280 px or 1440 px for overall page bounds, centered with auto margins.
19. Never stretch paragraphs, forms, data tables, or input fields to full width on large screens without an inner constraint.
20. Always align nested containers to the same center axis to avoid visual drift across breakpoints.
21. Reserve full-bleed backgrounds for visual impact, but keep the content layer inside the bounded container.
22. Keep sidebar and panel widths on a sub-scale of the main spacing system when possible.
23. Center containers horizontally with auto margins rather than absolute positioning tricks.
24. Avoid nested max-width containers that fight each other; let one outer wrapper own the boundary.

## Grid vs. Flex
25. Use Flexbox for one-dimensional alignment: navigation bars, button rows, vertical stacks, and simple centering.
26. Use CSS Grid for two-dimensional layouts: dashboards, card galleries, page skeletons, and complex asymmetrical compositions.
27. Never nest deep flex hierarchies when a flat grid template achieves the same result in fewer elements.
28. Prefer gap over margin-based distribution in both flex and grid contexts to avoid collapsing edge cases.
29. Always let grid columns collapse into a single column or auto-fit pattern rather than forcing horizontal scroll on narrow viewports.
30. Define grid templates in template areas when the layout has named regions; use line-based placement sparingly.
31. When a component is reused in multiple contexts, wrap it in a layout container rather than adding responsive logic inside the component itself.
32. Avoid mixing grid and flex in the same hierarchy when one method alone can own the layout.

## Responsive Breakpoints
33. Design mobile-first: start with the smallest supported viewport and add complexity only as available space expands.
34. Use a minimal breakpoint set: small (640 px), medium (768 px), large (1024 px), extra-large (1280 px).
35. Never define custom intermediate breakpoints between these four values; they create maintenance debt and inconsistent behavior.
36. Change layout structure at breakpoints, not just typography sizing; reflow multi-column grids into single-column stacks when necessary.
37. Always test touch targets at the base breakpoint: every interactive element must be at least 44 x 44 px.
38. Preserve readable line lengths at every breakpoint by adjusting container padding, font size, or column count.
39. Hide content only as a last resort; prefer reordering or restacking to maintain feature parity across devices.
40. Never disable zoom or user scaling through restrictive viewport meta tags.
41. Use relative units for breakpoint-bound padding so gutters scale with the viewport rather than snapping at thresholds.
42. Document the intended stacking order for every breakpoint so the responsive behavior is inspectable in code review.

## Reject if
- The design uses random margin or padding values that do not belong to the spacing scale.
- Layouts are authored desktop-first and simply shrink or zoom for mobile.
- Text blocks span the full viewport width on large screens without a max-width or character cap.
- Grid and flex are chosen arbitrarily rather than by dimensional intent—flex for rows/columns, grid for matrices.
- Touch targets fall below 44 x 44 px at the base mobile breakpoint.
