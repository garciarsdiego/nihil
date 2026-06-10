# VENDOR-PLAN.md — Open-Design Runtime Extraction for Nihil

**Source:** https://github.com/nexu-io/open-design  
**Pinned SHA:** `ca22620b4fa03275d57710e3a9c000ec1171002f`  
**License:** Apache-2.0 (extraction permitted with attribution)  
**Target:** `vendor-prep/engine/` in Nihil repository  

---

## 1. Dependency Map

### 1.1 Complete File List to Extract

#### Core Runtime Files (21 files)
```
apps/daemon/src/acp.ts                          (1,237 lines) - ACP protocol handler
apps/daemon/src/runtimes/types.ts               (227 lines)  - Type definitions
apps/daemon/src/runtimes/registry.ts            (72 lines)   - Agent registry
apps/daemon/src/runtimes/detection.ts           (359 lines)  - Agent detection/probing
apps/daemon/src/runtimes/invocation.ts          (42 lines)   - Agent execution wrapper
apps/daemon/src/runtimes/launch.ts              (201 lines)  - Launch resolution
apps/daemon/src/runtimes/env.ts                 (242 lines)  - Spawn environment setup
apps/daemon/src/runtimes/executables.ts         (300 lines)  - Binary resolution
apps/daemon/src/runtimes/capabilities.ts        (3 lines)    - Capability map cache
apps/daemon/src/runtimes/resolution.ts          (12 lines)   - Agent bin resolution
apps/daemon/src/runtimes/auth.ts                (360 lines)  - Auth probing
apps/daemon/src/runtimes/models.ts              (104 lines)  - Model caching/validation
apps/daemon/src/runtimes/metadata.ts            (101 lines)  - Install/docs links
apps/daemon/src/runtimes/diagnostics.ts         (110 lines)  - Diagnostic builders
apps/daemon/src/runtimes/paths.ts               (20 lines)   - Path expansion
apps/daemon/src/runtimes/prompt-budget.ts       (226 lines)  - Windows argv/cmd budget
apps/daemon/src/runtimes/prompt-file.ts         (29 lines)   - Prompt file handling
apps/daemon/src/runtimes/opencode-log.ts        (170 lines)  - OpenCode error recovery
apps/daemon/src/runtimes/mcp.ts                 (22 lines)   - MCP server building
apps/daemon/src/runtimes/mmd-routes.ts          (166 lines)  - Model route resolution
apps/daemon/src/runtimes/local-profiles.ts      (219 lines)  - Local agent profiles
apps/daemon/src/runtimes/terminal-launch.ts     (130 lines)  - Terminal spawning
```

#### Agent Definition Files (23 CLI Defs)
```
apps/daemon/src/runtimes/defs/shared.ts         (47 lines)   - Shared helpers
apps/daemon/src/runtimes/defs/aider.ts
apps/daemon/src/runtimes/defs/amr.ts
apps/daemon/src/runtimes/defs/antigravity.ts
apps/daemon/src/runtimes/defs/claude.ts         (94 lines)
apps/daemon/src/runtimes/defs/codex.ts
apps/daemon/src/runtimes/defs/copilot.ts
apps/daemon/src/runtimes/defs/cursor-agent.ts
apps/daemon/src/runtimes/defs/deepseek.ts
apps/daemon/src/runtimes/defs/devin.ts
apps/daemon/src/runtimes/defs/gemini.ts
apps/daemon/src/runtimes/defs/grok-build.ts
apps/daemon/src/runtimes/defs/hermes.ts
apps/daemon/src/runtimes/defs/kilo.ts
apps/daemon/src/runtimes/defs/kimi.ts
apps/daemon/src/runtimes/defs/kiro.ts
apps/daemon/src/runtimes/defs/opencode.ts
apps/daemon/src/runtimes/defs/pi.ts
apps/daemon/src/runtimes/defs/qoder.ts
apps/daemon/src/runtimes/defs/qwen.ts
apps/daemon/src/runtimes/defs/reasonix.ts      (70 lines)
apps/daemon/src/runtimes/defs/trae-cli.ts
apps/daemon/src/runtimes/defs/vibe.ts
```

#### BYOK Tool Loop
```
apps/daemon/src/byok-tools.ts                   (1,690 lines) - BYOK chat tool definitions
```

**Total:** 45 files, ~5,200 lines of code

### 1.2 Internal Import Graph

#### Within runtimes/ (self-contained)
```
registry.ts
  ├─ imports from: defs/*.ts (all 23 agent defs)
  └─ imports from: local-profiles.ts

detection.ts
  ├─ invocation.ts
  ├─ registry.ts
  ├─ models.ts
  ├─ launch.ts
  ├─ env.ts
  ├─ auth.ts
  ├─ capabilities.ts
  ├─ metadata.ts
  └─ diagnostics.ts

launch.ts
  ├─ executables.ts
  └─ types.ts

env.ts
  ├─ paths.ts
  ├─ executables.ts
  └─ models.ts

executables.ts
  └─ paths.ts

auth.ts
  └─ invocation.ts

models.ts
  └─ types.ts

diagnostics.ts
  ├─ executables.ts
  └─ auth.ts

prompt-budget.ts
  └─ types.ts

prompt-file.ts
  └─ types.ts

opencode-log.ts
  └─ auth.ts

mmd-routes.ts
  ├─ models.ts
  └─ types.ts

local-profiles.ts
  ├─ models.ts
  └─ types.ts

terminal-launch.ts
  └─ (Node.js only)

defs/shared.ts
  ├─ invocation.ts
  ├─ models.ts
  └─ types.ts

defs/claude.ts
  ├─ capabilities.ts
  ├─ shared.ts
  ├─ mmd-routes.ts
  └─ types.ts

defs/reasonix.ts
  ├─ shared.ts
  └─ types.ts

defs/*.ts (other agents)
  └─ types.ts (minimal)
```

#### External imports (to be resolved/stubbed)
```
acp.ts
  ├─ artifact-text-suppression.ts (STRIP - product-specific)
  └─ Node.js: child_process, stream, path

env.ts
  ├─ app-config.ts (STRIP - product-specific)
  ├─ home-expansion.ts (STRIP - product-specific)
  ├─ integrations/vela-profile.ts (STRIP - product-specific)
  ├─ integrations/vela.ts (STRIP - product-specific)
  ├─ project-root.ts (STRIP - product-specific)
  ├─ sandbox-mode.ts (STRIP - product-specific)
  └─ @open-design/platform (STUB or extract)

executables.ts
  ├─ sandbox-mode.ts (STRIP - product-specific)
  └─ @open-design/platform (STUB or extract)

detection.ts
  ├─ integrations/vela.ts (STRIP - product-specific)
  └─ @open-design/contracts (STUB or extract)

diagnostics.ts
  └─ @open-design/contracts (STUB or extract)

defs/shared.ts
  ├─ acp.ts (KEEP - will be in engine/)
  ├─ pi-rpc.ts (STRIP - product-specific)
  └─ @open-design/contracts (STUB or extract)

types.ts
  └─ @open-design/contracts (STUB or extract)

byok-tools.ts
  ├─ connectionTest.ts (STRIP - product-specific)
  ├─ media-config.ts (STRIP - media generation)
  ├─ media-models.ts (STRIP - media generation)
  ├─ projects.ts (STRIP - product-specific)
  ├─ aihubmix.ts (STRIP - media generation)
  ├─ media-adapters/index.ts (STRIP - media generation)
  └─ Node.js: path, fs/promises, crypto
```

### 1.3 External NPM Dependencies

#### Critical Dependencies (must be resolved)
```
@open-design/platform
  - Used in: env.ts, executables.ts
  - Provides: mergeProxyAwareEnv, resolveSystemProxyEnv, wellKnownUserToolchainBins, createCommandInvocation
  - Action: Extract these utilities or create stubs in vendor-prep/engine/stubs/

@open-design/contracts
  - Used in: types.ts, detection.ts, diagnostics.ts, defs/shared.ts
  - Provides: Type definitions (AgentDiagnostic, etc.)
  - Action: Extract type definitions or create local equivalents in vendor-prep/engine/types/

@modelcontextprotocol/sdk
  - Used in: acp.ts (for MCP support)
  - Provides: MCP protocol support
  - Action: Keep as external dependency (add to nihil's package.json)
```

#### Dependencies NOT Used by Runtime
```
better-sqlite3, blake3-wasm, cheerio, chokidar, express, jszip, multer,
node-pty, posthog-node, prom-client, tar, undici
(all product/server-specific - do not add to nihil)
```

---

## 2. Strip List

### 2.1 Entire Files to Remove
```
None - all 45 files are needed for Nihil's BYOK engine
```

### 2.2 Code Sections to Remove

#### From env.ts
```
Lines 54-81: amrAnalyticsIdentityEnv()
  - Telemetry/analytics correlation (posthog-node)
  - STRIP: Remove entire function and its call on line 99

Lines 6-17: Sandbox mode imports
  - applySandboxRuntimeEnv, isSandboxModeEnabled, resolveSandboxRuntimeConfig
  - STRIP: Remove sandbox-mode.js imports and all sandbox-related logic
  - IMPACT: Lines 90, 131, 140, 147, 160, 167, 174, 181, 188
```

#### From detection.ts
```
Line 13: resolveAmrProfile import
  - STRIP: Remove integrations/vela.ts dependency
  - IMPACT: Line 35 (amrModelScopeFromEnv function)

Lines 38-47: withRememberedAmrModels()
  - AMR-specific model caching
  - STRIP: Remove AMR scope resolution, keep generic caching logic
```

#### From executables.ts
```
Lines 45-72: userToolchainDirs() function
  - Sandbox mode handling
  - STRIP: Remove sandbox-mode.js dependency
  - KEEP: wellKnownUserToolchainBins call (from @open-design/platform)
```

#### From acp.ts
```
Line 7: artifact-text-suppression import
  - STRIP: Remove import and createDsmlArtifactTextSuppressor usage
  - IMPACT: Lines 5-6 (import statement)
  - NOTE: ACP protocol itself is product-neutral
```

#### From defs/shared.ts
```
Line 2: parsePiModels import
  - STRIP: Remove pi-rpc.ts dependency (PRODUCT-SPECIFIC)
```

#### From defs/reasonix.ts
```
Lines 4-32: DESIGN_INSTRUCTIONS constant
  - Product-specific artifact/design system instructions
  - STRIP: Remove or replace with generic instructions
  - IMPACT: Line 61 (env injection)
```

#### From byok-tools.ts
```
Media generation tools (lines ~200-800):
  - image generation, video generation, speech generation
  - Depends on media-config, media-models, aihubmix, media-adapters
  - STRIP: Remove these tool definitions
  - KEEP: Core BYOK chat tools (file operations, web search, etc.)
```

---

## 3. Preserve List (Windows-Specific)

### 3.1 Critical Windows Handling

#### prompt-budget.ts (Lines 37-95)
```
quoteForWindowsCmdShim()
  - Escapes % for cmd.exe percent-expansion
  - Mirrors libuv's quote_cmd_arg for CreateProcess
  - Why: Prevents env-var leakage in prompts (e.g., %DEEPSEEK_API_KEY% expansion)
  - Usage: Validates argv budget on Windows .cmd shims

quoteForWindowsDirectExe()
  - Mirrors libuv's quote_cmd_arg for CreateProcess
  - Why: Windows command-line argument escaping
  - Usage: Direct exe invocation on Windows
```

#### prompt-budget.ts (Lines 97-226)
```
checkWindowsCmdShimCommandLineBudget()
  - 32KB cmd.exe limit validation
  - Why: Windows has hard limits on command-line length
  - Usage: Prevents spawn ENAMETOOLONG errors

checkWindowsDirectExeCommandLineBudget()
  - CreateProcess 32KB limit
  - Why: Windows direct exe invocation limits
  - Usage: Prevents spawn ENAMETOOLONG errors

sanitizeCustomModel()
  - Prevents flag injection
  - Why: Security for custom model parameters
```

#### launch.ts (Lines 64-85)
```
applyAgentLaunchEnv()
  - Case-insensitive PATH handling
  - Why: Windows uses Path not PATH; Node's env accessor is case-insensitive
  - Usage: Ensures PATH prepends work on Windows
```

#### executables.ts (Lines 1-100)
```
PATH delimiter handling
  - : on Unix, ; on Windows
  - Why: Binary resolution must work on both platforms
  - Usage: Resolves agent binaries from PATH
```

#### opencode-log.ts (Lines 23-31)
```
resolveOpenCodeLogDir()
  - XDG_DATA_HOME / HOME resolution
  - Why: OpenCode logs are platform-specific; Windows uses %APPDATA% equivalent
  - Usage: Recovers provider errors from OpenCode's session logs
```

#### terminal-launch.ts (Lines 89-130)
```
launchOnWindows()
  - cmd.exe terminal spawning
  - Why: Cross-platform terminal launch for OAuth flows
  - Usage: Opens terminal for antigravity auth
```

### 3.2 argv Budget Handling (PRESERVE)
```
prompt-budget.ts:
  - checkPromptArgvBudget() - Generic argv size check
  - checkWindowsCmdShimCommandLineBudget() - Windows .cmd shim limit
  - checkWindowsDirectExeCommandLineBudget() - Windows direct exe limit
  - sanitizeCustomModel() - Prevents flag injection
```

### 3.3 opencode-log Recovery (PRESERVE)
```
opencode-log.ts:
  - readLatestOpenCodeLogTail() - Reads OpenCode's session logs
  - extractOpenCodeServiceFailure() - Parses provider errors
  - readOpenCodeServiceFailure() - Convenience wrapper

Why: OpenCode swallows provider errors in headless mode; log inspection
     is the only way to distinguish "usage limit" from "timeout"
```

---

## 4. Adaptation Notes

### 4.1 Configuration Style

**Nihil's approach:** Tauri configuration in app-data directory, SQLite + Drizzle  
**Open-design's approach:** Custom app-config.ts, home-expansion.ts, project-root.ts  

**Adaptation required:**
- Remove app-config.ts, home-expansion.ts, project-root.ts dependencies
- Replace with Nihil's config system (Tauri's tauri::api::path::app_data_dir)
- Create `vendor-prep/engine/config.ts` that reads from Nihil's SQLite settings

### 4.2 Logging

**Nihil's approach:** Structured logging via Winston or similar (to be decided)  
**Open-design's approach:** Custom logging integration  

**Adaptation required:**
- Replace any open-design logging calls with Nihil's logger
- Ensure error taxonomy aligns with `apps/daemon/src/engine/errors.ts` (to be created)

### 4.3 Error Taxonomy Alignment

**Nihil's EngineError** (from `apps/daemon/src/engine/errors.ts`, shipped in commit e8c6552):
```ts
export type EngineErrorKind =
  | "auth"      // 401/403 — terminal
  | "not_found" // 404 — terminal (bad model or base URL)
  | "rate_limit" // 429 — retryable
  | "server"    // 5xx — retryable
  | "client"    // other 4xx — terminal
  | "network"   // DNS/TLS/connect/timeout — retryable
  | "malformed" // unparseable SSE/JSON — terminal
  | "provider"  // inline error object in the stream — terminal
  | "aborted";  // user abort — not surfaced as an error

export class EngineError extends Error {
  readonly kind: EngineErrorKind;
  readonly status?: number;
  readonly retryable: boolean;
  // ...
}
```

**Event Mapping Table (from architecture session):**

| Open-Design Event | Nihil EngineEvent | Notes |
|-------------------|-------------------|-------|
| ACP text delta | `{ type: "text"; delta: string }` | Streamed response chunks |
| ACP session done | `{ type: "done"; finishReason: EngineFinishReason }` | Session completion |
| ACP file edit | *Not emitted as event* | ACP mode: `editsViaProtocol: false` (agent applies edits itself) |
| BYOK tool call | *M2 future: `{ type: "tool_call"; ... }`* | Not in M1 surface |
| Open-design error | **Thrown as EngineError** | Errors are thrown, not emitted as events |

**Adaptation required:**
- ACP mode (`editsViaProtocol: false`): Open-design ACP session emits text deltas → map to `{ type: "text"; delta: string }`
- Session completion → map to `{ type: "done"; finishReason: "stop" | "length" | ... }`
- **Errors are thrown as EngineError**, not emitted as events
  - Map open-design auth failures → `new EngineError("auth", ...)`
  - Map open-design rate limits → `new EngineError("rate_limit", ...)`
  - Map open-design network errors → `new EngineError("network", ...)`
  - Use `classifyHttpStatus()` and `classifyFetchError()` helpers from errors.ts
- File edits: In ACP mode, the agent applies edits directly (supervised by host), so no file-change events are emitted
- M2 will add tool_call/file_change/thinking event variants (forward-compatible)

### 4.4 Nihil Engine Interface Implementation

**Nihil's Engine interface** (from `apps/daemon/src/engine/types.ts`, shipped in commit e8c6552):
```ts
export interface Engine {
  readonly capabilities: EngineCapabilities;
  stream(request: EngineRequest, opts?: { signal?: AbortSignal }): AsyncIterable<EngineEvent>;
}

export interface EngineCapabilities {
  /** mode 2 (BYOK): the model emits <nihil-*> tags the host parses and applies.
   * mode 1 (ACP, M2): the agent applies edits itself; the host supervises. */
  editsViaProtocol: boolean;
}

export interface EngineRequest {
  system: string;
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
}

export type EngineEvent =
  | { type: "text"; delta: string }
  | { type: "done"; finishReason: EngineFinishReason };
```

Create `vendor-prep/engine/index.ts` that implements Nihil's Engine interface:

```ts
import { ACPClient } from './acp'
import { detectAgent } from './runtimes/detection'
import { launchAgent } from './runtimes/launch'
import type { Engine, EngineRequest, EngineEvent } from '../../../types'
import { EngineError, classifyHttpStatus, classifyFetchError } from '../../../errors'

export class OpenDesignEngine implements Engine {
  readonly capabilities = {
    editsViaProtocol: false, // ACP mode: agent applies edits itself
  }

  async *stream(request: EngineRequest, opts?: { signal?: AbortSignal }): AsyncIterable<EngineEvent> {
    // Detect CLI from config
    const agent = await detectAgent(/* config from request */)
    
    // Launch agent
    const session = await launchAgent(agent, /* config */)
    
    // Stream ACP session events as EngineEvent
    try {
      for await (const event of session.stream()) {
        if (opts?.signal?.aborted) {
          throw new EngineError("aborted", "request aborted")
        }
        
        // Map ACP text delta to EngineEvent
        if (event.type === 'text') {
          yield { type: "text", delta: event.delta }
        }
        
        // Map ACP session done to EngineEvent
        if (event.type === 'done') {
          yield { type: "done", finishReason: event.finishReason }
        }
      }
    } catch (error) {
      // Convert open-design errors to EngineError
      if (isAuthError(error)) {
        throw new EngineError("auth", error.message, { cause: error })
      }
      if (isRateLimitError(error)) {
        throw new EngineError("rate_limit", error.message, { cause: error })
      }
      if (isNetworkError(error)) {
        throw classifyFetchError(error)
      }
      throw new EngineError("provider", error.message, { cause: error })
    }
  }
}
```

---

## 5. Known Gaps

### 5.1 External Package Dependencies

**@open-design/platform**
- Functions needed: mergeProxyAwareEnv, resolveSystemProxyEnv, wellKnownUserToolchainBins, createCommandInvocation
- Gap: These are workspace packages in open-design, not published to npm
- Resolution: Extract these utilities to `vendor-prep/engine/stubs/platform.ts`

**@open-design/contracts**
- Types needed: AgentDiagnostic, and related type definitions
- Gap: Workspace package, not published to npm
- Resolution: Extract type definitions to `vendor-prep/engine/types/contracts.ts`

### 5.2 Missing Nihil-Side Pieces

**apps/daemon/src/engine/types.ts**
- ✅ **Already exists on main** (shipped in Task 4 commit e8c6552)
- Contains: Engine interface, EngineEvent, EngineCapabilities, EngineRequest
- ACP mode: `editsViaProtocol: false` (agent applies edits itself)
- Event surface: `{ type: "text"; delta: string } | { type: "done"; finishReason: EngineFinishReason }`
- Resolution: Import from `../../../types` in vendor-prep/engine/index.ts

**apps/daemon/src/engine/errors.ts**
- ✅ **Already exists on main** (shipped in Task 4 commit e8c6552)
- Contains: EngineError class, EngineErrorKind, classification helpers
- Helpers: `classifyHttpStatus()`, `classifyFetchError()`, `redactSecrets()`, `extractErrorDetail()`
- Resolution: Import from `../../../errors` in vendor-prep/engine/index.ts

**Configuration system**
- Gap: Nihil's Tauri config not yet implemented
- Resolution: Create stub config in vendor-prep/engine/config.ts for now

### 5.3 BYOK Tool Adaptation

**Media generation tools**
- Gap: byok-tools.ts includes image/video/speech generation that depends on media-config, media-models, aihubmix
- Resolution: Strip these tools from byok-tools.ts; keep core file/web tools only

**Connection testing**
- Gap: byok-tools.ts depends on connectionTest.ts for endpoint validation
- Resolution: Create simple stub that does basic HTTP reachability check

### 5.4 TypeScript Compilation

**Expected compilation errors after extraction:**
1. Missing @open-design/platform imports → Will create stubs
2. Missing @open-design/contracts imports → Will extract types
3. Missing sandbox-mode.ts imports → Will strip all references
4. Missing product-specific imports (app-config, home-expansion, etc.) → Will strip
5. Type mismatches with Nihil's Engine interface → Will adapt in index.ts

**Documentation plan:** Record each compilation error in VENDOR-PLAN.md "Known gaps" section after dry-run

---

## 6. Integration Steps

### Step 1: Extract and Stub External Dependencies
1. Extract @open-design/platform utilities to `vendor-prep/engine/stubs/platform.ts`
2. Extract @open-design/contracts types to `vendor-prep/engine/types/contracts.ts`
3. Create `vendor-prep/engine/config.ts` as config stub for Nihil

### Step 2: Copy Runtime Files
1. Create directory structure: `vendor-prep/engine/runtimes/defs/`
2. Copy all 45 files from open-design
3. Add Apache-2.0 attribution header to each file
4. Apply strip list (remove product-specific code sections)

### Step 3: Rewire Imports
1. Update internal imports to use relative paths within vendor-prep/engine/
2. Replace @open-design/platform imports with ./stubs/platform
3. Replace @open-design/contracts imports with ./types/contracts
4. Remove sandbox-mode.ts, app-config.ts, home-expansion.ts, etc. imports

### Step 4: Create Nihil Engine Adapter
1. Create `vendor-prep/engine/index.ts` implementing Nihil's Engine interface
2. Create `vendor-prep/engine/types.ts` with EngineEvent mapping
3. Create `vendor-prep/engine/errors.ts` with error taxonomy
4. Map ACP session events to EngineEvent union

### Step 5: Best-Effort Compilation
1. Run `tsc --noEmit` in vendor-prep/engine/
2. Document all remaining compilation errors in "Known gaps"
3. Create minimal stubs for missing Nihil-side pieces

### Step 6: Documentation
1. Create `vendor-prep/engine/VENDOR.md` with SHA and file list
2. Create `vendor-prep/engine/NOTICE-draft.md` with attribution
3. Update this VENDOR-PLAN.md with actual compilation errors

### Step 7: Verification
1. Verify all files have attribution header (grep verify)
2. Verify git diff shows only vendor-prep/** changes
3. Verify no non-Apache/MIT code was pulled in

---

## 7. Mechanical Cleanup

### BOM Removal
- **Action completed (2026-06-10):** Stripped U+FEFF BOM from all vendored TypeScript files
- **Reason:** BOMs can cause issues with tooling and are not needed for UTF-8 files
- **Method:** Read all files with UTF-8 encoding (without BOM) and rewrite
- **Files affected:** All 44 vendored TypeScript files

### CRLF→LF Normalization
- **Action:** Configured via `.gitattributes` in the nihil repository
- **Reason:** Consistent line endings across platforms (Unix-style LF)
- **Configuration:** The nihil repo has `.gitattributes` that normalizes text files to LF on commit
- **Impact:** All vendored files will be normalized to LF when committed

### File Count Updates
- **Action completed (2026-06-10):** Removed 2 files per architecture review
  - `runtimes/defs/amr.ts` (open-design model-router product concern)
  - `runtimes/mmd-routes.ts` (open-design model-router product concern)
- **Updated count:** 46 → 44 files
- **Documentation:** Updated VENDOR.md and VENDOR-PLAN.md to reflect new count

### Architecture Review Updates (2026-06-10)
- **Rewrote §4.3:** Updated error taxonomy alignment to use real EngineError from main (commit e8c6552)
- **Rewrote §4.4:** Updated Engine interface implementation to use real Engine surface (stream() AsyncIterable, capabilities.editsViaProtocol:false)
- **Rewrote §5.2:** Updated missing pieces section to reflect that types.ts and errors.ts already exist on main
- **Added event mapping table:** Documented how open-design events map to Nihil EngineEvent

---

## 8. Estimated M2 Effort

**Extraction and dry-run:** 1 day (this lane)  
**M2 implementation:** 3-5 days

### M2 Implementation Breakdown
1. **Day 1:** Complete external dependency stubs, resolve all compilation errors
2. **Day 2:** Implement Nihil Engine interface adapter, event mapping
3. **Day 3:** Integrate with Nihil's config system, error taxonomy
4. **Day 4:** Testing on Windows (argv budget, PATH handling, OpenCode log recovery)
5. **Day 5:** Polish, documentation, NOTICE update

---

## 9. Flags

### Out-of-Lane Changes Required

**None for this lane** - All work stays within vendor-prep/**

### Future Work (Out-of-Lane for M2)

1. **apps/daemon/src/engine/types.ts** - ✅ Already exists on main (commit e8c6552)
2. **apps/daemon/src/engine/errors.ts** - ✅ Already exists on main (commit e8c6552)
3. **Configuration system** - Integrate with Tauri's app-data directory
4. **Logging system** - Integrate with Nihil's structured logging
5. **CLI detection UI** - First-run detection screen in desktop app

### Design Decisions Needed

1. **MCP support** - Keep @modelcontextprotocol/sdk or remove ACP MCP support?
2. **BYOK media tools** - Should Nihil support image/video generation in BYOK mode?
3. **Proxy configuration** - How should Nihil handle proxy settings for CLI agents?

---

## 10. Attribution

**Source Repository:** https://github.com/nexu-io/open-design  
**Pinned Commit:** ca22620b4fa03275d57710e3a9c000ec1171002f  
**License:** Apache-2.0  
**Extraction Date:** 2026-06-10  
**Extracted Modules:** Runtime system (ACP client, agent detection/launch/execution, BYOK tool loop)

**Apache-2.0 License Compliance:**
- ✅ Extraction permitted with attribution
- ✅ All extracted files will include header: `// Vendored from nexu-io/open-design @ ca22620b4fa03275d57710e3a9c000ec1171002f — Apache-2.0, see NOTICE`
- ✅ NOTICE file will be updated at merge time
- ✅ No non-Apache/MIT vendored code detected in extracted modules