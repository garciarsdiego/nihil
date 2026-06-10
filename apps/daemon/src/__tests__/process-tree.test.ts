import { fileURLToPath } from "node:url";
import { killTree, spawnProcess } from "../exec/process-tree.js";
import { pidAlive, pollUntil } from "./helpers.js";

const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));

describe("process-tree", () => {
  it(
    "kills the full tree — shell, parent, and grandchild",
    async () => {
      // Relative command + cwd avoids quoting the space in this repo's path.
      const spawned = spawnProcess("node parent.cjs", { cwd: fixturesDir });

      const childPid = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("no CHILD_PID within 10s")), 10_000);
        spawned.child.stdout?.on("data", (chunk: Buffer) => {
          const match = /CHILD_PID:(\d+)/.exec(chunk.toString());
          if (match !== null) {
            clearTimeout(timer);
            resolve(Number(match[1]));
          }
        });
        void spawned.spawnError.then((error) => {
          if (error !== null) {
            clearTimeout(timer);
            reject(error);
          }
        });
      });
      const parentPid = spawned.child.pid;
      expect(parentPid).toBeTypeOf("number");
      expect(pidAlive(childPid)).toBe(true);

      const confirmed = await killTree(spawned.child);
      expect(confirmed).toBe(true);
      // On win32 this exercised taskkill /PID /T /F through the cmd.exe chain.
      await pollUntil(() => !pidAlive(childPid), 8000, "grandchild death");
      await pollUntil(() => !pidAlive(parentPid as number), 8000, "parent death");
    },
    30_000,
  );

  it(
    "resolves cleanly for an already-exited process",
    async () => {
      const spawned = spawnProcess('node -e "process.exit(0)"', { cwd: fixturesDir });
      await spawned.exited;
      await expect(killTree(spawned.child)).resolves.toBe(true);
    },
    15_000,
  );
});
