Check every generated design for the visual clichés that make AI output instantly recognizable.

## Color & Effects

1. Never apply gradients to more than one hero element per page. If the background uses a gradient, keep every card, sidebar, and footer flat and solid.
2. Never use background blur or glassmorphism on static content cards. Reserve translucency exclusively for modal overlays, dropdown menus, and tooltips.
3. Never pair a purple-to-blue gradient with white text and rounded pill buttons. That specific combination is a known generated signature; shift the hue or simplify the button shape.
4. Never add drop shadows to elements that do not lift off the page, and never tint hero backgrounds with neon accent colors. Use shadows only for dialogs and floating buttons; keep the palette neutral and reserve the accent color for one primary action.

## Layout & Composition

5. Never center-align every block on a page. Left-align body copy, forms, and dashboards; reserve centering for single-statement heroes and short calls to action.
6. Never build a hero taller than 85vh unless there is substantial below-the-fold content that justifies the scroll. Keep the first meaningful action visible immediately.
7. Never stack more than three identical cards in a row without varying height, image crop, or text length. Break symmetry with real content density and asymmetric gutters.
8. Never place decorative SVG blobs, waves, or orbs behind content. If the background needs texture, use a single subtle dot grid or keep it a flat solid.
9. Never pin a sticky banner, a cookie notice, and a top navigation bar simultaneously. Limit fixed chrome to one layer so the viewport does not shrink into a letterbox.

## Typography

10. Never set headings in all-caps with extra letter-spacing as the default hierarchy. Use sentence case and let weight and size create emphasis.
11. Never use more than two font weights on the same line or inside one card. Pick regular or medium for body and semibold or bold for headlines.
12. Never style inline links as gradient text. Use underline, a solid accent color, or a subtle background highlight on hover.
13. Never scale display text down to fit mobile by simply shrinking the desktop size. Establish a separate mobile type scale and enforce a minimum 16px body size.

## Imagery & Icons

14. Never generate fake user avatars with identical illustrated styles or synthetic faces. Use initials in solid color circles, generic silhouettes, or real photos only.
15. Never invent company logos for a "trusted by" bar. Either omit the section entirely or use actual customer marks with verified permission.
16. Never use emoji as list bullets or section labels. Use the template's icon system or standard CSS disc and circle bullets.
17. Never insert generic 3D illustrations of hands holding phones, floating cubes, or abstract shapes. Use photography, simple line icons, or no imagery at all.
18. Never repeat the same icon style across every feature card. Vary between filled, outlined, and simple glyphs, or remove the icon where a number or image works better.

## Components & Patterns

19. Never build a pricing page with exactly three tiers where the middle card is larger and labeled "Most Popular." Match the real product's plan count and highlight only when live data supports it.
20. Never create testimonial cards with fake names, identical five-star ratings, and parallel sentence structure. Use real quotes with full attribution or remove the carousel.
21. Never add a four-column footer link farm unless the site actually has sixteen distinct pages. Reduce to two columns plus legal links and a contact method.
22. Never display fake metrics like "10,000+ users" or "99.9% uptime" without a data source. Omit social proof rather than invent it.
23. Never build a feature grid where every item uses the same icon container, three-word headline, and two-line body. Vary the depth, length, and visual weight of each item.
24. Never place a newsletter signup above the footer on every single page. Include it only where user intent supports email capture, such as after an article or on a dedicated contact page.
25. Never use a sidebar navigation with exactly five identical-weight links and a bottom user card. Group links into collapsible sections and reflect real information architecture.

## Content & States

26. Never use "Lorem ipsum," "Sample text," placeholder dates, or "user@example.com." Write realistic copy or ingest the user's actual content before rendering.
27. Never leave async sections without empty, loading, and error states. Every data-bound component must handle all three conditions with meaningful messaging.
28. Never generate FAQ sections with questions no real user asks. Populate from actual support data or remove the accordion entirely.

## Animation & Polish

29. Never animate every element on scroll. Animate at most one element per viewport entry; keep the motion subtle and under 300ms.
30. Never add confetti, particle fields, cursor-following glows, or scroll-triggered typewriter effects to business tools. Reserve celebration for explicit success actions only.

## Reject if

- A page contains both a gradient hero and a three-tier pricing table with a highlighted middle column.
- Any testimonial uses a fake name, stock avatar, or ends with a first-name-only signature.
- More than 50% of the blocks on a landing page are center-aligned.
- There is no loading state for any component that fetches data.
- Emoji, decorative SVG blobs, or cursor-following effects appear anywhere in the interface.
