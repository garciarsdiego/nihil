// Vendored from nexu-io/open-design @ ca22620b4fa03275d57710e3a9c000ec1171002f — Apache-2.0, see NOTICE
// STUB FILE for @open-design/contracts
// This is a placeholder stub for the contracts package.
// Real implementation will be provided by Nihil's contracts layer.

export type ApiContract = unknown;
export type AgentContract = unknown;
export type RuntimeContract = unknown;

// Stub types - to be replaced with actual Nihil contract types
export interface AgentConfig {
  id: string;
  name: string;
  runtime: string;
}

export interface RuntimeConfig {
  id: string;
  bin: string;
  args: string[];
}