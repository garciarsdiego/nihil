import { Agent, createServer, request, type Server } from "node:http";
import { connect, type Socket } from "node:net";

export interface PreviewProxy {
  port: number;
  url: string;
  stop(): Promise<void>;
}

const STOP_DEADLINE_MS = 3000;

/**
 * Minimal reverse proxy for project previews: plain HTTP forwarding plus raw
 * WebSocket upgrade tunneling (vite HMR). Hand-rolled on node:http — zero
 * deps, and we control teardown precisely:
 *
 * Node 24's server.close() never resolves while an upgraded socket is open,
 * and closeAllConnections() does NOT cover upgraded sockets (they detach from
 * the server's tracking on 'upgrade'). stop() therefore destroys every
 * tracked tunnel socket pair explicitly, then closes the server with a hard
 * deadline. Verified live on this machine before this design was chosen.
 */
export function startProxy(options: {
  port: number;
  upstream: URL;
  host?: string;
}): Promise<PreviewProxy> {
  const host = options.host ?? "127.0.0.1";
  const upstreamHost = options.upstream.hostname;
  const upstreamPort = Number(options.upstream.port) || 80;
  // Dedicated keep-alive agent so stop() can sever idle upstream connections.
  const agent = new Agent({ keepAlive: true, maxSockets: 64 });
  const tunnelSockets = new Set<Socket>();

  const server = createServer((req, res) => {
    const upstreamReq = request(
      {
        agent,
        hostname: upstreamHost,
        port: upstreamPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `${upstreamHost}:${upstreamPort}` },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstreamReq.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_GATEWAY", message: "dev server unreachable" }));
      } else {
        res.destroy();
      }
    });
    // Client gone (tab closed, navigation) → abort the upstream leg, or the
    // keep-alive pool slowly fills with orphaned requests.
    res.on("close", () => upstreamReq.destroy());
    req.on("error", () => upstreamReq.destroy());
    upstreamReq.setTimeout(120_000, () => upstreamReq.destroy());
    req.pipe(upstreamReq);
  });

  server.on("upgrade", (req, clientSocket: Socket, head) => {
    const upstreamSocket = connect(upstreamPort, upstreamHost);
    track(tunnelSockets, clientSocket);
    track(tunnelSockets, upstreamSocket);

    let connected = false;
    upstreamSocket.on("connect", () => {
      connected = true;
      const lines = [`${req.method ?? "GET"} ${req.url ?? "/"} HTTP/1.1`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const name = req.rawHeaders[i];
        const value =
          name.toLowerCase() === "host"
            ? `${upstreamHost}:${upstreamPort}`
            : req.rawHeaders[i + 1];
        lines.push(`${name}: ${value}`);
      }
      upstreamSocket.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (head.length > 0) {
        upstreamSocket.write(head);
      }
      clientSocket.pipe(upstreamSocket);
      upstreamSocket.pipe(clientSocket);
    });

    // ECONNRESET on either side (closed tab, vite restart) is routine — an
    // unhandled 'error' on a raw socket would kill the daemon process.
    clientSocket.on("error", () => upstreamSocket.destroy());
    upstreamSocket.on("error", () => {
      if (!connected) {
        // Upgrade path can't answer JSON; raw minimal 502 then drop.
        clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
      }
      clientSocket.destroy();
    });
    clientSocket.on("close", () => upstreamSocket.destroy());
    upstreamSocket.on("close", () => clientSocket.destroy());
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, host, () => {
      resolve({
        port: options.port,
        url: `http://${host}:${options.port}`,
        stop: () => stopServer(server, agent, tunnelSockets),
      });
    });
  });
}

function track(set: Set<Socket>, socket: Socket): void {
  set.add(socket);
  socket.on("close", () => set.delete(socket));
}

function stopServer(server: Server, agent: Agent, tunnelSockets: Set<Socket>): Promise<void> {
  for (const socket of tunnelSockets) {
    socket.destroy();
  }
  tunnelSockets.clear();
  agent.destroy();
  return new Promise((resolve) => {
    const deadline = setTimeout(() => resolve(), STOP_DEADLINE_MS);
    deadline.unref();
    server.close(() => {
      clearTimeout(deadline);
      resolve();
    });
    server.closeAllConnections();
  });
}
