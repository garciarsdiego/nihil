Establish a disciplined type system using at most two font families, a constrained scale, and purposeful weight contrast so every text element signals its exact role.

## Font Families

1. Use exactly one font family for 90% of all text; reserve a second family only for display headings, data, or code.
2. Never load more than two font files per weight unless the template explicitly demands a third for specialized glyphs.
3. Always pair families with compatible x-heights so mixed text does not visually bounce.
4. If the project has no second family, use the same family everywhere and rely on weight and size alone to create hierarchy.
5. Define a system font fallback stack that ends with a generic family so layout does not collapse during web font loads.
6. Never use a display or script face for body text regardless of how legible it appears in large preview samples.
7. Preload only the weights you intend to render above the fold; extra font files delay first meaningful paint.

## Scale Construction

8. Build the type scale from a single base size—usually 16px for body text—and derive every other size by a fixed ratio such as 1.25 or 1.5.
9. Define no more than seven distinct sizes in the entire application: three for body and captions, four for headings.
10. Use rem units for every text size so user preferences and zoom behavior remain intact.
11. Never interpolate arbitrary pixel values between scale steps; if a size feels wrong, adjust the ratio, not the individual token.
12. Establish a minimum text size of 0.75rem for any legible content; smaller sizes are reserved for decorative watermarks or legal fine-print only.
13. Scale headings down by one step on mobile rather than letting them overflow their containers.

## Weight and Size Pairing

14. Assign exactly one weight to each role: regular (400) for body, medium (500) for labels and emphasis, and semibold (600) or bold (700) for headings.
15. Never use a font weight lighter than 400 for interface text regardless of aesthetic trends.
16. Pair larger sizes with lower weights and smaller sizes with higher weights to preserve even visual density.
17. Always differentiate interactive elements from static text through weight or decoration, never through color alone.
18. Use uppercase lettering only for labels, badges, and micro-copy; always increase letter-spacing when doing so to maintain readability.
19. Choose between semibold and bold for headings at the project start and apply that choice consistently; do not alternate arbitrarily.
20. Never apply bold styling to text that is already large enough to dominate its surrounding context.

## Line Length and Height

21. Cap readable line length at 75 characters for body text; enforce this through max-width containers rather than arbitrary padding.
22. Set line-height to 1.5 for body text, 1.3 for headings, and 1.7 for captions or dense descriptions.
23. Never use unitless line-height on elements that may inherit unexpected font sizes from parent containers.
24. Ensure heading margins are proportional to the line-height above and below so blocks of text sit in rhythm.
25. Separate paragraphs by space equal to the body line-height, not by half that amount or by double it.
26. Keep line length for headings shorter than body text; long heading lines dilute impact and slow scanning.
27. Reduce line-height for oversized display type to 1.1 or 1.05 so the lines feel like a single visual unit.

## Hierarchy Mistakes

28. Never use more than three weights on a single screen; excessive contrast creates noise, not structure.
29. Do not style headings by color shift alone; size and weight must always carry the hierarchy first.
30. Avoid consecutive heading levels that differ by fewer than 0.25rem; users cannot perceive distinctions that subtle.
31. Never center-align paragraphs longer than three lines; centered text is for headings and short labels only.
32. Do not rely on italic styling to convey importance; italics are for citations, foreign terms, and subtle emphasis.
33. Never mute body text below a 4.5:1 contrast ratio against its background, even for secondary descriptions.
34. Do not mix left and center alignment within the same text block; choose one alignment per logical section.
35. Avoid all-caps headings unless the typeface was specifically designed for that treatment; most faces suffer in readability.
36. Never stack multiple heading styles on a single line; a heading must be one size, one weight, and one color.

## Reject if

- The design uses three or more font families, or loads variable axes that are not actually exercised in the UI.
- Two heading levels are indistinguishable without measuring pixels.
- Body text line length exceeds 90 characters on any viewport where reading is expected.
- Any text element uses color as its sole differentiator from surrounding text of the same size.
- Line-height is uniform across headings, body, and captions rather than tuned to each role.
