# Dry-Run Extraction Summary

## Extraction Completed Successfully ✓

**Source:** nexu-io/open-design @ ca22620b4fa03275d57710e3a9c000ec1171002f
**Target:** nihil/vendor-prep/engine/
**Date:** 2026-06-10
**License:** Apache-2.0

## Files Copied

### Core Runtime Files (22)
- acp.ts (43 KB)
- runtimes/types.ts
- runtimes/registry.ts
- runtimes/detection.ts
- runtimes/invocation.ts
- runtimes/launch.ts
- runtimes/env.ts
- runtimes/executables.ts
- runtimes/capabilities.ts
- runtimes/resolution.ts
- runtimes/auth.ts
- runtimes/models.ts
- runtimes/metadata.ts
- runtimes/diagnostics.ts
- runtimes/paths.ts
- runtimes/prompt-budget.ts
- runtimes/prompt-file.ts
- runtimes/opencode-log.ts
- runtimes/mcp.ts
- runtimes/mmd-routes.ts
- runtimes/local-profiles.ts
- runtimes/terminal-launch.ts

### Agent Definition Files (23)
- runtimes/defs/shared.ts
- runtimes/defs/aider.ts
- runtimes/defs/amr.ts
- runtimes/defs/antigravity.ts
- runtimes/defs/claude.ts
- runtimes/defs/codex.ts
- runtimes/defs/copilot.ts
- runtimes/defs/cursor-agent.ts
- runtimes/defs/deepseek.ts
- runtimes/defs/devin.ts
- runtimes/defs/gemini.ts
- runtimes/defs/grok-build.ts
- runtimes/defs/hermes.ts
- runtimes/defs/kilo.ts
- runtimes/defs/kimi.ts
- runtimes/defs/kiro.ts
- runtimes/defs/opencode.ts
- runtimes/defs/pi.ts
- runtimes/defs/qoder.ts
- runtimes/defs/qwen.ts
- runtimes/defs/reasonix.ts
- runtimes/defs/trae-cli.ts
- runtimes/defs/vibe.ts

### BYOK Tool Loop (1)
- byok-tools.ts (75 KB)

**Total Runtime Files Copied: 46**

## Stub Files Created (3)

### External Dependency Stubs
- stubs/platform.ts - Stub for @open-design/platform
- types/contracts.ts - Stub for @open-design/contracts
- config.ts - Stub for Nihil configuration

## Documentation Files Created (1)

- FILE_LIST.md - Complete file inventory with attribution

## Directory Structure Created

```
vendor-prep/engine/
├── acp.ts
├── byok-tools.ts
├── config.ts
├── FILE_LIST.md
├── EXTRACTION_SUMMARY.md
├── runtimes/
│   ├── types.ts
│   ├── registry.ts
│   ├── detection.ts
│   ├── invocation.ts
│   ├── launch.ts
│   ├── env.ts
│   ├── executables.ts
│   ├── capabilities.ts
│   ├── resolution.ts
│   ├── auth.ts
│   ├── models.ts
│   ├── metadata.ts
│   ├── diagnostics.ts
│   ├── paths.ts
│   ├── prompt-budget.ts
│   ├── prompt-file.ts
│   ├── opencode-log.ts
│   ├── mcp.ts
│   ├── mmd-routes.ts
│   ├── local-profiles.ts
│   ├── terminal-launch.ts
│   └── defs/
│       ├── shared.ts
│       ├── aider.ts
│       ├── amr.ts
│       ├── antigravity.ts
│       ├── claude.ts
│       ├── codex.ts
│       ├── copilot.ts
│       ├── cursor-agent.ts
│       ├── deepseek.ts
│       ├── devin.ts
│       ├── gemini.ts
│       ├── grok-build.ts
│       ├── hermes.ts
│       ├── kilo.ts
│       ├── kimi.ts
│       ├── kiro.ts
│       ├── opencode.ts
│       ├── pi.ts
│       ├── qoder.ts
│       ├── qwen.ts
│       ├── reasonix.ts
│       ├── trae-cli.ts
│       └── vibe.ts
├── stubs/
│   └── platform.ts
└── types/
    └── contracts.ts
```

## Attribution Headers

All 46 runtime files include the following header at the top:
```
// Vendored from nexu-io/open-design @ ca22620b4fa03275d57710e3a9c000ec1171002f — Apache-2.0, see NOTICE
```

## Verification

✓ Original open-design repository not modified (git status: clean)
✓ All 46 runtime files copied with attribution headers
✓ Directory structure created as specified
✓ Stub files created for external dependencies
✓ FILE_LIST.md documentation created
✓ Zero errors encountered during extraction

## Next Steps

This is a **dry-run extraction** - no code has been stripped or modified. The files are exact copies from the source with attribution headers added. The next phase would involve:

1. Analyzing dependencies and import statements
2. Creating proper implementations for stub files
3. Stripping or adapting code that depends on open-design internal packages
4. Updating import paths to use Nihil's package structure
5. Testing and validation

## Notes

- The acp.ts file imports from './artifact-text-suppression.js' which is not in the extraction list. This dependency will need to be either extracted or stubbed in the next phase.
- Several files import from '@open-design/contracts' and '@open-design/platform' - these are addressed with stub files but will need proper implementations.
- No code modifications were made during this dry-run - this is purely a copy operation with header additions.