import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rename, rm, copyFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { normalizeProjectPath } from "@nihil/protocol";
import { detectFramework } from "./framework.js";
import { LogHub } from "./logs.js";
import { allocatePort, stablePort, DEV_PORT_BASE, PROXY_PORT_BASE } from "./ports.js";
import { killTree, spawnProcess, type SpawnedProcess } from "./process-tree.js";
import { startProxy, type PreviewProxy } from "./proxy.js";
import {
  TargetError,
  type ExecutionTarget,
  type FileMap,
  type FrameworkKind,
  type LogEvent,
  type ProcessExit,
  type ProcessHandle,
  type Result,
  type SnapshotRef,
  type TemplateRef,
  type WorkflowRef,
} from "./target.js";
import { loadWorkflowConfig, resolveWorkflow, substitutePort } from "./workflows.js";

const execFileAsync = promisify(execFile);

const EXCLUDED_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
]);

const DEV_SERVER_URL = /(https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/?)/;

/** Matches against ANSI-stripped, line-buffered output only — raw vite stdout
 * on win32 has color codes INSIDE the URL (between ':' and the port digits). */
export function extractDevServerUrl(line: string): string | null {
  const match = DEV_SERVER_URL.exec(line);
  return match?.[1] ?? null;
}

// Conservative npm spec allowlist: name[@range], no whitespace or shell
// metacharacters — these strings end up inside a shell:true command line.
const PACKAGE_SPEC = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[a-zA-Z0-9-._^~<>=*+]+)?$/;

export function detectPackageManager(projectDir: string): "pnpm" | "npm" {
  return existsSync(join(projectDir, "pnpm-lock.yaml")) ? "pnpm" : "npm";
}

/** Pure command composition — unit-testable without network or processes. */
export function buildInstallCommand(
  packageManager: "pnpm" | "npm",
  pkgs: readonly string[],
): string {
  const specs = pkgs.map((pkg) => {
    if (!PACKAGE_SPEC.test(pkg)) {
      throw new TargetError("INSTALL_FAILED", `invalid package spec "${pkg}"`);
    }
    return `"${pkg}"`;
  });
  const verb = packageManager === "pnpm" ? "pnpm add" : "npm install";
  return `${verb} ${specs.join(" ")}`;
}

export interface LocalProcessTargetOptions {
  projectId: string;
  projectDir: string;
  templatesDir: string;
  env?: NodeJS.ProcessEnv;
  readyTimeoutMs?: number;
  killGraceMs?: number;
}

interface TrackedProcess {
  spawned: SpawnedProcess;
  processHub: LogHub;
}

export class LocalProcessTarget implements ExecutionTarget {
  private readonly options: LocalProcessTargetOptions;
  private readonly hub = new LogHub();
  private readonly live = new Set<TrackedProcess>();
  private proxy: PreviewProxy | null = null;
  private previewReady: Promise<string> | null = null;
  private frameworkKind: FrameworkKind | null = null;
  private destroyed = false;

  constructor(options: LocalProcessTargetOptions) {
    this.options = options;
  }

  /** Detected at init(); consumed by the shell's preview/status UI (Task 6)
   * and M2/M3 logic (healer, capacitor). Not part of the ExecutionTarget
   * interface — local knowledge of this implementation. */
  framework(): FrameworkKind | null {
    return this.frameworkKind;
  }

  async init(template: TemplateRef): Promise<void> {
    this.assertAlive();
    const templateDir = join(this.options.templatesDir, template.name);
    const templateStat = await stat(templateDir).catch(() => null);
    if (templateStat === null || !templateStat.isDirectory()) {
      throw new TargetError("TEMPLATE_NOT_FOUND", `template "${template.name}" not found in ${this.options.templatesDir}`);
    }

    await mkdir(this.options.projectDir, { recursive: true });
    await cp(templateDir, this.options.projectDir, {
      recursive: true,
      filter: (source) => {
        const base = basename(source);
        return base !== "node_modules" && base !== ".git";
      },
    });

    await this.runGit(["init", "-b", "main"]);
    await this.runGit(["add", "-A"]);
    await this.runGit([
      "-c", "user.name=Nihil",
      "-c", "user.email=daemon@nihil.invalid",
      "commit", "-m", `chore: init from template ${template.name}`,
    ]);

    this.frameworkKind = await detectFramework(this.options.projectDir);
    this.hub.system(`initialized from template "${template.name}" (framework: ${this.frameworkKind})`);
  }

  async readFile(path: string): Promise<string> {
    this.assertAlive();
    const absolute = this.resolvePath(path);
    try {
      return await readFile(absolute, "utf8");
    } catch (error) {
      throw this.asFileError(error, path);
    }
  }

  async writeFiles(files: FileMap): Promise<void> {
    this.assertAlive();
    await Promise.all(
      Object.entries(files).map(async ([path, content]) => {
        const absolute = this.resolvePath(path);
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, content, "utf8");
      }),
    );
  }

  async deleteFile(path: string): Promise<void> {
    this.assertAlive();
    const absolute = this.resolvePath(path);
    try {
      await rm(absolute);
    } catch (error) {
      throw this.asFileError(error, path);
    }
  }

  async rename(from: string, to: string): Promise<void> {
    this.assertAlive();
    const fromAbs = this.resolvePath(from);
    const toAbs = this.resolvePath(to);
    try {
      await mkdir(dirname(toAbs), { recursive: true });
      await rename(fromAbs, toAbs);
    } catch (error) {
      throw this.asFileError(error, from);
    }
  }

  async copy(from: string, to: string): Promise<void> {
    this.assertAlive();
    const fromAbs = this.resolvePath(from);
    const toAbs = this.resolvePath(to);
    try {
      await mkdir(dirname(toAbs), { recursive: true });
      await copyFile(fromAbs, toAbs);
    } catch (error) {
      throw this.asFileError(error, from);
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    this.assertAlive();
    const root = resolve(this.options.projectDir);
    const start = prefix !== undefined && prefix !== "" ? this.resolvePath(prefix) : root;
    const results: string[] = [];
    await walkDirectory(start, root, results);
    return results.sort();
  }

  exec(cmd: WorkflowRef | string): ProcessHandle {
    this.assertAlive();
    // Synchronous resolution: UNKNOWN_WORKFLOW / CONFIG_INVALID surface
    // immediately at the call site, not inside the handle.
    const resolved =
      typeof cmd === "string"
        ? { name: "(raw)", command: cmd, longRunning: false }
        : resolveWorkflow(loadWorkflowConfig(this.options.projectDir), cmd);

    const processHub = new LogHub();
    let tracked: TrackedProcess | null = null;
    let killed = false;

    // For long-running workflows the preview promise must exist BEFORE any
    // async startup work, so getPreviewUrl() called right after exec() awaits
    // the boot instead of throwing PREVIEW_UNAVAILABLE.
    let preview: { resolve: (url: string) => void; reject: (error: Error) => void } | null = null;
    if (resolved.longRunning) {
      this.previewReady = new Promise<string>((resolvePromise, rejectPromise) => {
        preview = { resolve: resolvePromise, reject: rejectPromise };
      });
      this.previewReady.catch(() => undefined);
    }

    const exited = this.startProcess(resolved, processHub, {
      isKilled: () => killed,
      onSpawn: (t) => {
        tracked = t;
      },
      preview,
    });
    // Branch handler so an ignored `exited` never raises unhandledRejection.
    exited.catch(() => undefined);

    return {
      get pid() {
        return tracked?.spawned.child.pid;
      },
      command: resolved.command,
      logs: processHub.subscribe(),
      exited,
      kill: async () => {
        killed = true;
        if (tracked !== null) {
          await killTree(tracked.spawned.child, this.options.killGraceMs);
        }
      },
    };
  }

  async installPackages(pkgs: string[]): Promise<Result> {
    this.assertAlive();
    if (pkgs.length === 0) {
      return { ok: true, exitCode: 0, logTail: "" };
    }
    const command = buildInstallCommand(detectPackageManager(this.options.projectDir), pkgs);
    this.hub.system(`installing packages: ${command}`);

    const processHub = new LogHub(100);
    const tail: string[] = [];
    const collect = (async () => {
      for await (const event of processHub.subscribe()) {
        tail.push(event.text);
        if (tail.length > 80) {
          tail.shift();
        }
      }
    })();

    const spawned = spawnProcess(command, { cwd: this.options.projectDir, env: this.options.env });
    const tracked: TrackedProcess = { spawned, processHub };
    this.live.add(tracked);
    this.wireProcessLogs(spawned, "(install)", processHub);

    const exit = await spawned.exited;
    this.live.delete(tracked);
    processHub.close();
    await collect;
    return { ok: exit.code === 0, exitCode: exit.code, logTail: tail.join("\n") };
  }

  async getPreviewUrl(): Promise<string> {
    this.assertAlive();
    if (this.previewReady === null) {
      throw new TargetError(
        "PREVIEW_UNAVAILABLE",
        'no long-running workflow is active — exec({ workflow: "dev" }) first',
      );
    }
    return this.previewReady;
  }

  streamLogs(): AsyncIterable<LogEvent> {
    return this.hub.subscribe();
  }

  async snapshot(): Promise<SnapshotRef> {
    this.assertAlive();
    const ref = await this.runGit(["rev-parse", "HEAD"]);
    return { kind: "git", ref };
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    const kills = await Promise.allSettled(
      [...this.live].map((tracked) => killTree(tracked.spawned.child, this.options.killGraceMs)),
    );
    if (kills.some((outcome) => outcome.status === "fulfilled" && outcome.value === false)) {
      this.hub.system("warning: a process tree survived the kill escalation");
    }
    if (this.proxy !== null) {
      await this.proxy.stop();
      this.proxy = null;
    }
    this.previewReady = null;
    this.hub.system("target destroyed");
    this.hub.close();
  }

  // --- internals ---

  private async startProcess(
    resolved: { name: string; command: string; longRunning: boolean },
    processHub: LogHub,
    hooks: {
      isKilled: () => boolean;
      onSpawn: (t: TrackedProcess) => void;
      preview: { resolve: (url: string) => void; reject: (error: Error) => void } | null;
    },
  ): Promise<ProcessExit> {
    const fail = (error: Error): never => {
      hooks.preview?.reject(error);
      throw error;
    };

    let command = resolved.command;
    const env: NodeJS.ProcessEnv = { ...this.options.env };

    if (resolved.longRunning) {
      const devPort = await allocatePort(stablePort(this.options.projectId, DEV_PORT_BASE)).catch(
        (error: Error) => fail(error),
      );
      command = substitutePort(command, devPort);
      env.PORT = String(devPort);
      env.NIHIL_DEV_PORT = String(devPort);
      this.hub.system(`dev port ${devPort} allocated`, { workflow: resolved.name });
    }

    if (hooks.isKilled() || this.destroyed) {
      processHub.close();
      hooks.preview?.reject(
        new TargetError("WORKFLOW_FAILED", `workflow "${resolved.name}" was killed before it spawned`),
      );
      return { code: null, signal: null };
    }

    const spawned = spawnProcess(command, { cwd: this.options.projectDir, env });
    const tracked: TrackedProcess = { spawned, processHub };
    this.live.add(tracked);
    hooks.onSpawn(tracked);
    this.wireProcessLogs(spawned, resolved.name, processHub);

    const spawnFailure = await spawned.spawnError;
    if (spawnFailure !== null) {
      this.live.delete(tracked);
      processHub.close();
      this.hub.system(`workflow "${resolved.name}" failed to spawn: ${spawnFailure.message}`, {
        workflow: resolved.name,
      });
      fail(
        new TargetError(
          "WORKFLOW_FAILED",
          `workflow "${resolved.name}" failed to spawn: ${spawnFailure.message}`,
        ),
      );
    }

    if (resolved.longRunning && hooks.preview !== null) {
      this.watchReady(resolved.name, spawned, processHub).then(hooks.preview.resolve, hooks.preview.reject);
    }

    const exit = await spawned.exited;
    this.live.delete(tracked);
    processHub.close();
    if (resolved.longRunning) {
      // The preview dies with its dev server: tear the proxy down and reset
      // so the next getPreviewUrl() reports PREVIEW_UNAVAILABLE, not a 502.
      if (this.proxy !== null) {
        await this.proxy.stop();
        this.proxy = null;
      }
      this.previewReady = null;
    }
    this.hub.system(`workflow "${resolved.name}" exited (code ${exit.code}, signal ${exit.signal})`, {
      workflow: resolved.name,
      pid: spawned.child.pid,
    });
    return exit;
  }

  private async watchReady(
    name: string,
    spawned: SpawnedProcess,
    processHub: LogHub,
  ): Promise<string> {
    const deadlineMs = this.options.readyTimeoutMs ?? 60_000;
    const upstreamUrl = await new Promise<string>((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => {
        rejectPromise(
          new TargetError("READY_TIMEOUT", `workflow "${name}" printed no dev-server URL within ${deadlineMs}ms`),
        );
      }, deadlineMs);
      timer.unref();

      void spawned.exited.then((exit) => {
        clearTimeout(timer);
        rejectPromise(
          new TargetError(
            "WORKFLOW_FAILED",
            `workflow "${name}" exited (code ${exit.code}) before its dev-server URL appeared`,
          ),
        );
      });

      void (async () => {
        for await (const event of processHub.subscribe()) {
          const url = extractDevServerUrl(event.text);
          if (url !== null) {
            clearTimeout(timer);
            resolvePromise(url);
            return;
          }
        }
      })().catch(rejectPromise);
    });

    // Proxy targets the port the server ACTUALLY bound (vite auto-increments
    // when its assigned port is taken; the printed URL is the truth).
    const upstream = new URL(upstreamUrl);
    const proxyPort = await allocatePort(stablePort(this.options.projectId, PROXY_PORT_BASE));
    const proxy = await startProxy({ port: proxyPort, upstream });
    if (this.destroyed) {
      // destroy() ran while the proxy was starting — don't leak the listener.
      await proxy.stop();
      throw new TargetError("TARGET_DESTROYED", "target destroyed during preview startup");
    }
    this.proxy = proxy;
    this.hub.system(`preview ready at ${proxy.url} (upstream ${upstream.origin})`, {
      workflow: name,
    });
    return proxy.url;
  }

  private wireProcessLogs(spawned: SpawnedProcess, workflow: string, processHub: LogHub): void {
    const pid = spawned.child.pid;
    const stdout = this.hub.createLineIngestor({ source: "stdout", workflow, pid }, [processHub]);
    const stderr = this.hub.createLineIngestor({ source: "stderr", workflow, pid }, [processHub]);
    spawned.child.stdout?.on("data", stdout.write);
    spawned.child.stderr?.on("data", stderr.write);
    spawned.child.stdout?.once("end", stdout.flush);
    spawned.child.stderr?.once("end", stderr.flush);
  }

  private resolvePath(raw: string): string {
    const normalized = normalizeProjectPath(raw);
    if (!normalized.ok) {
      throw new TargetError("PATH_FORBIDDEN", `forbidden path "${raw}": ${normalized.reason ?? "invalid"}`);
    }
    const root = resolve(this.options.projectDir);
    const absolute = resolve(root, normalized.path);
    // Defense-in-depth containment re-check. NTFS is case-insensitive, so the
    // comparison must be too, or a future caller could sneak past it.
    const fold = process.platform === "win32" ? (p: string) => p.toLowerCase() : (p: string) => p;
    if (fold(absolute) !== fold(root) && !fold(absolute).startsWith(fold(root) + sep)) {
      throw new TargetError("PATH_FORBIDDEN", `path "${raw}" escapes the project root`);
    }
    return absolute;
  }

  private asFileError(error: unknown, path: string): Error {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new TargetError("FILE_NOT_FOUND", `file not found: ${path}`);
    }
    return error as Error;
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new TargetError("TARGET_DESTROYED", "this target has been destroyed");
    }
  }

  private async runGit(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync("git", args, { cwd: this.options.projectDir });
    return stdout.trim();
  }
}

async function walkDirectory(dir: string, root: string, results: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    // Symlinks/junctions are never followed — a link pointing outside the
    // project would otherwise leak out-of-tree paths into listings.
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        await walkDirectory(absolute, root, results);
      }
    } else if (entry.isFile()) {
      results.push(relative(root, absolute).replaceAll("\\", "/"));
    }
  }
}
