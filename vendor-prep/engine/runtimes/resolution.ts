// Vendored from nexu-io/open-design @ ca22620b4fa03275d57710e3a9c000ec1171002f — Apache-2.0, see NOTICE

import { getAgentDef } from './registry.js';
import { resolveAgentExecutable } from './executables.js';

// Resolve the absolute path of an agent's binary on the current PATH.
// Used by the chat handler so spawn() gets the same executable that
// detection reported as available — fixes Windows ENOENT when the bare
// bin name isn't on the child process's PATH (issue #10).
export function resolveAgentBin(id: string, configuredEnv: Record<string, string> = {}) {
  const def = getAgentDef(id);
  if (!def?.bin) return null;
  return resolveAgentExecutable(def, configuredEnv);
}
