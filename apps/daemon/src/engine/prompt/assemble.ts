import {
  BUILD_MODE_TEMPLATE,
  DEFAULT_DESIGN_RULES,
  DEFAULT_TEMPLATE_NOTES,
  PLAN_MODE_TEMPLATE,
} from "./templates.js";

export type PromptMode = "build" | "plan";

export interface AssembleInput {
  mode: PromptMode;
  fileTree: string;
  contextFiles: string;
  workflows: string;
  templateNotes?: string;
  designRules?: string;
}

/**
 * Fill the five prompt slots for the chosen mode. Build mode uses all five;
 * plan mode omits {{DESIGN_RULES}}. Throws if any placeholder is left unfilled
 * (a template/slot mismatch must fail loudly, not ship a literal "{{...}}").
 */
export function assembleSystemPrompt(input: AssembleInput): string {
  const template = input.mode === "build" ? BUILD_MODE_TEMPLATE : PLAN_MODE_TEMPLATE;
  const slots: Record<string, string> = {
    "{{FILE_TREE}}": input.fileTree,
    "{{CONTEXT_FILES}}": input.contextFiles,
    "{{WORKFLOWS}}": input.workflows,
    "{{TEMPLATE_NOTES}}": input.templateNotes ?? DEFAULT_TEMPLATE_NOTES,
    "{{DESIGN_RULES}}": input.designRules ?? DEFAULT_DESIGN_RULES,
  };

  let prompt = template;
  for (const [slot, value] of Object.entries(slots)) {
    prompt = prompt.split(slot).join(value);
  }

  const leftover = /\{\{[A-Z_]+\}\}/.exec(prompt);
  if (leftover !== null) {
    throw new Error(`prompt assembly left an unfilled slot: ${leftover[0]}`);
  }
  return prompt;
}
