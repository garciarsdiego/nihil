import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { TargetError, type WorkflowRef } from "./target.js";

const workflowSchema = z.object({
  command: z.string().min(1),
  // SPEC §7: server-starting workflows declare longRunning; the runner uses
  // it to defer them to last, local-process uses it to gate port/proxy/ready.
  longRunning: z.boolean().optional().default(false),
});

const nihilConfigSchema = z.object({
  workflows: z.record(z.string(), workflowSchema).default({}),
});

export type NihilConfig = z.infer<typeof nihilConfigSchema>;

export interface ResolvedWorkflow {
  name: string;
  command: string;
  longRunning: boolean;
}

/**
 * Loads nihil.config.json from the project root. A missing file is a valid
 * empty config (resolution then fails with UNKNOWN_WORKFLOW); a malformed or
 * schema-violating file is CONFIG_INVALID. Synchronous because exec() must
 * return a ProcessHandle synchronously and resolution errors should surface
 * immediately, not inside the handle.
 */
export function loadWorkflowConfig(projectDir: string): NihilConfig {
  let raw: string;
  try {
    raw = readFileSync(join(projectDir, "nihil.config.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { workflows: {} };
    }
    throw error;
  }
  return parseWorkflowConfig(raw);
}

/**
 * Validates a nihil.config.json string. The runner uses this on the content it
 * read through the target (keeping every project read inside the path funnel)
 * rather than touching the filesystem itself.
 */
export function parseWorkflowConfig(raw: string): NihilConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new TargetError(
      "CONFIG_INVALID",
      `nihil.config.json is not valid JSON: ${(error as Error).message}`,
    );
  }

  const result = nihilConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new TargetError("CONFIG_INVALID", `nihil.config.json is invalid: ${issues}`);
  }
  return result.data;
}

// Workflow args arrive from the model (<nihil-run args="..."/>) and end up in
// a shell:true command line — same threat class as install specs. Tokens are
// allowlisted: no quotes, no &|;$`%^<>(){}\ or whitespace tricks. cmd.exe
// expands %VAR% and escapes with ^, so both are forbidden too.
const SAFE_ARG_TOKEN = /^[A-Za-z0-9_\-./=:@,+*]+$/;

function sanitizeArgs(raw: string): string {
  const tokens = raw.trim().split(/\s+/);
  for (const token of tokens) {
    if (!SAFE_ARG_TOKEN.test(token)) {
      throw new TargetError(
        "WORKFLOW_FAILED",
        `workflow args contain a forbidden token: "${token}"`,
      );
    }
  }
  return tokens.join(" ");
}

/** `${PORT}` substitution — owned by the exec layer, which is the only place
 * the actual port is known. Declared commands only; sanitized args cannot
 * smuggle a placeholder ($ is not an allowed character). */
export function substitutePort(command: string, port: number): string {
  return command.replaceAll("${PORT}", String(port));
}

/**
 * Resolves a named workflow (SPEC §4.5 — the security boundary admits named
 * workflows only). Args are validated against a strict allowlist before
 * being appended; `${PORT}` stays unsubstituted here (see substitutePort).
 */
export function resolveWorkflow(config: NihilConfig, ref: WorkflowRef): ResolvedWorkflow {
  const workflow = config.workflows[ref.workflow];
  if (workflow === undefined) {
    const declared = Object.keys(config.workflows).join(", ") || "(none)";
    throw new TargetError(
      "UNKNOWN_WORKFLOW",
      `unknown workflow "${ref.workflow}" — declared workflows: ${declared}`,
    );
  }

  let command = workflow.command;
  if (ref.args !== undefined && ref.args.trim() !== "") {
    command = `${command} ${sanitizeArgs(ref.args)}`;
  }
  return { name: ref.workflow, command, longRunning: workflow.longRunning };
}
