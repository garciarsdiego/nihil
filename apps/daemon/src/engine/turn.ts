import { randomUUID } from "node:crypto";
import type { ProjectRunner } from "../agent/runner.js";
import type { MessageResult } from "../agent/types.js";
import type { ExecutionTarget } from "../exec/target.js";
import { parseWorkflowConfig, type NihilConfig } from "../exec/workflows.js";
import { EngineError } from "./errors.js";
import { assembleSystemPrompt, type PromptMode } from "./prompt/assemble.js";
import { selectContext } from "./prompt/context.js";
import { renderContextFiles, renderFileTree, renderWorkflows } from "./prompt/slots.js";
import type { Session } from "./session.js";
import type { Engine, EngineFinishReason, EngineUsage } from "./types.js";

export interface TurnObserver {
  onAssistantDelta?(delta: string): void;
}

export interface TurnDeps {
  engine: Engine;
  runner: ProjectRunner;
  target: ExecutionTarget;
  mode?: PromptMode;
  designRules?: string;
  templateNotes?: string;
  observer?: TurnObserver;
}

export interface TurnResult {
  messageId: string;
  assistantText: string;
  finishReason: EngineFinishReason;
  result: MessageResult;
  /** User-visible chat notices (context truncation, token-limit, engine error). */
  warnings: string[];
  engineError?: EngineError;
  /** Token accounting, when the provider reported a usage block. */
  usage?: EngineUsage;
}

const LENGTH_WARNING =
  "The response hit the token limit and may be incomplete — ask me to continue if something looks cut off.";

/**
 * One conversational turn: assemble the prompt, stream the engine, feed the
 * accumulating text to the runner (which parses + applies + commits), and
 * store the runner's <nihil-output> feedback for the next turn.
 */
export async function runTurn(
  session: Session,
  userText: string,
  deps: TurnDeps,
  opts: { signal?: AbortSignal } = {},
): Promise<TurnResult> {
  const mode = deps.mode ?? "build";
  const context = await selectContext(deps.target);
  const config = await readWorkflowConfig(deps.target);
  const system = assembleSystemPrompt({
    mode,
    fileTree: renderFileTree(context.fileTree),
    contextFiles: renderContextFiles(context.contextFiles),
    workflows: renderWorkflows(config.workflows),
    templateNotes: deps.templateNotes,
    designRules: deps.designRules,
  });

  // The previous turn's <nihil-output> is prepended to THIS user message.
  const userMessage = session.pendingOutput
    ? `${session.pendingOutput}\n\n${userText}`
    : userText;
  const messages = [...session.messages, { role: "user" as const, content: userMessage }];
  const messageId = randomUUID();

  // Held in an object so the closure's assignments survive control-flow
  // narrowing once the generator runs inside runMessage.
  const capture: {
    assistantText: string;
    finishReason: EngineFinishReason;
    engineError?: EngineError;
    usage?: EngineUsage;
  } = {
    assistantText: "",
    finishReason: "unknown",
  };

  const accumulated = (async function* (): AsyncGenerator<string> {
    try {
      for await (const event of deps.engine.stream({ system, messages }, { signal: opts.signal })) {
        if (event.type === "text") {
          capture.assistantText += event.delta;
          deps.observer?.onAssistantDelta?.(event.delta);
          yield capture.assistantText;
        } else if (event.type === "done") {
          capture.finishReason = event.finishReason;
          if (event.usage !== undefined) {
            capture.usage = event.usage;
          }
        }
        // Unknown future variants (M2 file_change/tool_call) are ignored here
        // so adding them does not break this consumer (DECISIONS #22).
      }
    } catch (error) {
      if (error instanceof EngineError) {
        // A terminal engine error ends the stream; the runner finalizes and
        // commits whatever completed (partial output is like a truncation).
        if (error.kind !== "aborted") {
          capture.engineError = error;
        }
        return;
      }
      throw error; // unexpected → runner rolls back and rethrows
    }
  })();

  const result = await deps.runner.runMessage(messageId, accumulated, { signal: opts.signal });
  const { assistantText, finishReason, engineError, usage } = capture;

  // Record the exchange only when the turn actually produced a committed
  // result with real assistant output. A rolled-back turn (user abort) and a
  // pre-stream engine failure leave history + pendingOutput intact so the prior
  // feedback survives and the next request has no blank assistant turn.
  const produced = !result.rolledBack && (assistantText !== "" || result.committed);
  if (produced) {
    session.messages.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantText },
    );
    session.pendingOutput = result.feedback;
  }

  const warnings: string[] = [];
  if (context.warning !== undefined) {
    warnings.push(context.warning);
  }
  if (config.warning !== undefined) {
    warnings.push(config.warning);
  }
  if (finishReason === "length") {
    warnings.push(LENGTH_WARNING);
  }
  if (engineError !== undefined) {
    warnings.push(`Engine error (${engineError.kind}): ${engineError.message}`);
  }

  return { messageId, assistantText, finishReason, result, warnings, engineError, usage };
}

interface WorkflowConfigResult {
  workflows: NihilConfig;
  warning?: string;
}

async function readWorkflowConfig(target: ExecutionTarget): Promise<WorkflowConfigResult> {
  let raw: string;
  try {
    raw = await target.readFile("nihil.config.json");
  } catch {
    return { workflows: { workflows: {} } }; // absent file is a valid empty config
  }
  try {
    return { workflows: parseWorkflowConfig(raw) };
  } catch (error) {
    // A malformed/invalid config must not fail silently (coding-style): the
    // model is told there are no workflows, and the user sees why.
    return {
      workflows: { workflows: {} },
      warning: `nihil.config.json is invalid and was ignored: ${(error as Error).message}`,
    };
  }
}
