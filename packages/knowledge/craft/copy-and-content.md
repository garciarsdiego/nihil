Guarantee every word and data point in the generated interface feels intentional, authentic, and appropriate to the user's context.

## Voice and Tone
1. Adopt one consistent voice for every interface string and never deviate within the same view.
2. Never use lorem ipsum, "sample text," or placeholder gibberish in any rendered element.
3. Always calibrate tone to the user's emotional context: serious for errors, encouraging for onboarding, neutral for settings.
4. Avoid industry jargon unless the target audience expects it; define acronyms on first use.
5. Write in second person when addressing the user and third person when describing system behavior.
6. Never use humor in error messages or destructive confirmations; reserve lightness for success and onboarding states.

## Realistic Placeholder Data
7. Use specific, believable names, companies, email addresses, and figures that reflect real-world diversity.
8. Never reuse the exact same placeholder string in multiple visible fields on one screen.
9. Always align placeholder data with the domain: realistic transaction amounts for finance, genuine-looking SKUs for inventory, valid ISO dates for scheduling.
10. Use varied timestamps, currencies, and measurements that look like they belong to a live dataset.
11. Generate avatars or initials from plausible names rather than generic "User A" labels.
12. Vary content length across list items so the interface does not look mechanically produced.
13. Never use obviously fake domains like "example.com" in user-facing previews; prefer realistic but obviously fictional domains.

## Action Microcopy
14. Write every button and link label as a precise verb or verb phrase describing the outcome.
15. Never use "Click here," "Submit," or "OK" as standalone action labels.
16. Always pair destructive verbs with a clarifying noun: "Delete project," not just "Delete."
17. Use sentence case for all interactive labels, including buttons, tabs, and navigation items.
18. Limit primary action labels to four words or fewer; move longer explanations to helper text.
19. Distinguish between primary and secondary actions through label specificity, not novelty.
20. Always label the cancellation action clearly: "Keep draft," not just "Cancel."

## Error and Empty States
21. Write error messages that explain what happened, why it matters, and how to recover.
22. Never blame the user; frame errors as obstacles the interface can help resolve together.
23. Always provide a concrete next step after an error, even if that step is simply to try again later.
24. Use empty states to educate or guide; include a headline, a one-sentence explanation, and a relevant action.
25. Write loading copy that indicates progress or remaining work rather than a static "Loading..."
26. Distinguish between retryable errors and permanent failures with appropriately different copy.
27. Never use technical error codes as the only message shown to the user; append them to plain-language explanations.

## Labels and Instructions
28. Use field labels that describe the requested input in plain language, not database column names.
29. Never rely on placeholder text alone to serve as a field label.
30. Always add helper text when a field expects a specific format, unit, or constraint.
31. Use inline validation messages that are concise, specific, and positioned adjacent to the affected field.
32. Write confirmation prompts as complete sentences that restate the consequences of the action.

## Content Structure
33. Use realistic content lengths that reflect actual user behavior, not padded paragraphs.
34. Never include copyright notices, trademark symbols, or legal disclaimers unless explicitly requested.
35. Always provide meaningful alt text for any image described in the content plan.
36. Use consistent terminology for the same concept across every screen; maintain a glossary if necessary.
37. Write headings that describe the content beneath them, not generic section markers like "Section 1."
38. Never use all caps for emphasis; rely on sentence structure or visual weight instead.
39. Use numerals for all quantities, including those under ten, to maintain scannability in interfaces.
40. Avoid directional language like "below" or "above" when describing interface elements; refer to them by label or name.
41. Limit confirmation modals to one primary question and one clarifying sentence.

## Reject if
- Reject if any visible string contains "lorem ipsum," "sample text," or repetitive nonsense words.
- Reject if a button or link label is vague, such as "Click here," "OK," or "Submit" without context.
- Reject if an error message fails to explain the cause or offer a recovery step.
- Reject if placeholder names, numbers, or dates are duplicated across multiple fields on the same view.
- Reject if the tone, terminology, or grammatical person shifts between elements in the same interface.
