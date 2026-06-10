# iframe-lite Feasibility Report

**Date:** 2026-06-10  
**Spike:** Tier-0 React preview via in-browser esbuild + sandboxed iframe  
**Branch:** lane/hardening

## 1. What works

### TSX Compilation
- **esbuild-wasm** (0.24.0 via esm.sh CDN) compiles TSX in the browser.
- A custom plugin resolves imports from an in-memory FileMap (no server needed).
- Compilation time for a small 3-file React project: **~80-150ms**.
- CSS files are injected via inline `<style>` element through the plugin (no PostCSS).

### Bundle Approach
- Single ESM bundle output from esbuild with `format: "esm"`.
- React served via **esm.sh** CDN import maps — no npm install, no node_modules.
- esbuild's `write: false` + `outputFiles` gives us the bundle text in memory.

### Error Display
- Compile errors caught and displayed inline in the status bar.
- Stack traces forwarded; syntax errors show file + line (esbuild quality).

### Rendering
- `iframe.srcdoc` used for sandboxed rendering.
- Import map injected into the HTML template.
- React 18 `createRoot` works end-to-end.

## 2. Hard limits found

### Tailwind v4
- **Tailwind v4 Play CDN** (https://tailwindcss.com/docs/installation/play-cdn) works
  as a fallback — add a `<script src="https://cdn.tailwindcss.com">` tag to the
  iframe HTML. This compiles utility classes on-the-fly in the browser.
- **Full Tailwind v4 build pipeline is NOT viable in-browser** without a PostCSS
  + Node.js build step. The Play CDN covers the "landing page" use case.
- If the user project has `tailwind.config.js`, it must be passed to
  `tailwind.config = {...}` before the CDN script.

### npm deps beyond CDN
- Only packages available on **esm.sh** or similar ESM CDNs work.
- No npm install, no node_modules, no native modules.
- Fallback: a curated "approved deps" list with CDN URLs would be needed for M2.

### HMR
- **No HMR.** Full reload is the only option.
- For Tier-0 landing pages, full reload is acceptable (compile time is ~100ms).
- For a real dev loop, a WebSocket-based HMR would need the daemon.

### Sandbox attributes
- `sandbox="allow-scripts"` is sufficient for rendering.
- `allow-same-origin` is NOT set (security boundary).
- `allow-forms`, `allow-popups`, `allow-modals` may be needed for
  interactive components but are omitted for Tier-0.

### Other limits
- CSS Modules not supported (needs esbuild CSS plugin or PostCSS).
- SVG/asset imports as URLs not supported (needs a plugin).
- No source maps in the sandboxed iframe.
- Browser must support import maps (Chrome 89+, Edge 89+, Firefox 108+).

## 3. Recommendation for M2

**Viable as Tier-0 for landing pages?** Yes, with constraints.

### Exact constraints
| Concern | Constraint |
|---|---|
| CSS | Plain CSS or Tailwind Play CDN only. No PostCSS, no CSS modules. |
| Dependencies | esm.sh CDN only. A manual approved-deps list required. |
| TypeScript | Compiles (esbuild strips types), but no type checking in preview. |
| File count | Tested up to ~20 files; esbuild-wasm can handle hundreds. |
| Bundle size | No code splitting; single bundle. Fine for landing pages. |
| HMR | Full reload only (acceptable for Tier-0). |
| Security | iframe sandbox with allow-scripts only. |

### Estimated integration effort
- **Integrating into daemon:** 1-2 days.
  - The daemon must serve `spikes/iframe-lite/index.html` (or embed its logic).
  - FileMap is the same data structure the protocol produces.
  - Replace the static FileMap JSON with live protocol output.
  - Add a WebSocket to push FileMap updates for "live preview" on each turn.
- **Productionizing:** 2-3 days.
  - Add error overlay instead of status bar text.
  - Add Tailwind Play CDN auto-detection.
  - Add loading spinner during esbuild init.

## 4. How to run

```bash
# Serve the spike directory with any static server:
cd spikes/iframe-lite
npx serve .          # or: python3 -m http.server 8080
# Open http://localhost:3000 (or :8080)
```

Click "Compile & Render" to see the default React app rendered in the preview iframe.
Edit the FileMap JSON in the left panel to change files.

## 5. Open questions for M2

1. Should the daemon pre-bundle esbuild-wasm for offline use (airgap support)?
2. Can we add a lightweight TypeScript checker (e.g., async ts-worker) post-compile?
3. Does the daemon need to strip `set(env, ...)` calls from previewed code (security)?
