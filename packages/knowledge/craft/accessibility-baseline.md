Ensure every interface is operable and perceivable for all users, regardless of input method or sensory ability.

## Semantic Structure

1. Use the correct HTML element for each content role: `button` for actions, `a` for navigation, `nav`, `main`, `section`, and `article` for landmarks.
2. Always provide a single `h1` per view and maintain a logical heading order without skipping levels.
3. Use ordered lists (`ol`) for sequential steps and unordered lists (`ul`) for grouped items; never fake lists with breaks or dashes.
4. Mark up tabular data with `table`, `th`, and `td`; never rely on visual grid layouts to communicate tabular relationships.
5. Include `lang` on the root element and declare any mid-document language changes.
6. Reserve ARIA roles for cases where native HTML semantics cannot achieve the required behavior; do not override correct native semantics with redundant roles.

## Labels and Descriptions

7. Every form control must have an accessible name via an associated `label`, `aria-label`, or `aria-labelledby`; placeholder text alone is never sufficient.
8. Group related controls with `fieldset` and `legend`; use `aria-describedby` to link helper text or error messages to their inputs.
9. Provide descriptive text for links and buttons; never use "click here," "read more," or identical labels that lead to different destinations.
10. Mark required fields with both visual indicators and `aria-required` or the `required` attribute.
11. Expose the accessible name of icon-only buttons through `aria-label` or visually hidden text.
12. Use `aria-live` regions to announce dynamic content changes such as search results, form errors, and loading completions.
13. Ensure all frames and iframes have descriptive titles that explain their purpose or content.

## Focus Visibility

14. Always show a visible focus indicator on every interactive element; never suppress the default outline without providing a higher-contrast replacement.
15. Use a focus ring color that meets at least 3:1 contrast against the surrounding background.
16. Ensure focus indicators are thick enough to be noticed; a single-pixel outline is insufficient on high-resolution displays.
17. Preserve focus order that matches the visual reading flow; do not reposition elements in a way that traps or skips keyboard users.
18. Remove `tabindex` values greater than zero; rely on natural DOM order or controlled programmatic focus instead.
19. Manage focus explicitly after route changes or view swaps so keyboard users land at the beginning of new content.

## Keyboard Paths

20. Make every interactive element reachable and operable with a keyboard alone; hover-only interactions are prohibited.
21. Implement standard keyboard patterns: `Enter` or `Space` to activate buttons, `Escape` to close modals and menus, arrow keys for listbox and tab navigation.
22. Trap focus inside modal dialogs while they are open and restore focus to the trigger on close.
23. Provide a "skip to content" link as the first focusable element on every page.
24. Ensure custom composite widgets expose correct `role`, `aria-orientation`, and keyboard behavior as defined by the WAI-ARIA Authoring Practices.
25. Avoid overriding native keyboard shortcuts with application shortcuts unless the user can remap or disable them.

## Contrast

26. Maintain a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text (18px or 14px bold) against its background.
27. Apply a minimum contrast ratio of 3:1 for user-interface components and graphical objects that convey information.
28. Never rely on color alone to communicate state, error, or meaning; pair it with icons, text labels, or patterns.
29. Test contrast with the actual hex values used in the rendered output; estimated or eye-checked values are not acceptable.
30. Use underlines or bold weight in addition to hue shifts to differentiate inline links from surrounding body text.

## Motion and Animation

31. Respect `prefers-reduced-motion`; disable or dampen non-essential motion when the user has requested reduced animation.
32. Keep any essential motion subtle and brief; avoid parallax, auto-playing carousels, or rapid flashing.
33. Never use content that flashes more than three times in one second; this applies to loading spinners, alerts, and transitions.
34. Provide a mechanism to pause, stop, or hide any auto-updating content that starts automatically and lasts more than five seconds.
35. Design motion paths that avoid large vertical shifts to reduce the risk of triggering vestibular disorders.

## Reject if

- Focus indicators are invisible, removed, or indistinguishable from the background.
- Color is the only means used to show an error, success, or active state.
- Any interactive element cannot be reached or operated with a keyboard.
- Images that convey meaning lack descriptive alternative text.
- Text and background combinations fall below WCAG AA contrast thresholds.
