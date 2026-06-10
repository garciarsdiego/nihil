/**
 * First real-model smoke (M1, mode 2 / BYOK through OmniRoute).
 *
 * Runs five eval items from evals/corpus through the real turn loop
 * (engine -> parser -> runner -> git) against a fresh copy of the
 * vite-react-shadcn template, and prints per-turn metrics. Measurement only —
 * NO prompt tuning here.
 *
 * Reads engine config from the environment (NIHIL_ENGINE_BASE_URL /
 * _API_KEY / _MODEL). The API key is NEVER hardcoded here and NEVER printed:
 * the harness scans every captured string for the literal key and flags a leak.
 *
 *   Run:  (env set)  npx tsx scripts/smoke-e2e.ts
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NihilStreamParser, type NihilAction, type ProtocolError } from "@nihil/protocol";
import { ProjectRunner } from "../src/agent/runner.js";
import { ByokEngine } from "../src/engine/byok.js";
import { loadEngineConfig } from "../src/engine/config.js";
import { createSession } from "../src/engine/session.js";
import { runTurn } from "../src/engine/turn.js";
import { LocalProcessTarget } from "../src/exec/local-process.js";
import { SystemGitBackend } from "../src/git/transaction.js";

const templatesDir = fileURLToPath(new URL("../../../packages/templates", import.meta.url));
const TEMPLATE = "vite-react-shadcn";

/** Raw (key-redacted) assistant output per item, for the report's evidence. */
const rawByItem: Record<string, string> = {};

/** Prose-level elision signals. Deliberately avoids bare "..." (spread/rest params). */
const ELISION_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "// ... line", re: /(^|\n)\s*\/\/\s*\.\.\.(\s|$)/ },
  { name: "{/* ... */}", re: /\{\s*\/\*\s*\.\.\.\s*\*\/\s*\}/ },
  { name: "rest of the file/code", re: /\brest of (the )?(file|code|component|imports)\b/i },
  { name: "keep/leave existing", re: /\b(keep|leave)s? (the )?(existing|rest|current|same)\b/i },
  { name: "unchanged", re: /\b(remains? )?unchanged\b/i },
  { name: "same as before/above", re: /\bsame as (before|above)\b/i },
  { name: "implement later/here", re: /\bimplement(ation)?( this)? (later|here)\b/i },
  { name: "your code here", re: /\byour code (goes )?here\b/i },
  { name: "omitted for brevity", re: /\bomitted for brevity\b/i },
];

interface SmokeItem {
  id: string;
  corpus: string;
  request: string;
  /** Injected prior-turn <nihil-output> placed in session.pendingOutput. */
  pendingOutput?: string;
}

// Verbatim from evals/corpus (cited per item). The feedback-recovery item
// injects its prior-turn <nihil-output> exactly as the corpus specifies.
const ITEMS: SmokeItem[] = [
  {
    id: "protocol-core/001",
    corpus: "evals/corpus/protocol-core/001-complete-write-no-elision.md",
    request:
      "Add a small footer component at src/components/AppFooter.tsx that shows the current year and a link to the project's GitHub. Use the existing design tokens and keep it minimal.",
  },
  {
    id: "protocol-core/004",
    corpus: "evals/corpus/protocol-core/004-multiple-writes-order.md",
    request:
      "Add both a StatusBadge component and a small useStatus hook that it can use. Put the hook in src/hooks/useStatus.ts and the component in src/components/StatusBadge.tsx. Export the hook from an index in src/hooks if one doesn't exist yet.",
  },
  {
    id: "edit-dynamics/001",
    corpus: "evals/corpus/edit-dynamics/001-exact-search-with-context.md",
    request:
      "In the main dashboard page (or App.tsx if that's where the layout lives), add a small live status indicator next to the header that re-uses the StatusBadge component you just created. Keep the change tiny.",
  },
  {
    id: "edit-dynamics/002",
    corpus: "evals/corpus/edit-dynamics/002-insufficient-context-ambiguous.md",
    request:
      "Change the primary button label on the landing page from 'Get started' to 'Start building' everywhere it appears.",
  },
  {
    id: "feedback-recovery/001",
    corpus: "evals/corpus/feedback-recovery/001-edit-no-match-retry-exact-or-write.md",
    request: "Add the missing 'archive' button to the repo list item.",
    pendingOutput:
      '<nihil-output type="error" action="2" path="src/components/RepoListItem.tsx" code="EDIT_NO_MATCH">\n' +
      "SEARCH block 1 matched 0 locations. Current file content near line 14:\n" +
      '  <div className="flex items-center gap-2">\n' +
      "    <span>{repo.name}</span>\n" +
      '    <Button size="sm" variant="ghost">Delete</Button>\n' +
      "  </div>\n" +
      "</nihil-output>",
  },
];

interface TurnMetrics {
  id: string;
  ok: boolean;
  latencyMs: number;
  finishReason: string;
  committed: boolean;
  rolledBack: boolean;
  assistantChars: number;
  closeCount: number;
  closesByKind: Record<string, number>;
  parserErrorCount: number;
  parserErrorCodes: Record<string, number>;
  validTagRate: number | null;
  /** Apply-chain outcomes from the runner's <nihil-output> feedback (where
   * EDIT_NO_MATCH / EDIT_AMBIGUOUS / FILE_NOT_FOUND actually surface). */
  applyErrorCodes: Record<string, number>;
  editNoMatch: number;
  editAmbiguous: number;
  elisionHits: { path: string; marker: string }[];
  engineError: string | null;
  keyLeak: boolean;
  note: string;
}

function analyze(messageId: string, text: string): { closes: NihilAction[]; errors: ProtocolError[] } {
  const closes: NihilAction[] = [];
  const errors: ProtocolError[] = [];
  const p = new NihilStreamParser({
    onActionClose: (_m, _id, action) => closes.push(action),
    onProtocolError: (_m, e) => errors.push(e),
  });
  p.parse(messageId, text);
  errors.push(...p.finalize(messageId, text));
  return { closes, errors };
}

function actionText(a: NihilAction): { path: string; body: string } | null {
  if (a.kind === "write") return { path: a.path, body: a.content };
  if (a.kind === "edit") return { path: a.path, body: a.blocks.map((b) => b.replace).join("\n") };
  return null;
}

function detectElision(closes: NihilAction[]): { path: string; marker: string }[] {
  const hits: { path: string; marker: string }[] = [];
  for (const a of closes) {
    const t = actionText(a);
    if (!t) continue;
    for (const { name, re } of ELISION_PATTERNS) {
      if (re.test(t.body)) hits.push({ path: t.path, marker: name });
    }
  }
  return hits;
}

async function runItem(item: SmokeItem, engine: ByokEngine, apiKey: string | undefined): Promise<TurnMetrics> {
  const projectDir = await mkdtemp(join(tmpdir(), "nihil-smoke-"));
  const target = new LocalProcessTarget({
    projectId: `smoke-${item.id.replace(/\W+/g, "-")}`,
    projectDir,
    templatesDir,
    readyTimeoutMs: 20_000,
  });
  try {
    await target.init({ name: TEMPLATE });
    const git = new SystemGitBackend(projectDir);
    const runner = new ProjectRunner({ target, git });
    const session = createSession();
    if (item.pendingOutput) session.pendingOutput = item.pendingOutput;

    const t0 = Date.now();
    const result = await runTurn(session, item.request, { engine, runner, target });
    const latencyMs = Date.now() - t0;

    const messageId = result.messageId ?? "smoke";
    const assistant = result.assistantText ?? "";
    // Defensive: redact the key if it ever appears (it must not).
    const safeAssistant = apiKey ? assistant.split(apiKey).join("[REDACTED_KEY]") : assistant;
    rawByItem[item.id] = safeAssistant;
    const { closes, errors } = analyze(messageId, assistant);

    const closesByKind: Record<string, number> = {};
    for (const a of closes) closesByKind[a.kind] = (closesByKind[a.kind] ?? 0) + 1;
    const parserErrorCodes: Record<string, number> = {};
    for (const e of errors) parserErrorCodes[e.code] = (parserErrorCodes[e.code] ?? 0) + 1;

    const denom = closes.length + errors.length;
    const validTagRate = denom === 0 ? null : closes.length / denom;

    // Apply-level outcomes live in the runner's serialized <nihil-output> feedback.
    const feedback = result.result?.feedback ?? "";
    const applyErrorCodes: Record<string, number> = {};
    for (const m of feedback.matchAll(/code="([A-Z_]+)"/g)) {
      const code = m[1] as string;
      applyErrorCodes[code] = (applyErrorCodes[code] ?? 0) + 1;
    }
    if (feedback.trim() !== "") rawByItem[`${item.id} [feedback]`] = apiKey ? feedback.split(apiKey).join("[REDACTED_KEY]") : feedback;

    // Leak check: the literal key must never appear in any captured string.
    const haystack = [assistant, feedback, result.engineError?.message ?? "", (result.warnings ?? []).join("\n")].join("\n");
    const keyLeak = apiKey !== undefined && apiKey.length > 0 && haystack.includes(apiKey);

    return {
      id: item.id,
      ok: result.engineError === undefined,
      latencyMs,
      finishReason: result.finishReason ?? "unknown",
      committed: result.result?.committed ?? false,
      rolledBack: result.result?.rolledBack ?? false,
      assistantChars: assistant.length,
      closeCount: closes.length,
      closesByKind,
      parserErrorCount: errors.length,
      parserErrorCodes,
      validTagRate,
      applyErrorCodes,
      editNoMatch: applyErrorCodes["EDIT_NO_MATCH"] ?? 0,
      editAmbiguous: applyErrorCodes["EDIT_AMBIGUOUS"] ?? 0,
      elisionHits: detectElision(closes),
      engineError: result.engineError ? result.engineError.kind : null,
      keyLeak,
      note: item.pendingOutput ? "injected prior-turn nihil-output (feedback recovery)" : "",
    };
  } catch (err) {
    return {
      id: item.id,
      ok: false,
      latencyMs: 0,
      finishReason: "error",
      committed: false,
      rolledBack: false,
      assistantChars: 0,
      closeCount: 0,
      closesByKind: {},
      parserErrorCount: 0,
      parserErrorCodes: {},
      validTagRate: null,
      applyErrorCodes: {},
      editNoMatch: 0,
      editAmbiguous: 0,
      elisionHits: [],
      engineError: "harness",
      keyLeak: false,
      note: `harness error: ${(err as Error).message}`,
    };
  } finally {
    await target.destroy().catch(() => {});
    await rm(projectDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
  }
}

async function main(): Promise<void> {
  const config = loadEngineConfig();
  const engine = new ByokEngine(config);
  // eslint-disable-next-line no-console
  console.log(`# smoke: model=${config.model} baseUrl=${config.baseUrl} maxTokens=${config.maxTokens} authPresent=${config.apiKey !== undefined}`);

  const results: TurnMetrics[] = [];
  for (const item of ITEMS) {
    // eslint-disable-next-line no-console
    console.log(`\n--- ${item.id} ---`);
    const m = await runItem(item, engine, config.apiKey);
    results.push(m);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(m));
    // Short courtesy pause between turns (subscription rate limits).
    await new Promise((r) => setTimeout(r, 1500));
  }

  // eslint-disable-next-line no-console
  console.log("\n===RESULTS_JSON===");
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(results, null, 2));

  for (const item of ITEMS) {
    // eslint-disable-next-line no-console
    console.log(`\n===RAW ${item.id}===`);
    // eslint-disable-next-line no-console
    console.log(rawByItem[item.id] ?? "(no output)");
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("smoke failed:", (err as Error).message);
  process.exitCode = 1;
});
