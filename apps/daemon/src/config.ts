import { readFileSync } from "node:fs";

export interface DaemonConfig {
  host: string;
  port: number;
  version: string;
}

const DEFAULT_PORT = 4517;
const DEFAULT_HOST = "127.0.0.1";

function readDaemonVersion(): string {
  // Anchored to this module's URL, never to cwd: under `turbo run dev` or a
  // Tauri sidecar spawn the working directory is not apps/daemon, and the
  // repo root manifest would be read instead. fs accepts URL objects, which
  // also survives paths containing spaces (percent-encoded in file URLs).
  const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { version?: unknown }).version !== "string"
  ) {
    throw new Error('apps/daemon/package.json is missing a string "version" field');
  }
  return (parsed as { version: string }).version;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_PORT;
  }
  const trimmed = value.trim();
  // Strict decimal only: Number() would silently accept "0x50", "1e3", "+1".
  const port = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `NIHIL_DAEMON_PORT must be a decimal integer between 1 and 65535, got "${value}"`,
    );
  }
  return port;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DaemonConfig {
  return {
    host: env.NIHIL_DAEMON_HOST?.trim() || DEFAULT_HOST,
    port: parsePort(env.NIHIL_DAEMON_PORT),
    version: readDaemonVersion(),
  };
}
