// Vendored from nexu-io/open-design @ ca22620b4fa03275d57710e3a9c000ec1171002f — Apache-2.0, see NOTICE
// STUB FILE for @open-design/platform
// This is a placeholder stub for the platform package.
// Real implementation will be provided by Nihil's platform layer.

export type Platform = unknown;
export type ProcessInfo = unknown;
export type ExecResult = unknown;

export const platform = {
  // Stub methods - to be implemented
  async getProcessInfo(): Promise<ProcessInfo> {
    throw new Error('Platform stub: getProcessInfo not implemented');
  },

  async exec(command: string, args: string[]): Promise<ExecResult> {
    throw new Error('Platform stub: exec not implemented');
  },
};