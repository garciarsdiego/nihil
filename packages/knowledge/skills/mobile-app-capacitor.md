Use this skill when the user asks for a native mobile app built with Capacitor,
Ionic, or a web-view wrapper targeting iOS and Android. It covers viewport
adaptation, gesture handling, and offline resilience.

## Page / feature structure

Arrange every screen in this order, top to bottom, so the layout adapts
predictably across devices:

1. **Status bar shim** — a fixed `div` or `SafeArea` component that reads
   `env(safe-area-inset-top)` and pushes content below the device status bar.
   Never let text or controls collide with the notch. On Android, account for
   variable status-bar heights by using the environment variable, not a magic
   number. Keep the shim transparent or surface-colored; never add gradients or
   decorative imagery here.

2. **Header / top nav** — a `44 px` minimum-height toolbar. On iOS, center the
   back button and title; on Android, left-align the title and right-align
   actions. Use a single semantic `header` landmark. Keep the header flat and
   solid; do not add background blur or glassmorphism to static chrome. Limit
   header actions to two icons plus a text action on either side. Never pin the
   header and a sticky banner simultaneously; limit fixed chrome to one layer so
   the viewport does not shrink into a letterbox.

3. **Scrollable content area** — a single `main` region that fills the remaining
   viewport. Use `overflow-y-auto` with `-webkit-overflow-scrolling: touch`.
   Nest sections vertically with the standard spacing scale. Cap line length for
   any reading content at `65 characters` or roughly `640 px`, even on tablets.
   Never let text or buttons touch the left or right edge of the viewport;
   maintain at least `16 px` of horizontal padding.

4. **Floating action button (optional)** — one primary action per screen,
   positioned `24 px` from the bottom-right edge above the tab bar. Size it at
   `56 x 56 px`. Use the primary color token for the background and the surface
   token for the icon. Never add a drop shadow to the FAB unless it is actively
   lifted by press. If the screen has no primary action, omit the FAB entirely
   rather than leaving a disabled placeholder.

5. **Bottom tab bar or sheet** — a fixed nav bar sized to
   `env(safe-area-inset-bottom)` plus `56 px` content height. Label every tab
   with an icon and a `11 px` caption in the secondary font weight. Limit the
   tab count to five items maximum. Active state uses the primary token; inactive
   uses the muted text token. Each tab must be a native `button` element with an
   accessible name, never a `div` with a click handler.

6. **Offline banner** — a slim bar that appears above the tab bar when
   `navigator.onLine` is `false`. State: "Working offline — changes will sync
   when you reconnect." Include a retry action. The banner must be
   keyboard-accessible and must not trap focus. Animate the banner with a
   `200 ms` opacity transition; never animate height, which causes layout shift.

## Step-by-step build order

1. Scaffold the Capacitor project from the `vite-react-capacitor` template. Run
   `npx cap init` with the app's name and bundle ID, then add the iOS and
   Android platforms with `npx cap add ios` and `npx cap add android`. Verify
   that the native project directories appear at `ios/` and `android/`.

2. Install `@capacitor/status-bar` and `@capacitor/safe-area`. In
   `capacitor.config.ts`, set `backgroundColor` to the surface token and
   `statusBarStyle` to match the theme (`DARK` or `LIGHT`). Keep the config in
   TypeScript so token values can be imported from the design system. Do not
   hard-code hex values directly in the Capacitor config.

3. Create `src/components/SafeArea.tsx`. It should render a wrapper `div` with
   inline style `paddingTop: var(--safe-area-inset-top)` and
   `paddingBottom: var(--safe-area-inset-bottom)`. Read those values from the
   Capacitor Safe Area plugin on native builds, and default to `0` in the
   browser preview so the web preview does not collapse. Apply the component once
   at the root layout level, not inside every screen.

4. Build `src/components/BottomNav.tsx` with four to five tabs maximum. Each tab
   must be a `button` with an `aria-label`, sized to at least `44 x 44 px` hit
   area. Active tab uses the primary token; inactive uses the muted text token.
   Never use `div` elements with click handlers for navigation. Persist the
   active tab index in URL state or a stable store so deep linking and
   back-button behavior remain coherent.

5. Implement `src/hooks/useNetworkStatus.ts`. Subscribe to `window` `online` and
   `offline` events. Return a boolean `isOnline` and expose a manual `retry()`
   function that attempts to refetch stale queries. Debounce rapid flapping
   events to avoid UI thrashing. On Capacitor, also listen to the native network
   plugin if available for more accurate airplane-mode detection.

6. Create `src/components/OfflineBanner.tsx`. Accept an `isOnline` prop and an
   `onRetry` callback. Render a `48 px` fixed bar above the bottom nav with a
   cloud-off icon, a one-line message, and a "Retry now" text button. The banner
   must be a `role="status"` region with `aria-live="polite"` so screen readers
   announce connectivity changes without interrupting the user.

7. Build the five async state shells from the components craft:
   `LoadingShell`, `EmptyShell`, `ErrorShell`, `PartialShell`, and
   `IdealShell`. Each must preserve layout stability so transitioning between
   them never shifts sibling elements. Skeletons must match the shape of the
   final content; never flash a blank region. In `PartialShell`, render available
   data immediately and degrade missing fields with inline placeholders or
   lower-confidence styling.

8. Add touch-gesture wrappers. Wrap lists in a `div` with `touch-action: pan-y`
   to keep vertical scroll native. Reserve `touch-action: none` only for
   swipeable cards or carousels, and always pair custom gestures with a visible
   drag affordance. Respect `prefers-reduced-motion` by disabling non-essential
   swipe animations. Never trap vertical scrolling inside a modal or bottom
   sheet unless the content is explicitly a scrollable sub-region.

9. Wire the router. Use a stack router for iOS with a slide-in-from-right
   transition, and a fade or cross-fade transition for Android to match platform
   conventions. Persist scroll position on backward navigation. Manage focus
   explicitly by sending it to the new screen's `h1` on every route change.
   Provide a skip-to-content link as the first focusable element in the DOM for
   keyboard and screen-reader users.

10. Lock the viewport meta tag to `width=device-width, initial-scale=1` as the
    baseline. Only add `maximum-scale=1, user-scalable=no` if the design
    genuinely prevents zoom conflicts, such as a full-screen drawing canvas;
    otherwise preserve user scaling for accessibility. Never disable zoom on
    forms or reading screens.

11. Configure the keyboard behavior. Install `@capacitor/keyboard` and set
    `resize: 'body'` or `resize: 'ionic'` in the plugin configuration so focused
    inputs remain visible above the software keyboard. Never let the keyboard
    obscure the primary action button. Test on both iOS and Android because the
    keyboard resizing behavior differs between platforms.

12. Audit every color and token pair against the craft contrast rules. Verify
    that normal text meets `4.5:1` against its background and that large text
    and icons meet `3:1`. Test both light and dark modes on a physical device
    under sunlight and low brightness. Dark-mode primary and accent colors should
    be slightly desaturated compared to light counterparts to reduce eye strain.

13. Test on a real device or emulator. Verify that every tap target reads at
    least `44 x 44 px` in Chrome DevTools or Safari Web Inspector. Confirm that
    scrolling remains at `60 fps` during list flings. Disable the network and
    verify that the offline banner appears within two seconds and that cached
    views remain usable. Rotate the device and verify that safe-area insets
    recalculate without requiring a full reload.

## Quality bar

A good Capacitor build feels like a native app, not a shrunken website. Every
 tap target must measure at least `44 x 44 px`; anything smaller is a defect.
 Scrolling must remain at `60 fps` with no visible jank. The offline banner and
 skeleton loaders must make network gaps feel intentional, not broken.
 Transitions between screens must complete in under `300 ms` and must never
 leave the user in an unlabeled blank state. The safe-area insets must look
 correct on notched iPhones, gesture-bar Pixels, and classic rectangular screens
 alike. Focus must land logically after every route change and modal close.
 Color contrast must meet WCAG AA on both light and dark modes at every
 brightness level. Never use lorem ipsum, generic placeholder text, or fake
 user avatars in any state. Never generate fake metrics or testimonials without
 verified data sources. Never use emoji as list bullets or section labels.

## Common mistakes

1. Using desktop navigation patterns on mobile. Hamburger menus, hover
   dropdowns, and multi-level sidebars break touch ergonomics. Replace them with
   a bottom tab bar or one-level stack navigation.

2. Setting fixed `paddingTop: 44px` instead of reading
   `env(safe-area-inset-top)`. Hard-coded offsets push content below the notch
   on some devices and into the status bar on others, creating an amateurish
   layout.

3. Forgetting the offline state entirely. A Capacitor app will often launch
   without connectivity; every data-dependent screen must render a meaningful
   empty or cached state instead of an infinite spinner that never resolves.

4. Making tap targets too small or clustering them without separation. Buttons
   that are `32 px` tall, or adjacent icons with only `4 px` between them, cause
   mis-taps and accessibility failures.

5. Blocking the main thread with heavy JavaScript during page transitions.
   Pre-fetch data for the next screen after the current one settles; never delay
   the transition animation to wait on an API call. A stuttering transition
   ruins the native illusion.
