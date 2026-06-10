# Landing Page — Hero, Social Proof, Features, CTA Discipline

Use this playbook when the user asks for a marketing landing page, product homepage, or single-page conversion site. Do not use it for authenticated dashboards, blogs with article feeds, or mobile-native screens.

## Page Structure

Build these sections in the order a visitor scrolls through them. Each section is a standalone component in `src/sections/`.

1. `Navbar` — fixed top, logo left, nav links center, primary CTA right. Collapse to a hamburger sheet on mobile. Keep the navbar height fixed to a single spacing increment such as 64px or 80px. Never stack more than one fixed chrome layer so the viewport does not shrink into a letterbox. Use shadcn/ui `Sheet` for the mobile menu. The navbar must include a skip-to-content link as the first focusable element.

2. `Hero` — single headline, one-sentence subhead, primary and secondary actions. Keep it under 85vh and above the fold. Left-align the text container by default. Reserve center alignment only for the hero when the page has no long-form body copy below it. Cap the text container at `max-w-3xl`. Use an `h1` and a single `p` tag for the subhead. Never use a display font for body text.

3. `LogoBar` — a single row of verified customer or partner marks. Omit entirely if no real logos exist. Render logos in grayscale and keep them inside the global max-width container. Use a horizontal scroll container on mobile and a centered flex row on desktop. Never invent company logos or generate synthetic partner marks.

4. `ProblemOutcome` — two-column split: pain on the left, resolution on the right. Use real metrics only. Collapse to a single column on mobile with the pain statement first. Use an `h2` for the section heading and `p` tags for body copy. Never stretch paragraphs to full width on large screens without an inner constraint.

5. `FeatureGrid` — three to six items, each with an icon, a headline in sentence case, and one to two lines of body copy. Vary card density and text length across items so the grid does not look mechanically produced. Use `Card` from shadcn/ui for each item. Keep icons consistent in size but vary between filled and outlined styles.

6. `SocialProof` — one to three concise quotes with full attribution (name, title, company). Use real quotes or remove the section entirely. Never invent names or generic five-star ratings. Render quotes inside `blockquote` elements with `cite` attribution. Limit the section to three quotes maximum. Use a constrained max-width for each quote.

7. `PricingTeaser` — only if the product has paid tiers. Show the starting price and a link to a full `/pricing` page rather than duplicating a full pricing table on the landing page. Do not highlight a middle tier unless live data supports it. Keep the teaser to a single card or row. Never build a pricing page with exactly three tiers where the middle card is larger and labeled "Most Popular" by default.

8. `FAQ` — five to eight questions sourced from actual user support data. Each answer is one paragraph. If no real questions exist, omit the section. Use shadcn/ui `Accordion` and ensure each trigger is a `button`. Write answers as complete sentences, not bullet fragments. Never generate FAQ questions that no real user would ask.

9. `ClosingCTA` — repeat the primary action in a constrained container with a contrasting background surface token. Keep the same button label and color used in the hero. Center the container with auto margins inside the global max-width bound. Do not introduce a new color or button style.

10. `Footer` — two columns of links plus legal and a contact method. No four-column link farms. Keep the footer flat and solid; no glassmorphism, gradient backgrounds, or decorative SVG blobs. Reduce to two columns plus legal links and a contact method.

## Step-by-Step Build Order

1. Scaffold `src/pages/LandingPage.tsx` and import it into `src/App.tsx`. Wrap the entire page in a `main` landmark. Keep the page component free of layout logic beyond section ordering and spacing.

2. Create `src/sections/Navbar.tsx` with a `nav` landmark, a skip-to-content link as the first focusable element, and a mobile-first flex layout. Use shadcn/ui `Sheet` for the collapsed menu. Preload only the font weights rendered above the fold. Lock navbar height to a single spacing increment.

3. Create `src/sections/Hero.tsx` as a single `section` with an `h1`, a `p` subhead, and a flex row of two `Button` variants: `default` and `outline`. Cap the text container at `max-w-3xl` and left-align everything. Keep the hero min-height under 85vh so the first meaningful action is visible immediately.

4. Add `src/sections/LogoBar.tsx` only after the user supplies real logos. Render them as grayscale images inside a horizontal scroll container on mobile and a centered flex row on desktop. If no logos are available, skip this step and remove the import entirely.

5. Create `src/sections/ProblemOutcome.tsx` with a two-column CSS Grid that collapses to a single column below the `md` breakpoint. Place the pain statement on the left and the outcome on the right. Use an `h2` for the section heading and `p` tags for body copy. Never stretch paragraphs to full width on large screens without an inner constraint.

6. Create `src/sections/FeatureGrid.tsx` as a responsive grid: one column on mobile, two on tablet, three on desktop. Use `Card` from shadcn/ui for each item. Vary text length across cards so the grid does not look mechanically produced. Keep icons consistent in size but vary between filled and outlined styles. Never use emoji as list bullets or section labels.

7. Create `src/sections/SocialProof.tsx`. Render quotes inside `blockquote` elements with `cite` attribution. Limit the section to three quotes maximum. Use a constrained max-width for each quote so line length stays readable. Never use fake avatars with identical illustrated styles; use initials in solid color circles or real photos only.

8. Create `src/sections/FAQ.tsx` using shadcn/ui `Accordion`. Ensure the wrapper has an `h2` and each trigger is a `button`. Source questions from real support data or omit the section. Write answers as complete sentences, not bullet fragments.

9. Create `src/sections/ClosingCTA.tsx` with the same primary action label as the hero, wrapped in a `section` with a `surface` background token. Keep the container centered with auto margins and a global max-width bound. Do not introduce a new color or button style.

10. Create `src/sections/Footer.tsx` with a `footer` landmark, two link columns, and a `p` tag for copyright. Keep it flat; no glassmorphism or decorative gradients. Reduce to two columns plus legal links and a contact method.

11. Wire every section into `LandingPage.tsx` with consistent vertical spacing between sections using the fixed spacing scale. Apply larger increments between distinct sections and smaller increments between related siblings. Never use arbitrary margin or padding values.

12. Verify the `h1` is unique, heading levels do not skip, and every interactive element meets the 44 x 44 px touch target minimum. Maintain a logical heading order without skipping levels.

13. Add `prefers-reduced-motion` checks for any entrance animations; keep motion under 300ms. Animate at most one element per viewport entry. Never animate every element on scroll.

14. Run the dev workflow and test the page at 320px, 768px, and 1280px viewports. Verify that no text touches the viewport edge, that focus indicators remain visible across all sections, and that line lengths stay under 75 characters for body text.

## Quality Bar

A landing page passes when a visitor can understand the product and take action within ten seconds of landing. The headline must describe the outcome, not the category. Every metric or testimonial must trace back to a real source. The primary CTA must remain visually consistent from hero to closing section; never mutate the label or the color.

The page must feel composed: consistent left alignment for body copy, breathable whitespace between sections, and no decorative SVG blobs or gradient backgrounds competing with the content. Dark mode must preserve the same luminance hierarchy as light mode without inverting the entire palette. All copy must be realistic; never use lorem ipsum or placeholder names. Every async-capable section must include loading, empty, and error states even on a static marketing page.

Contrast must meet WCAG AA: 4.5:1 for normal text and 3:1 for large text, icons, and borders. Never rely solely on color to indicate state; pair hue with an icon, label, or pattern. Use semantic HTML throughout: `button` for actions, `a` for navigation, and correct landmark elements for regions.

Typography must stay disciplined: at most two font families, a constrained scale of no more than seven sizes, and weight contrast that signals hierarchy. Never use more than three weights on a single screen. Cap readable line length at 75 characters for body text. Set line-height to 1.5 for body text and 1.3 for headings.

Spacing must follow the fixed scale built on 4px increments. Use larger increments to separate distinct sections and smaller increments for related siblings. Default to more whitespace rather than less. Never let text or interactive elements touch the edge of a viewport or card.

## Common Mistakes

1. Center-aligning every section. Left-align body copy, forms, and feature descriptions; reserve centering for the hero and the closing CTA only. Centered paragraphs longer than three lines are hard to read.

2. Inventing testimonials, user counts, or uptime figures. Omit social proof rather than fabricate it; empty attribution erodes trust. Never display metrics like "10,000+ users" without a data source.

3. Using a gradient hero with pill-shaped buttons and a three-tier pricing highlight. That combination is a recognizable generated signature; choose either a flat hero or a non-pill button shape. Never pair a purple-to-blue gradient with white text and rounded pill buttons.

4. Repeating identical card structures in the feature grid. Vary icon style, text length, and vertical padding so the grid feels hand-arranged. Never build a feature grid where every item uses the same icon container, three-word headline, and two-line body.

5. Adding a newsletter capture above the footer on every page. Include email capture only where intent is high, such as after the FAQ or inside a dedicated contact flow. Never place a newsletter signup on every single page by default.
