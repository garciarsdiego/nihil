// Vendored from nexu-io/open-design @ ca22620b4fa03275d57710e3a9c000ec1171002f — Apache-2.0, see NOTICE

import type { RuntimeAgentDef } from './types.js';

type McpOptions = {
  enabled?: boolean;
  command?: string;
  argsPrefix?: string[];
};

export function buildLiveArtifactsMcpServersForAgent(
  def: RuntimeAgentDef,
  { enabled = true, command = 'od', argsPrefix = [] }: McpOptions = {},
) {
  if (!enabled || def?.mcpDiscovery !== 'mature-acp') return [];
  return [
    {
      name: 'open-design-live-artifacts',
      command,
      args: [...argsPrefix, 'mcp', 'live-artifacts'],
      env: [{ name: 'ELECTRON_RUN_AS_NODE', value: '1' }],
    },
  ];
}
