import type { NihilConfig } from "../../exec/workflows.js";

export interface ContextFile {
  path: string;
  content: string;
}

export function renderFileTree(paths: readonly string[]): string {
  return paths.length > 0 ? paths.join("\n") : "(empty project)";
}

export function renderContextFiles(files: readonly ContextFile[]): string {
  if (files.length === 0) {
    return "(no files selected)";
  }
  return files.map((file) => `// ===== ${file.path} =====\n${file.content}`).join("\n\n");
}

export function renderWorkflows(config: NihilConfig): string {
  const entries = Object.entries(config.workflows);
  if (entries.length === 0) {
    return "(none configured)";
  }
  return entries
    .map(([name, workflow]) => {
      const longRunning = workflow.longRunning ? " [long-running]" : "";
      const description = workflow.description ? ` — ${workflow.description}` : "";
      return `- ${name}${longRunning}: ${workflow.command}${description}`;
    })
    .join("\n");
}
