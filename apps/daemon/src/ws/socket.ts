import type { FastifyInstance } from "fastify";
import type { RawData, WebSocket } from "ws";
import { ROUTES, type WsServerMessage } from "../contracts/routes.js";

export function registerWsRoute(app: FastifyInstance): void {
  app.get(ROUTES.ws.path, { websocket: true }, (socket: WebSocket) => {
    socket.on("message", (raw: RawData) => {
      send(socket, replyTo(rawToString(raw)));
    });
  });
}

function send(socket: WebSocket, message: WsServerMessage): void {
  socket.send(JSON.stringify(message));
}

// Unknown-but-valid message types get a typed error and the connection stays
// open — same forward-compatibility stance as SPEC.md §2.5 for unknown tags.
function replyTo(raw: string): WsServerMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { type: "error", code: "WS_MALFORMED", message: "Frame is not valid JSON" };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { type?: unknown }).type !== "string"
  ) {
    return {
      type: "error",
      code: "WS_MALFORMED",
      message: 'Frame must be a JSON object with a string "type" field',
    };
  }

  const type = (parsed as { type: string }).type;
  if (type === "ping") {
    return { type: "pong", timestamp: Date.now() };
  }
  return {
    type: "error",
    code: "WS_UNKNOWN_TYPE",
    message: `Unknown message type "${type}"`,
  };
}

function rawToString(raw: RawData): string {
  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString("utf8");
  }
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString("utf8");
  }
  return raw.toString("utf8");
}
