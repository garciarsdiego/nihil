// Vendored from nexu-io/open-design @ ca22620b4fa03275d57710e3a9c000ec1171002f — Apache-2.0, see NOTICE

import { detectAcpModels, DEFAULT_MODEL_OPTION } from './shared.js';
import type { RuntimeAgentDef } from '../types.js';

export const vibeAgentDef = {
    id: 'vibe',
    name: 'Mistral Vibe CLI',
    bin: 'vibe-acp',
    versionArgs: ['--version'],
    fetchModels: async (resolvedBin, env) =>
      detectAcpModels({
        bin: resolvedBin,
        args: [],
        env,
        timeoutMs: 15_000,
        defaultModelOption: DEFAULT_MODEL_OPTION,
      }),
    fallbackModels: [DEFAULT_MODEL_OPTION],
    buildArgs: () => [],
    streamFormat: 'acp-json-rpc',
    externalMcpInjection: 'acp-merge',
} satisfies RuntimeAgentDef;
