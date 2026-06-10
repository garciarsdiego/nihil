import websocket from "@fastify/websocket";
import { fastify, type FastifyInstance } from "fastify";
import { registerHealthRoute } from "./routes/health.js";
import { registerWsRoute } from "./ws/socket.js";

export interface BuildServerOptions {
  version: string;
  logger?: boolean;
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const app = fastify({ logger: options.logger ?? false });
  // Loopback-only daemon, but cap frames anyway: ws defaults to 100 MiB and
  // every frame goes through JSON.parse.
  await app.register(websocket, { options: { maxPayload: 1_048_576 } });
  registerHealthRoute(app, options.version);
  registerWsRoute(app);
  return app;
}
