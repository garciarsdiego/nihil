import { readFileSync } from "node:fs";
import { PROTOCOL_VERSION } from "@nihil/protocol";
import type { FastifyInstance } from "fastify";
import { loadConfig } from "../config.js";
import type { HealthResponse } from "../contracts/routes.js";
import { buildServer } from "../server.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer({ version: loadConfig({}).version });
});

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("returns status ok, daemon version, and the protocol version", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    const body = res.json<HealthResponse>();
    expect(body.status).toBe("ok");
    expect(body.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(Object.keys(body).sort()).toEqual(["protocolVersion", "status", "version"]);
  });

  it("reports the version from apps/daemon/package.json, not any other manifest", async () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    const res = await app.inject({ method: "GET", url: "/health" });
    const body = res.json<HealthResponse>();
    expect(body.version).toBe(pkg.version);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });

    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/json");
  });
});
