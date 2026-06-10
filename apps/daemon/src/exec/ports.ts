import { createServer } from "node:net";
import { TargetError } from "./target.js";

export const DEV_PORT_BASE = 38000;
export const PROXY_PORT_BASE = 39000;
const BAND_SIZE = 1000;
const MAX_SCAN = 150;

/** FNV-1a 32-bit — stable, dependency-free hash for port determinism. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Same projectId → same preferred port, so preview origins survive restarts. */
export function stablePort(projectId: string, base: number): number {
  return base + (fnv1a(projectId) % BAND_SIZE);
}

/**
 * First free port scanning upward from `preferred` (≤150 attempts — wider
 * than one Windows excluded-port block, which arrives in ~100-port ranges).
 */
export async function allocatePort(preferred: number, host = "127.0.0.1"): Promise<number> {
  for (let attempt = 0; attempt < MAX_SCAN; attempt++) {
    const candidate = preferred + attempt;
    if (candidate > 65535) {
      break;
    }
    if (await isPortFree(candidate, host)) {
      return candidate;
    }
  }
  throw new TargetError(
    "NO_FREE_PORT",
    `no free port within ${MAX_SCAN} attempts starting at ${preferred}`,
  );
}

function isPortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.unref();
    // EADDRINUSE = taken; EACCES = Windows administratively-excluded range.
    // Any bind failure means "keep scanning" — never throw mid-scan.
    probe.once("error", () => resolve(false));
    probe.listen(port, host, () => {
      probe.close(() => resolve(true));
    });
  });
}
