import { createServer, type Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { allocatePort } from "../exec/ports.js";
import { startProxy, type PreviewProxy } from "../exec/proxy.js";

let upstream: Server;
let upstreamPort: number;
let wss: WebSocketServer;
let proxy: PreviewProxy | null = null;

beforeEach(async () => {
  upstream = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain", "x-upstream": "yes" });
    res.end(`upstream:${req.url}`);
  });
  wss = new WebSocketServer({ server: upstream });
  wss.on("connection", (socket) => {
    socket.on("message", (data) => socket.send(`echo:${String(data)}`));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  if (address === null || typeof address === "string") {
    throw new Error("no upstream port");
  }
  upstreamPort = address.port;
});

afterEach(async () => {
  if (proxy !== null) {
    await proxy.stop();
    proxy = null;
  }
  wss.close();
  upstream.closeAllConnections();
  await new Promise((resolve) => upstream.close(resolve));
});

async function startTestProxy(targetPort = upstreamPort): Promise<PreviewProxy> {
  const port = await allocatePort(41400);
  proxy = await startProxy({
    port,
    upstream: new URL(`http://127.0.0.1:${targetPort}`),
  });
  return proxy;
}

function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

describe("preview proxy", () => {
  it("forwards plain HTTP to the upstream and back", async () => {
    const p = await startTestProxy();
    const res = await fetch(`${p.url}/some/path?q=1`);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-upstream")).toBe("yes");
    expect(await res.text()).toBe("upstream:/some/path?q=1");
  });

  it("tunnels WebSocket upgrades end-to-end", async () => {
    const p = await startTestProxy();
    const socket = await connectWs(`ws://127.0.0.1:${p.port}/`);

    const reply = await new Promise<string>((resolve) => {
      socket.once("message", (data) => resolve(String(data)));
      socket.send("hi");
    });
    expect(reply).toBe("echo:hi");
    socket.close();
  });

  it("answers 502 JSON when the upstream is unreachable (plain HTTP)", async () => {
    const deadPort = await allocatePort(41600);
    const p = await startTestProxy(deadPort);

    const res = await fetch(`${p.url}/`);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("BAD_GATEWAY");
  });

  it("survives an upstream reset mid-tunnel and keeps serving", async () => {
    const p = await startTestProxy();
    const socket = await connectWs(`ws://127.0.0.1:${p.port}/`);

    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    for (const client of wss.clients) {
      client.terminate();
    }
    await closed;

    // The daemon (this process) survived and the proxy still answers.
    const res = await fetch(`${p.url}/after`);
    expect(res.status).toBe(200);
    const again = await connectWs(`ws://127.0.0.1:${p.port}/`);
    again.close();
  });

  it("stop() resolves within its deadline while a WS tunnel is open", async () => {
    const p = await startTestProxy();
    const socket = await connectWs(`ws://127.0.0.1:${p.port}/`);
    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));

    const started = Date.now();
    await p.stop();
    proxy = null;
    expect(Date.now() - started).toBeLessThan(3500);
    await closed;
  }, 10_000);
});
