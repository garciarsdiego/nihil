import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  LocalProcessTarget,
  buildInstallCommand,
  detectPackageManager,
  extractDevServerUrl,
} from "../exec/local-process.js";
import { TargetError } from "../exec/target.js";
import { findEvent, pidAlive, pollUntil } from "./helpers.js";

const execFileAsync = promisify(execFile);
const templatesDir = fileURLToPath(new URL("./fixtures", import.meta.url));

const VITE_WIN32_LINE =
  "  \x1b[32m➜\x1b[39m  \x1b[1mLocal\x1b[22m:   \x1b[36mhttp://localhost:\x1b[1m5173\x1b[22m/\x1b[39m";

let projectDir: string;
let target: LocalProcessTarget;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "nihil-lp-"));
  target = new LocalProcessTarget({
    projectId: "test-project",
    projectDir,
    templatesDir,
    readyTimeoutMs: 20_000,
  });
});

afterEach(async () => {
  await target.destroy();
  await rm(projectDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

describe("ready-detection pipeline", () => {
  it("never matches raw win32 vite output, matches after the strip pipeline", () => {
    expect(extractDevServerUrl(VITE_WIN32_LINE)).toBeNull();
    expect(extractDevServerUrl("  ➜  Local:   http://localhost:5173/")).toBe(
      "http://localhost:5173/",
    );
    expect(extractDevServerUrl("- Local: http://localhost:3000")).toBe("http://localhost:3000");
    expect(extractDevServerUrl("ready on http://127.0.0.1:38123/")).toBe(
      "http://127.0.0.1:38123/",
    );
  });
});

describe("install command composition", () => {
  it("detects the package manager by lockfile", async () => {
    expect(detectPackageManager(projectDir)).toBe("npm");
    await writeFile(join(projectDir, "pnpm-lock.yaml"), "lockfileVersion: 9");
    expect(detectPackageManager(projectDir)).toBe("pnpm");
  });

  it("quotes valid specs and rejects shell metacharacters", () => {
    expect(buildInstallCommand("pnpm", ["zustand@^4", "@types/node@24.0.0"])).toBe(
      'pnpm add "zustand@^4" "@types/node@24.0.0"',
    );
    expect(buildInstallCommand("npm", ["react-router-dom@latest"])).toBe(
      'npm install "react-router-dom@latest"',
    );
    for (const evil of ["bad pkg", "a&&b", "x|y", "p;rm -rf /", 'q"r', "$(boom)"]) {
      try {
        buildInstallCommand("npm", [evil]);
        expect.unreachable(`accepted "${evil}"`);
      } catch (error) {
        expect(error).toBeInstanceOf(TargetError);
        expect((error as TargetError).code).toBe("INSTALL_FAILED");
      }
    }
  });
});

describe("LocalProcessTarget", () => {
  it(
    "init copies the template, creates a git repo on main, and snapshot returns HEAD",
    async () => {
      await target.init({ name: "template-basic" });

      expect(await target.readFile("server.js")).toContain("hello from fixture");
      expect(target.framework()).toBe("other");

      const { stdout: branch } = await execFileAsync("git", ["branch", "--show-current"], {
        cwd: projectDir,
      });
      expect(branch.trim()).toBe("main");
      const { stdout: log } = await execFileAsync("git", ["log", "--oneline"], {
        cwd: projectDir,
      });
      expect(log.trim().split("\n")).toHaveLength(1);

      const snapshot = await target.snapshot();
      expect(snapshot.kind).toBe("git");
      expect(snapshot.ref).toMatch(/^[0-9a-f]{40}$/);
    },
    30_000,
  );

  it("rejects template names that do not exist", async () => {
    await expect(target.init({ name: "no-such-template" })).rejects.toMatchObject({
      code: "TEMPLATE_NOT_FOUND",
    });
  });

  it("file verbs round-trip and every path goes through normalizeProjectPath", async () => {
    await target.writeFiles({ "src/deep/a.txt": "alpha", "b.txt": "beta" });
    expect(await target.readFile("src/deep/a.txt")).toBe("alpha");

    await target.copy("b.txt", "copies/b2.txt");
    expect(await target.readFile("copies/b2.txt")).toBe("beta");

    await target.rename("copies/b2.txt", "copies/renamed.txt");
    expect(await target.readFile("copies/renamed.txt")).toBe("beta");
    await expect(target.readFile("copies/b2.txt")).rejects.toMatchObject({
      code: "FILE_NOT_FOUND",
    });

    await target.deleteFile("copies/renamed.txt");
    await expect(target.readFile("copies/renamed.txt")).rejects.toMatchObject({
      code: "FILE_NOT_FOUND",
    });

    for (const forbidden of ["../escape.txt", "C:/windows/x", "/etc/passwd", "a/../../b"]) {
      await expect(target.writeFiles({ [forbidden]: "x" })).rejects.toMatchObject({
        code: "PATH_FORBIDDEN",
      });
    }
  });

  it(
    "listFiles is recursive, project-relative, sorted, and excludes artifacts",
    async () => {
      await target.init({ name: "template-basic" });
      await target.writeFiles({ "src/deep/nested.txt": "x" });
      await mkdir(join(projectDir, "node_modules"), { recursive: true });
      await writeFile(join(projectDir, "node_modules", "skip.txt"), "no");
      await mkdir(join(projectDir, "dist"), { recursive: true });
      await writeFile(join(projectDir, "dist", "skip.txt"), "no");

      const all = await target.listFiles();
      expect(all).toContain("server.js");
      expect(all).toContain("src/main.txt");
      expect(all).toContain("src/deep/nested.txt");
      expect(all).toEqual([...all].sort());
      expect(all.some((p) => p.startsWith("node_modules/"))).toBe(false);
      expect(all.some((p) => p.startsWith("dist/"))).toBe(false);
      expect(all.some((p) => p.startsWith(".git/"))).toBe(false);

      const src = await target.listFiles("src");
      expect(src).toEqual(["src/deep/nested.txt", "src/main.txt"]);
    },
    30_000,
  );

  it("exec throws UNKNOWN_WORKFLOW synchronously for undeclared workflows", async () => {
    await target.init({ name: "template-basic" });
    expect(() => target.exec({ workflow: "deploy" })).toThrowError(
      expect.objectContaining({ code: "UNKNOWN_WORKFLOW" }),
    );
  });

  it("getPreviewUrl without a dev workflow throws PREVIEW_UNAVAILABLE", async () => {
    await expect(target.getPreviewUrl()).rejects.toMatchObject({ code: "PREVIEW_UNAVAILABLE" });
  });

  it(
    "dev workflow end-to-end: ANSI ready-detection, proxy round-trip, origin-attributed logs, destroy",
    async () => {
      await target.init({ name: "template-basic" });
      const handle = target.exec({ workflow: "dev" });

      // Called immediately after exec(): must await the boot, not throw.
      const previewUrl = await target.getPreviewUrl();
      expect(previewUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

      const res = await fetch(`${previewUrl}/`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("hello from fixture");

      const devEvent = await findEvent(
        target.streamLogs(),
        (event) => event.source === "stdout" && event.workflow === "dev",
      );
      expect(devEvent.text).toContain("http://localhost:");
      expect(devEvent.pid).toBeTypeOf("number");

      const devPid = handle.pid;
      expect(devPid).toBeTypeOf("number");

      await target.destroy();
      await pollUntil(() => !pidAlive(devPid as number), 10_000, "dev server death");
      await expect(fetch(`${previewUrl}/`)).rejects.toThrow();
    },
    60_000,
  );

  it(
    "short workflows run to completion with logs attributed",
    async () => {
      await target.init({ name: "template-basic" });
      const handle = target.exec({ workflow: "hello" });
      const exit = await handle.exited;
      expect(exit.code).toBe(0);

      const helloEvent = await findEvent(
        target.streamLogs(),
        (event) => event.workflow === "hello" && event.text.includes("hello-workflow"),
      );
      expect(helloEvent.source).toBe("stdout");
    },
    30_000,
  );

  it("operations after destroy throw TARGET_DESTROYED", async () => {
    await target.destroy();
    await expect(target.readFile("x.txt")).rejects.toMatchObject({ code: "TARGET_DESTROYED" });
    expect(() => target.exec({ workflow: "dev" })).toThrowError(
      expect.objectContaining({ code: "TARGET_DESTROYED" }),
    );
  });
});
