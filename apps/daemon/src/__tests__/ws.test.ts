import type { FastifyInstance } from "fastify";
import WebSocket, { type RawData } from "ws";
import type { WsServerMessage } from "../contracts/routes.js";
import { buildServer } from "../server.js";

let app: FastifyInstance;
let url: string;

async function listenOnEphemeralPort(instance: FastifyInstance): Promise<string> {
  await instance.listen({ host: "127.0.0.1", port: 0 });
  const address = instance.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("server did not expose a TCP address");
  }
  return `ws://127.0.0.1:${address.port}/ws`;
}

function connect(target: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function nextMessage(socket: WebSocket): Promise<WsServerMessage> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      socket.off("message", onMessage);
      reject(error);
    };
    const onMessage = (raw: RawData): void => {
      socket.off("error", onError);
      resolve(JSON.parse(String(raw)) as WsServerMessage);
    };
    socket.once("message", onMessage);
    socket.once("error", onError);
  });
}

beforeAll(async () => {
  app = await buildServer({ version: "0.0.0-test" });
  url = await listenOnEphemeralPort(app);
});

afterAll(async () => {
  await app.close();
});

describe("WS /ws", () => {
  it("answers ping with pong", async () => {
    const socket = await connect(url);
    socket.send(JSON.stringify({ type: "ping" }));

    const message = await nextMessage(socket);
    expect(message.type).toBe("pong");
    if (message.type === "pong") {
      expect(message.timestamp).toBeTypeOf("number");
    }
    socket.close();
  });

  it("answers a malformed frame with WS_MALFORMED and keeps the connection open", async () => {
    const socket = await connect(url);
    socket.send("{not json");

    const error = await nextMessage(socket);
    expect(error).toMatchObject({ type: "error", code: "WS_MALFORMED" });

    socket.send(JSON.stringify({ type: "ping" }));
    const followUp = await nextMessage(socket);
    expect(followUp.type).toBe("pong");
    socket.close();
  });

  it("answers an unknown message type with WS_UNKNOWN_TYPE and keeps the connection open", async () => {
    const socket = await connect(url);
    socket.send(JSON.stringify({ type: "teleport" }));

    const error = await nextMessage(socket);
    expect(error).toMatchObject({ type: "error", code: "WS_UNKNOWN_TYPE" });

    socket.send(JSON.stringify({ type: "ping" }));
    const followUp = await nextMessage(socket);
    expect(followUp.type).toBe("pong");
    socket.close();
  });

  it("closes cleanly while a connection is open", async () => {
    const standalone = await buildServer({ version: "0.0.0-test" });
    try {
      const standaloneUrl = await listenOnEphemeralPort(standalone);
      const socket = await connect(standaloneUrl);

      const closed = new Promise<void>((resolve) => {
        socket.once("close", () => resolve());
      });
      await standalone.close();
      await closed;
      expect(socket.readyState).toBe(WebSocket.CLOSED);
    } finally {
      await standalone.close().catch(() => undefined);
    }
  });
});
