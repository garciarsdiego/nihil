import { access, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { ProjectRunner } from "../agent/runner.js";
import { ByokEngine } from "../engine/byok.js";
import { createSession } from "../engine/session.js";
import { runTurn } from "../engine/turn.js";
import { LocalProcessTarget } from "../exec/local-process.js";
import { SystemGitBackend } from "../git/transaction.js";
import { DONE, deltaFrame, startMockSseServer, type MockSseServer } from "./fakes/sse-server.js";

const execFileAsync = promisify(execFile);

// The REAL shipped templates directory (not a test fixture):
// apps/daemon/src/__tests__ -> ../../../../packages/templates
const templatesDir = fileURLToPath(new URL("../../../../packages/templates", import.meta.url));

async function gitOut(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

let projectDir: string;
let target: LocalProcessTarget;
let git: SystemGitBackend;
let runner: ProjectRunner;
let server: MockSseServer;
let engine: ByokEngine;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "nihil-template-"));
  target = new LocalProcessTarget({
    projectId: "template-integration-project",
    projectDir,
    templatesDir,
    readyTimeoutMs: 20_000,
  });
  await target.init({ name: "vite-react-shadcn" });
  git = new SystemGitBackend(projectDir);
  runner = new ProjectRunner({ target, git });
  server = await startMockSseServer();
  engine = new ByokEngine(
    { baseUrl: server.url, model: "m", maxTokens: 1000 },
    { sleep: async () => {} },
  );
});

afterEach(async () => {
  await target.destroy();
  await server.close();
  await rm(projectDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

describe("vite-react-shadcn template — real LocalProcessTarget.init() + one mocked turn", () => {
  it(
    "init copies the shipped template (no node_modules) and a mocked write commits onto it",
    async () => {
      // (a) init() copied the real template's committed files and git-inited it.
      expect(await exists(join(projectDir, "package.json"))).toBe(true);
      expect(await target.readFile("package.json")).toContain('"vite-react-shadcn"');
      expect(await target.readFile("nihil.config.json")).toContain('"workflows"');
      expect(await exists(join(projectDir, "src", "App.tsx"))).toBe(true);
      // The reserved namespace is gitignored by the template.
      expect(await target.readFile(".gitignore")).toContain(".nihil/");
      // node_modules and .git are never copied into the new project.
      expect(await exists(join(projectDir, "node_modules"))).toBe(false);

      // The template is a valid git project with a base commit.
      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      expect(headBefore).toMatch(/^[0-9a-f]{7,}$/);

      // (b) One mocked turn writes a new component and the runner commits it.
      // Close tag on its own line (never inline) per the protocol.
      server.queue({
        frames: [
          deltaFrame("Adding a greeting component.\n"),
          deltaFrame('<nihil-write path="src/components/Greeting.tsx">\n'),
          deltaFrame("export function Greeting() {\n"),
          deltaFrame("  return <p>Hello from Nihil</p>;\n"),
          deltaFrame("}\n"),
          deltaFrame("</nihil-write>\n"),
          deltaFrame("Done.", "stop"),
          DONE,
        ],
      });

      const result = await runTurn(createSession(), "add a greeting component", {
        engine,
        runner,
        target,
      });

      // The file landed on disk with the streamed content.
      expect(await exists(join(projectDir, "src", "components", "Greeting.tsx"))).toBe(true);
      const written = await target.readFile("src/components/Greeting.tsx");
      expect(written).toContain("export function Greeting");
      expect(written).toContain("Hello from Nihil");

      // A real commit landed with the Nihil-Message-Id trailer.
      expect(result.result.committed).toBe(true);
      expect(result.result.rolledBack).toBe(false);
      const headAfter = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      expect(headAfter).not.toBe(headBefore);
      expect(headAfter).toBe(result.result.commitRef);
      const trailer = await gitOut(projectDir, [
        "log",
        "-1",
        "--format=%(trailers:key=Nihil-Message-Id,valueonly)",
      ]);
      expect(trailer).toBe(result.messageId);
    },
    60_000,
  );
});
