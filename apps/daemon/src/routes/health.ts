import { PROTOCOL_VERSION } from "@nihil/protocol";
import type { FastifyInstance } from "fastify";
import { ROUTES, type HealthResponse } from "../contracts/routes.js";

export function registerHealthRoute(app: FastifyInstance, version: string): void {
  app.get(ROUTES.health.path, async (): Promise<HealthResponse> => ({
    status: "ok",
    version,
    protocolVersion: PROTOCOL_VERSION,
  }));
}
