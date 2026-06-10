import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { FrameworkKind } from "./target.js";

/**
 * Config-file detection first (dyad order: next wins over vite when both
 * exist), package.json dependencies as fallback. Purely static — never
 * executes project code.
 */
export async function detectFramework(projectDir: string): Promise<FrameworkKind> {
  const entries = await readdir(projectDir).catch(() => [] as string[]);
  if (hasConfig(entries, "next.config")) {
    return "nextjs";
  }
  if (hasConfig(entries, "vite.config")) {
    return "vite";
  }

  const deps = await readDependencyNames(projectDir);
  if (deps.has("next")) {
    return "nextjs";
  }
  if (deps.has("vite")) {
    return "vite";
  }
  return "other";
}

function hasConfig(entries: readonly string[], base: string): boolean {
  return entries.some((entry) => entry.startsWith(`${base}.`));
}

async function readDependencyNames(projectDir: string): Promise<ReadonlySet<string>> {
  try {
    const raw = await readFile(join(projectDir, "package.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return new Set();
    }
    const pkg = parsed as { dependencies?: unknown; devDependencies?: unknown };
    return new Set([
      ...dependencyKeys(pkg.dependencies),
      ...dependencyKeys(pkg.devDependencies),
    ]);
  } catch {
    return new Set();
  }
}

function dependencyKeys(value: unknown): string[] {
  return typeof value === "object" && value !== null ? Object.keys(value) : [];
}
