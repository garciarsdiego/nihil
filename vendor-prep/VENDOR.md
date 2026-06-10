# VENDOR.md — Open-Design Runtime Attribution

**Source Repository:** https://github.com/nexu-io/open-design  
**Pinned Commit:** `ca22620b4fa03275d57710e3a9c000ec1171002f`  
**License:** Apache-2.0  
**Extraction Date:** 2026-06-10  
**Purpose:** Vendor agent runtime (ACP client + CLI registry + BYOK loop) for Nihil M2

---

## Files Extracted (46 total)

### Core Runtime Files (22)
```
vendor-prep/engine/acp.ts
vendor-prep/engine/runtimes/types.ts
vendor-prep/engine/runtimes/registry.ts
vendor-prep/engine/runtimes/detection.ts
vendor-prep/engine/runtimes/invocation.ts
vendor-prep/engine/runtimes/launch.ts
vendor-prep/engine/runtimes/env.ts
vendor-prep/engine/runtimes/executables.ts
vendor-prep/engine/runtimes/capabilities.ts
vendor-prep/engine/runtimes/resolution.ts
vendor-prep/engine/runtimes/auth.ts
vendor-prep/engine/runtimes/models.ts
vendor-prep/engine/runtimes/metadata.ts
vendor-prep/engine/runtimes/diagnostics.ts
vendor-prep/engine/runtimes/paths.ts
vendor-prep/engine/runtimes/prompt-budget.ts
vendor-prep/engine/runtimes/prompt-file.ts
vendor-prep/engine/runtimes/opencode-log.ts
vendor-prep/engine/runtimes/mcp.ts
vendor-prep/engine/runtimes/mmd-routes.ts
vendor-prep/engine/runtimes/local-profiles.ts
vendor-prep/engine/runtimes/terminal-launch.ts
```

### Agent Definition Files (23)
```
vendor-prep/engine/runtimes/defs/shared.ts
vendor-prep/engine/runtimes/defs/aider.ts
vendor-prep/engine/runtimes/defs/amr.ts
vendor-prep/engine/runtimes/defs/antigravity.ts
vendor-prep/engine/runtimes/defs/claude.ts
vendor-prep/engine/runtimes/defs/codex.ts
vendor-prep/engine/runtimes/defs/copilot.ts
vendor-prep/engine/runtimes/defs/cursor-agent.ts
vendor-prep/engine/runtimes/defs/deepseek.ts
vendor-prep/engine/runtimes/defs/devin.ts
vendor-prep/engine/runtimes/defs/gemini.ts
vendor-prep/engine/runtimes/defs/grok-build.ts
vendor-prep/engine/runtimes/defs/hermes.ts
vendor-prep/engine/runtimes/defs/kilo.ts
vendor-prep/engine/runtimes/defs/kimi.ts
vendor-prep/engine/runtimes/defs/kiro.ts
vendor-prep/engine/runtimes/defs/opencode.ts
vendor-prep/engine/runtimes/defs/pi.ts
vendor-prep/engine/runtimes/defs/qoder.ts
vendor-prep/engine/runtimes/defs/qwen.ts
vendor-prep/engine/runtimes/defs/reasonix.ts
vendor-prep/engine/runtimes/defs/trae-cli.ts
vendor-prep/engine/runtimes/defs/vibe.ts
```

### BYOK Tool Loop (1)
```
vendor-prep/engine/byok-tools.ts
```

### Stub Files (3)
```
vendor-prep/engine/stubs/platform.ts
vendor-prep/engine/types/contracts.ts
vendor-prep/engine/config.ts
```

---

## Attribution Headers

All extracted files include the following header as the first line:

```
// Vendored from nexu-io/open-design @ ca22620b4fa03275d57710e3a9c000ec1171002f — Apache-2.0, see NOTICE
```

**Verification:**
```bash
cd vendor-prep/engine
find . -name "*.ts" -exec grep -l "Vendored from nexu-io/open-design" {} \;
```

Expected result: All 46 TypeScript files should contain the attribution header.

---

## License Compliance

**Apache-2.0 License:**
- ✅ Extraction permitted with attribution
- ✅ All files include attribution headers
- ✅ NOTICE file will be updated at merge time (see NOTICE-draft.md)
- ✅ No non-Apache/MIT vendored code detected in extracted modules

**Original License:**
- Source repository: https://github.com/nexu-io/open-design
- License file: https://github.com/nexu-io/open-design/blob/main/LICENSE
- License type: Apache-2.0

---

## Sync Process

To update this vendored code in the future:

1. **Pin a new commit** from open-design main branch
2. **Update this file** with the new SHA
3. **Re-extract files** following the same process
4. **Update attribution headers** with the new SHA
5. **Run diff** against the previous pinned commit to understand changes
6. **Update VENDOR-PLAN.md** with any new dependencies or strip requirements
7. **Update NOTICE** with any new attribution requirements

**Never blind-pull from open-design.** Always diff against the pinned commit to understand what changed.

---

## Modifications Made

### Dry-Run Phase (Current)
- Files copied without modification (except attribution headers)
- Stub files created for external dependencies
- No product-specific code stripped yet (deferred to M2 implementation)

### Planned Modifications (M2 Implementation)
- Strip telemetry/analytics code (see VENDOR-PLAN.md §2)
- Strip sandbox-mode dependencies
- Strip media generation tools from byok-tools.ts
- Rewire imports to use relative paths
- Implement Nihil Engine interface adapter
- Align error taxonomy with Nihil's error handling

See `vendor-prep/VENDOR-PLAN.md` for detailed modification plan.

---

## Contact

**Questions about this vendoring:**
- Nihil repository: https://github.com/garciarsdiego/nihil
- Branch: lane/vendor-prep
- Issue tracker: https://github.com/garciarsdiego/nihil/issues

**Source repository:**
- https://github.com/nexu-io/open-design
- https://github.com/nexu-io/open-design/commit/ca22620b4fa03275d57710e3a9c000ec1171002f