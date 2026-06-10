Define how to build consistent, stateful UI components that feel intentional across every interaction and data condition.

## Variants and Reusability

1. Always extend the template's existing shadcn/ui components through variants, props, or composition rather than creating new one-off components for single-use cases.

2. Use the `variant` and `size` prop pattern for every reusable component; every visual deviation should be a named variant, not an inline style override.

3. Never hardcode colors, spacing, or shadows directly on a component instance; route all visual decisions through the component's variant system or semantic tokens.

4. Keep component APIs narrow and predictable; a button should accept `variant`, `size`, and `disabled`, not arbitrary `className` injections that bypass the design system.

## The Five Async States

5. Build every data-dependent UI region for five explicit states: loading, empty, error, partial, and ideal.

6. In the loading state, show a skeleton or inline spinner that matches the shape of the upcoming content; never flash a blank region or generic "Loading..." text.

7. In the empty state, display a concise explanation of what belongs there and a clear next action if the user can populate it; never leave an empty box without context.

8. In the error state, surface a human-readable message, an optional retry control, and a way to escalate or get help; never swallow failures or dump raw error objects.

9. In the partial state, render available data immediately while gracefully degrading missing pieces with inline placeholders or lower-confidence styling; never block the entire view for one stalled field.

10. In the ideal state, present the full dataset with all interactive elements enabled and no extraneous decoration.

11. Always test transitions between these five states explicitly; a component that looks correct in the ideal state but breaks in loading is incomplete.

## Interaction States

12. Style the hover state with a subtle but visible change—lift, tint shift, or shadow increase—so users know the element is interactive before they click.

13. Style the focus state with a high-contrast ring or outline that is clearly distinct from hover; never remove focus indicators or make them invisible.

14. Style the active state with a compressed or pressed visual treatment so the user receives immediate tactile feedback on click or tap.

15. Style the disabled state with reduced opacity, a muted cursor, and the removal of hover effects; disabled elements must never look interactive.

16. Ensure all four interaction states are visually different from one another; if hover and focus are indistinguishable, users cannot track keyboard navigation.

## State Composition and Transitions

17. Compose complex states from simple ones: a disabled loading button should inherit both disabled opacity and a loading spinner, not invent a third hybrid style.

18. Keep state transitions under 200ms for instant feedback; use CSS transitions on opacity, transform, and color, never on layout properties that trigger reflow.

19. Persist layout stability across state changes: a button entering the loading state should remain the same width and height so surrounding content does not shift.

20. Document state behavior in the component's usage notes or Storybook stories so future developers do not reintroduce one-off overrides.

## Patterns to Avoid

21. Never create a new component when a variant of an existing one will serve the purpose.

22. Never use lorem ipsum, generic placeholders, or blank space to represent any of the five async states.

23. Never rely solely on color to signal state; pair color changes with icons, text labels, or motion so the meaning survives monochrome or color-blind viewing.

24. Never leave interaction states unstyled; unstyled hover and focus make the UI feel unfinished and inaccessible.

25. Never mix async state logic with layout logic in the same component; extract stateful shells from presentational components to keep both predictable.

## Reject if

- A component introduces a new visual treatment instead of using an existing variant.
- Any async view lacks at least one of the five required states.
- Hover, focus, active, or disabled states are missing or visually identical.
- State transitions cause layout shift or rely on unstyled browser defaults.
- A disabled element still responds to hover or appears clickable.
