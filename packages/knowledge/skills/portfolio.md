Use this playbook when the user asks for a personal or agency portfolio, a work showcase, or a case-study-driven site. It prioritizes projects over biography and treats every case study as a self-contained narrative.

## Page / feature structure

1. **Minimal navigation bar**
   Logo or name on the left, two to three links on the right (Work, About, Contact). No dropdowns, no sticky social sidebars, and no search input. Keep the navbar height compact so it does not steal viewport from the work. Use Flexbox for this one-dimensional row.

2. **Work-first hero**
   One sentence stating the craft or discipline, followed immediately by a scroll cue or a single featured project thumbnail. No portrait photo, no life story, and no animated background. The hero must be shorter than 85vh so the first project row is visible on most screens. Left-align the text; reserve centering only for a single-statement headline.

3. **Project index**
   A grid of case-study cards. Each card contains a thumbnail image, project title, category tag, and a one-line outcome. Grid collapses to one column on mobile. Use CSS Grid with `gap-6` or `gap-8`, never deep flex nesting. Cap the grid at the global max-width wrapper of 1280px. This grid is the dominant visual element above the fold.

4. **Case-study detail page (routed)**
   Hero image, client or context line, challenge paragraph, process paragraphs with supporting images, outcome metrics or quotes, and a link to the live project or next case study. No sidebar. Text sits in a reading-width container capped at roughly 640px, centered within the global wrapper. Use semantic `<article>` and `<header>` elements. Never insert a pricing table or feature comparison here.

5. **About section or page**
   Brief credentials, tools list, and a contact method. Keep it shorter than the longest case study. Use a two-column layout on desktop only if the second column holds a concise tool list; never split a biography into multiple side-by-side paragraphs. The contact CTA sits below the bio, not inside it. Keep line length under 75 characters for readability.

6. **Footer**
   Email link, social links, and a copyright line. No newsletter form unless the user explicitly requests one. Limit footer links to two columns plus legal text. Use semantic `<footer>` and do not add a second navigation tree here.

## Step-by-step build order

1. Create `src/components/PageLayout.tsx` with the global max-width wrapper, skip-to-content target, and consistent vertical padding. All pages render inside this shell. Use semantic `<main>` for the content region.

2. Create `src/data/projects.ts` with a typed array of realistic projects. Each entry needs `slug`, `title`, `category`, `thumbnail`, `summary`, `challenge`, `process`, `outcome`, `year`, and optional `liveUrl`. Use specific, believable names and figures. Never duplicate placeholder strings across entries.

3. Create `src/components/ProjectCard.tsx` with `variant` and `size` props. `variant="compact"` shows thumbnail, title, tag, and one-line outcome. `variant="featured"` spans full width with a larger image and longer description. Route all colors and spacing through semantic tokens. Never inject arbitrary Tailwind classes or raw hex values.

4. Build `src/pages/Work.tsx` as the project index. Import `ProjectCard` and map the static dataset into a responsive CSS Grid: one column on small screens, two on medium, three on large. Add `aria-label="Project grid"` to the grid container. Ensure the grid is the dominant element above the fold.

5. Build `src/pages/CaseStudy.tsx` as a route-driven detail view that reads `work/:slug` from `react-router-dom`. Render a full-bleed hero image inside the global max-width container, followed by stacked prose blocks and inline images. Use semantic `<article>` and `<header>` elements. Maintain a logical heading order without skipping levels.

6. Add `src/components/CaseStudyMeta.tsx` to render client name, role, year, and live-project link as a single horizontal row that wraps on mobile. Use the accent color only for the live link. Keep meta text in the neutral text color so it does not compete with the hero image.

7. Wire routes in `src/App.tsx`: `/` routes to the Work index, `/work/:slug` routes to CaseStudy. Add a catch-all redirect to `/`. Use a flat route config. Do not nest layouts deeper than one level.

8. Build `src/pages/About.tsx` with a short bio limited to three paragraphs, a tool stack rendered as inline tags using `variant="outline"` badges, and a contact CTA button. Place the contact CTA below the bio, not inside it. Keep line length under 75 characters for readability.

9. Create `src/components/Navbar.tsx` with a skip-to-content link as the first focusable element, semantic `<nav>`, and an active-route indicator using an underline or weight shift, never color alone. Ensure focus indicators are thick enough to be visible on high-resolution displays and meet 3:1 contrast.

10. Create `src/components/Footer.tsx` with semantic `<footer>`, external links that open in new tabs with `rel="noopener noreferrer"`, and descriptive `aria-label` attributes on icon-only buttons. Do not add a second navigation tree here.

11. Implement `src/components/AsyncShell.tsx` for future dynamic data. Provide skeleton shapes that match the project grid, an empty state with a "No projects yet" message and contact CTA, and an error state with a retry button. Skeletons must match the height and width of real cards to prevent layout shift.

12. Add a single `h1` per view and maintain logical heading order without skipping levels. The Work page uses `h1` for the page title, `h2` for section headings, and `h3` for card titles. The CaseStudy page uses `h1` for the project title.

13. Configure the type scale in the theme file before building any page. Use at most two font families, a base size of 16px, and a fixed ratio such as 1.25 or 1.5. Assign regular weight to body, medium to labels, and semibold to headings.

14. Optimize images before placing them in `public/` or `src/assets/`. Use WebP or AVIF formats when possible. Add descriptive `alt` text to every project thumbnail and case-study inline image. Decorative images should carry an empty `alt` attribute.

15. Run the dev workflow and verify every route. Check contrast on case-study images by testing any text overlays. Confirm focus order moves logically through the project grid. Ensure touch targets are at least 44 × 44 px at the base mobile breakpoint. Test on a real mobile device or emulator, not only on a resized desktop browser.

## Quality bar specific to the task

- Every project card links to a real, specific case-study page. No orphaned grids or dead thumbnails.
- Thumbnails are high-resolution screenshots or photographs, not generic 3D illustrations, floating cubes, or hand-holding-phone stock art.
- Case studies follow a strict narrative arc: context, challenge, process, outcome. Omit any section that lacks real content rather than padding with vague fluff.
- Metrics and testimonials are either real and fully attributed or omitted entirely. Never invent performance numbers, fake client names, or identical five-star ratings.
- Typography lets the work speak: neutral text colors, at most one display heading font, and body copy kept short enough that images dominate viewport time.
- The grid respects the work-first hierarchy: on desktop, project thumbnails consume at least 60% of the above-fold viewport. Biography never competes with the work for attention.
- Hover states on cards use a subtle lift or shadow increase, never a color inversion. Disabled states reduce opacity and remove hover effects.
- All motion is subtle and under 300ms. Respect `prefers-reduced-motion` by disabling non-essential animations. Never animate every element on scroll.
- All placeholder data is specific and domain-appropriate. Never use "Lorem ipsum," "Sample text," or "user@example.com." Vary content length across list items.
- The palette stays locked at three to five colors with defined roles. Do not expand the palette for decorative flourishes or one-off project accents.
- Case-study pages do not reuse blog post layouts or dashboard widgets. They remain image-forward and prose-heavy, with no data tables or admin chrome.
- The design is authored mobile-first. Multi-column grids collapse to single columns at the small breakpoint. Never hide content on mobile as a substitute for proper reflow.

## Five common mistakes

1. Building an "About me" hero that pushes actual work below the fold. The first meaningful content must be a project or a direct statement of craft. If the user insists on a personal introduction, keep it under two lines and place it beside the first project row, not above it.

2. Using identical card layouts for every project. Vary image aspect ratios, card sizes, or description lengths so the grid feels curated, not mechanically produced. Never stack more than three identical cards in a row without varying height, crop, or text length.

3. Inventing client logos, star ratings, or performance metrics to pad social proof. If the data does not exist, remove the section rather than fake it. Never create a testimonial card with a stock avatar or a first-name-only signature.

4. Adding decorative SVG blobs, gradients behind thumbnails, or glassmorphism overlays on project images. Keep backgrounds flat and let the work provide the visual interest. Reserve translucency exclusively for modal overlays and dropdown menus.

5. Leaving case-study pages without a clear exit or next step. Always provide a link to the live project, a contact CTA, or a "Next case study" pagination control. Manage focus explicitly after route changes so keyboard users land at the beginning of new content.
