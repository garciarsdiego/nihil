import { createServer, type Server } from "node:net";
import { allocatePort, stablePort, DEV_PORT_BASE, PROXY_PORT_BASE } from "../exec/ports.js";

function occupy(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

describe("stablePort", () => {
  it("is deterministic per projectId and lands inside the band", () => {
    const a = stablePort("project-alpha", DEV_PORT_BASE);
    expect(stablePort("project-alpha", DEV_PORT_BASE)).toBe(a);
    expect(a).toBeGreaterThanOrEqual(DEV_PORT_BASE);
    expect(a).toBeLessThan(DEV_PORT_BASE + 1000);

    const proxy = stablePort("project-alpha", PROXY_PORT_BASE);
    expect(proxy).toBeGreaterThanOrEqual(PROXY_PORT_BASE);
    expect(proxy).toBeLessThan(PROXY_PORT_BASE + 1000);
  });

  it("spreads different projectIds across the band", () => {
    const ports = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => stablePort(id, DEV_PORT_BASE)),
    );
    expect(ports.size).toBeGreaterThan(1);
  });
});

describe("allocatePort", () => {
  it("returns the preferred port when free", async () => {
    const port = await allocatePort(41100);
    expect(port).toBe(41100);
  });

  it("scans upward past an occupied port", async () => {
    const blocker = await occupy(41150);
    try {
      const port = await allocatePort(41150);
      expect(port).toBeGreaterThan(41150);
      expect(port).toBeLessThanOrEqual(41150 + 150);
    } finally {
      await new Promise((resolve) => blocker.close(resolve));
    }
  });
});
