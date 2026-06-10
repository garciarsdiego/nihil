import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectFramework } from "../exec/framework.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "nihil-fw-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true, maxRetries: 5 });
});

describe("detectFramework", () => {
  it("detects vite by config file", async () => {
    await writeFile(join(dir, "vite.config.ts"), "export default {};");
    expect(await detectFramework(dir)).toBe("vite");
  });

  it("detects nextjs by config file, winning over vite when both exist", async () => {
    await writeFile(join(dir, "vite.config.ts"), "export default {};");
    await writeFile(join(dir, "next.config.mjs"), "export default {};");
    expect(await detectFramework(dir)).toBe("nextjs");
  });

  it("falls back to package.json dependencies", async () => {
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ devDependencies: { vite: "^6.0.0" } }),
    );
    expect(await detectFramework(dir)).toBe("vite");

    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { next: "^15.0.0" } }),
    );
    expect(await detectFramework(dir)).toBe("nextjs");
  });

  it("reports other for unrecognized projects (including malformed package.json)", async () => {
    expect(await detectFramework(dir)).toBe("other");
    await writeFile(join(dir, "package.json"), "{not json");
    expect(await detectFramework(dir)).toBe("other");
  });
});
