Use this skill when the user asks for a blog, publication, changelog, or any long-form reading surface that pairs an index view with individual article pages. It covers the post list, the article reader, and the surrounding navigation chrome.

## Page / feature structure

1. **Global nav** — minimal top bar with a home link, category links, and a search trigger. Keep it single-row; do not stack a sticky banner and a cookie notice underneath it. Use Flexbox for the nav layout and reserve centering only for the logo, never for the entire link row.

2. **Blog index** — page header (`h1` + optional description), category filter pills, post grid or list, and pagination or a load-more control. The header sits inside the global max-width wrapper, not a full-bleed banner.

3. **Post card** — semantic `<article>`, aspect-ratio thumbnail container, category badge, publish date, linked title, one-line excerpt, read-time estimate. Cards must have uniform internal padding and never let text touch the card edge.

4. **Article page** — clean header (title, meta, optional cover image), article body with rich-text hierarchy, inline code and blockquotes, author bio, related-posts strip, minimal footer. The entire article page is single-column; no sidebar, no floating promotional boxes.

5. **Search overlay** — full-text filter on the index or a modal overlay with keyboard navigation, clear results list, and an empty state when nothing matches. The overlay traps focus while open and restores focus to the trigger on close.

## Step-by-step build order

1. Add `/blog` and `/blog/:slug` routes to the router. Name the files `src/pages/BlogIndex.tsx` and `src/pages/BlogPost.tsx`.

2. Define the `Post` type in `src/lib/posts.ts`: `slug`, `title`, `excerpt`, `body`, `category`, `publishedAt`, `readTime`, `coverImage?`, `author`. Derive `readTime` from word count if the data layer does not provide it.

3. Build `BlogIndex.tsx`: render an `h1` ("Writing" or a domain-appropriate label), an optional subtitle in regular weight, a row of category filter buttons, and a responsive grid of post cards. Use CSS Grid for the card matrix and collapse to a single column below the `md` breakpoint. Apply a `gap` value from the spacing scale rather than margin-based distribution. Ensure the page has exactly one `h1`.

4. Build `PostCard.tsx` in `src/components/`. Wrap it in `<article>`. Use an aspect-ratio container for the thumbnail so the grid does not shift when images load. Show the category as a small uppercase label with increased letter-spacing, the date in sentence case, the title as an `<h2>` with a hover underline or tint shift, and a one- or two-line excerpt. Never let the card title and excerpt touch the card edge; use at least `16px` padding.

5. Build `BlogPost.tsx`: render a `<main>` landmark. Inside it, place a reading-width container (`max-w-2xl` or ~640 px) centered with auto margins. Keep the cover image outside this narrow column if it is meant to be wider, but still inside the global max-width wrapper so it does not bleed to the viewport edge.

6. Compose the article header: the post title is the only `h1` on the page. Below it place a meta row — category link, formatted date, read time. Keep this meta row inside the reading-width container. Do not add decorative SVG blobs or gradient backgrounds behind the header.

7. Map the article body through the type scale: `h2` at one step below the title, `h3` one step below that, `h4` only if needed. Set body paragraphs to `1.5` line-height and blockquotes or captions to `1.7`. Cap line length at 75 characters using `max-width` on the reading container, not padding.

8. Style inline elements: `<code>` with a surface token background and a monospace font; `<pre>` blocks with padding and horizontal scroll only when necessary; `<blockquote>` with a left border in the accent color and generous left padding; images full-width inside the reading column. Never use arbitrary Tailwind colors for code backgrounds; reference the semantic token.

9. Build `AuthorBio.tsx` in `src/components/`: initials in a solid color circle (never a synthetic avatar), name in medium weight, short bio in regular. Place it below the article body, separated by a `48px` margin. Do not add social icon links unless the user explicitly requests them.

10. Build `RelatedPosts.tsx`: a heading ("More to read" or similar) followed by a two-column grid or horizontal scroll of minimal post links. Do not use the full card layout here; show only title and date to keep the strip compact and visually subordinate to the main article.

11. Wire search: add a controlled input to `BlogIndex.tsx` or a modal triggered by the nav. Filter the post array by `title` and `excerpt`. Show the five states: loading skeleton, empty state with guidance, error state with retry, partial state for missing images, and ideal state for full results. Announce result changes with an `aria-live` region.

12. Add a "skip to content" link as the first focusable element on both pages. Manage focus to the `h1` after route changes so keyboard users land at the start of new content.

13. Run the dev workflow and verify the index grid collapses cleanly at the `sm` breakpoint, the article reading column does not exceed `75` characters, and all interactive elements show visible focus rings. Check that no layout shift occurs when the search input appears.

## Quality bar specific to the task

- The index must be scannable: category filters feel like tabs, post titles dominate the card, and excerpts sit clearly subordinate. Every card must have a visible hover state (lift or tint) distinct from focus.

- The article page must feel like a native reading experience: single-column, no sidebar, no floating promotional boxes. Heading levels must be obvious from size and weight alone; do not rely on color shifts.

- All links inside the article body must be underlined or use a weight change; never rely on color alone. Inline code must meet contrast requirements against the surface token behind it.

- Search must be fully keyboard-operable: `Escape` closes the overlay, arrow keys move through results, `Enter` opens the selected post. Surface focus with a high-contrast ring that meets the `3:1` contrast requirement.

- Respect `prefers-reduced-motion`: disable any scroll-triggered fade-ins for users who request reduced motion. Keep any essential motion under `200ms`.

- Use realistic placeholder data if the user has not supplied posts yet: specific names, varied publish dates, genuine-looking excerpts. Never use "Lorem ipsum" or identical repeated text across multiple cards.

- Ensure the footer is minimal on both pages: a copyright line and one or two utility links. Do not build a four-column footer link farm for a blog that only has a handful of pages.

- Maintain a logical heading order on the article page: `h1` for the post title, then `h2` for major sections, `h3` for subsections. Never skip from `h2` to `h4`.

- Use semantic HTML throughout: `<article>` for posts, `<time>` for dates, `<nav>` for category filters, and `<main>` for the primary content. Reserve ARIA roles only when native semantics are insufficient.

- Test touch targets at the base mobile breakpoint: every interactive element on the index and article pages must be at least `44 x 44 px`.

- Dark mode must preserve the reading hierarchy: body text stays neutral, surface colors sit visibly above the background, and code blocks remain legible without adjusting contrast manually. Test both modes before calling the task complete.

- Images must have descriptive alt text. If an image is purely decorative, use an empty alt attribute rather than omitting the attribute entirely.

## Five common mistakes

1. Letting the article body stretch to full viewport width on desktop. Long lines destroy reading stamina; enforce a `max-w-2xl` or character-based cap on the reading column.

2. Adding a sidebar to the article page for navigation, ads, or social widgets. Sidebars fracture attention and break the reading rhythm; keep the article page strictly single-column.

3. Styling headings with color changes instead of size and weight. Color alone does not create typographic hierarchy; the reader must be able to scan heading levels in grayscale.

4. Forgetting the loading state for the post list. A blank white screen while posts fetch looks broken; render a skeleton grid that matches the exact card proportions.

5. Center-aligning the article body text. Centered paragraphs are exhausting to read beyond two lines; left-align all body copy and reserve centering for the page header and short captions only. Apply the same left-align rule to blockquotes and lists inside the article.

