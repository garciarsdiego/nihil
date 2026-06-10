// Vendored from nexu-io/open-design @ ca22620b4fa03275d57710e3a9c000ec1171002f — Apache-2.0, see NOTICE
// STUB FILE for Nihil config
// This is a placeholder stub for Nihil-specific configuration.
// Real implementation will be provided during Nihil integration.

export interface NihilConfig {
  // Nihil-specific configuration
  daemonPort?: number;
  webPort?: number;
  dataDir?: string;
}

export const config: NihilConfig = {
  // Default placeholder values
  daemonPort: 3000,
  webPort: 3001,
  dataDir: '.nihil',
};

export function getConfig(): NihilConfig {
  return config;
}

export function updateConfig(updates: Partial<NihilConfig>): void {
  Object.assign(config, updates);
}