# NOTICE-draft.md — Attribution Update for M2 Vendoring

**This is a draft.** Merge this into the root NOTICE file when completing M2 vendoring.

---

## Proposed NOTICE Content (Replace open-design section)

```
Nihil
Copyright 2026 Diego Garcia (garciarsdiego)

This product includes patterns and/or vendored code derived from the
following Apache-2.0 and MIT licensed projects:

- open-design (nexu-io) — Apache-2.0 — agent runtime (ACP client, CLI
  registry, BYOK loop) vendored under vendor-prep/engine/
  Source: https://github.com/nexu-io/open-design
  Commit: ca22620b4fa03275d57710e3a9c000ec1171002f
  Files: 46 TypeScript modules (acp.ts, runtimes/, byok-tools.ts)
  License: https://github.com/nexu-io/open-design/blob/main/LICENSE
- open-lovable (Firecrawl) — MIT — cloud sandbox provider factory pattern
- bolt.new (StackBlitz) — MIT — streaming message-parser/action-runner pattern
- dyad (dyad-sh) — Apache-2.0 — architecture patterns (tag protocol,
  local execution, git versioning). Nothing derived from dyad's src/pro/.

System prompts are original works informed by published pattern analysis.
No code derived from AGPL-licensed projects.
```

---

## Changes from Current NOTICE

### Before:
```
- open-design (nexu-io) — Apache-2.0 — agent runtime (ACP client, CLI
  registry, BYOK loop) vendoring planned under apps/daemon/src/engine/
```

### After:
```
- open-design (nexu-io) — Apache-2.0 — agent runtime (ACP client, CLI
  registry, BYOK loop) vendored under vendor-prep/engine/
  Source: https://github.com/nexu-io/open-design
  Commit: ca22620b4fa03275d57710e3a9c000ec1171002f
  Files: 46 TypeScript modules (acp.ts, runtimes/, byok-tools.ts)
  License: https://github.com/nexu-io/open-design/blob/main/LICENSE
```

**Changes:**
- Updated path from `apps/daemon/src/engine/` to `vendor-prep/engine/`
- Added source repository URL
- Added pinned commit SHA
- Added file count and module summary
- Added license URL

---

## Apache-2.0 License Compliance

**Attribution Requirements Met:**
- ✅ Copyright notice preserved (in attribution headers)
- ✅ License copy included (link to source LICENSE)
- ✅ NOTICE file updated with attribution
- ✅ Source repository URL provided
- ✅ Commit SHA pinned for reproducibility

**Modifications:**
- Product-specific code (telemetry, sandbox-mode, media generation) will be stripped during M2 implementation
- Core runtime functionality (ACP, CLI detection, BYOK) preserved
- All modifications comply with Apache-2.0 §2(b) (prominent notice of changes)

---

## Instructions for Merge

When completing M2 vendoring and moving from `vendor-prep/` to `apps/daemon/src/engine/`:

1. Update the path in NOTICE from `vendor-prep/engine/` to `apps/daemon/src/engine/`
2. Verify the commit SHA is still correct
3. Update file count if any files were added/removed during implementation
4. Keep this NOTICE-draft.md as documentation of the vendoring process
5. Commit the NOTICE update with the vendoring changes

---

## Additional Attributions (Future)

If additional vendoring is needed from open-design in the future:

1. Pin the new commit SHA
2. Update this NOTICE-draft.md with the new SHA
3. Document any additional files extracted
4. Update the NOTICE file during merge

See `vendor-prep/VENDOR.md` for the complete sync process.