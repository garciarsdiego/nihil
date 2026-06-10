Enforce a tight, role-based color system built on semantic tokens that supports light and dark modes without arbitrary values.

## Palette Roles

1. Author exactly one color palette per project, limited to three to five colors with explicit functional roles.
2. Assign every palette color a role chosen from: background, surface, primary, accent, or text.
3. Map background to the lowest layer, surface to elevated cards and panels, primary to dominant interactive elements, accent to highlights and special calls-to-action, and text to all readable copy.
4. Never introduce a new color into the project that is not registered in the core palette with a named role.
5. Derive subtle variations, such as hover or disabled states, by adjusting opacity or token mixing rather than adding new base colors.
6. Reject requests to expand the palette for one-off marketing graphics or decorative flourishes.
7. Reserve the accent role for a single high-visibility action or highlight; do not split accent into multiple competing accent colors.
8. Keep text colors neutral or near-neutral; avoid using saturated hues for body copy or headings.
9. Use the primary color sparingly; it should dominate only on key interactive elements, not fill entire screens.
10. Lock the palette before component work begins, after the initial design review; treat any later color change or addition as a breaking, scope-level change requiring explicit approval.
11. Document the palette and its roles in the project knowledge base so every builder references the same canonical source.

## Semantic Tokens

12. Reference every color through a semantic token name; never paste a raw hex, rgb, hsl, or oklch value into component code.
13. Name tokens by function, context, and hierarchy, never by literal color description; prefer `--color-interactive-primary` over `--color-blue`.
14. Configure the token system inside the project's theme and shadcn/ui configuration files, then import from those files exclusively.
15. Never use Tailwind arbitrary-value color syntax such as `bg-[#3b82f6]`, `text-[rgb(255,0,0)]`, or `border-[hsl(220,50%,50%)]`.
16. Keep all token definitions in a single source of truth; do not scatter duplicate or alternate values across modules.
17. When a component needs a new color context, extend the token system in the theme file before overriding locally.
18. Group related tokens by domain, such as action, feedback, and surface, so the system remains scannable and maintainable.
19. Alias raw values through at least one layer of abstraction; the component layer should never know the concrete value.
20. Treat the token registry as read-only during component development; modifications belong to the design-system layer.
21. Verify that every token has a valid fallback or default so the interface degrades gracefully if a theme variable is missing.
22. Map deprecated tokens to replacements immediately; do not leave orphaned token names in the codebase.

## Dark Mode Structure

23. Structure tokens so that a single semantic name resolves to a different concrete value in dark mode without renaming the reference in consuming code.
24. Store light and dark values as paired entries in the theme configuration; avoid external media-query overrides or manual class toggling for individual colors.
25. Choose dark-mode backgrounds that are deep but not pure black; reserve pure black for OLED-specific overrides only.
26. Ensure dark-mode surfaces sit visibly above the background through subtle lightness separation, not heavy shadows or bright borders.
27. Verify that borders, dividers, disabled states, focus rings, and placeholder text remain visible when the dark palette is active.
28. Do not implement dark mode by globally inverting every color; map each semantic role to an intentionally chosen dark value.
29. Maintain the same number of token steps in dark mode as in light mode; do not collapse the scale or remove intermediate values.
30. Test dark-mode combinations on real devices and screens, not only in simulated browser toggles.
31. Keep dark-mode primary and accent colors slightly desaturated compared to their light counterparts to reduce eye strain.
32. Preserve the perceived luminance hierarchy from light mode so that elevation and importance read the same way in dark mode.
33. Document the dark-mode value for every token alongside its light-mode value in the theme configuration.

## Contrast & Accessibility

34. Enforce a minimum contrast ratio of 4.5:1 for all normal text against its immediate background surface.
35. Enforce a minimum contrast ratio of 3:1 for large text, icons, and the visible borders of interactive controls.
36. Never rely solely on color to indicate state, error, or success; always combine hue with an icon, label, pattern, or text change.
37. Document the expected contrast ratios for standard text-on-surface, primary-on-surface, and accent-on-surface pairs in the theme file.
38. Run automated contrast checks on both the light and dark token sets, including hover and focus variants, before finalizing the palette.
39. Treat decorative graphics and disabled controls as separate contrast categories, but still ensure they do not disappear entirely against their backgrounds.
40. Ensure focus indicators meet the 3:1 contrast requirement against both the component and the surrounding surface.
41. Flag any token pair that uses transparency for text color, because opacity changes undermine guaranteed contrast ratios.
42. Define an emergency error color that meets 4.5:1 contrast on both light and dark backgrounds without requiring a separate error token per mode.
43. Reject palettes that look attractive in isolation but fail contrast when primary and accent colors are combined on the same surface.
44. Maintain a contrast exception log for purely decorative elements so reviewers know the exemption is intentional.

## Reject if

- The palette exceeds five colors or contains colors without defined functional roles.
- Any raw hex, rgb, hsl, or oklch value appears outside the centralized token registry or theme file.
- Dark mode is built through blanket color inversion rather than mapped semantic tokens.
- Any standard text-surface pair falls below the WCAG AA contrast threshold.
- A component introduces its own local color variables or arbitrary Tailwind values instead of consuming the token system.
