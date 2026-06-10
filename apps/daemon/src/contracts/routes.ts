/**
 * Typed route contract shared between the daemon and the desktop shell
 * (imported by the shell as `@nihil/daemon/contracts`).
 *
 * Constraint: this module may import only `@nihil/protocol`; every other
 * import must be type-only. Never import fastify or daemon internals here —
 * the desktop shell is a browser bundle and must not pull daemon runtime.
 */
import type { PROTOCOL_VERSION } from "@nihil/protocol";

export interface HealthResponse {
  status: "ok";
  version: string;
  protocolVersion: typeof PROTOCOL_VERSION;
}

export const ROUTES = {
  health: { method: "GET", path: "/health" },
  ws: { path: "/ws" },
} as const;

export type WsErrorCode = "WS_MALFORMED" | "WS_UNKNOWN_TYPE";

export type WsClientMessage = { type: "ping" };

export type WsServerMessage =
  | { type: "pong"; timestamp: number }
  | { type: "error"; code: WsErrorCode; message: string };
