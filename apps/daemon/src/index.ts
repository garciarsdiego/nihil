import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildServer({ version: config.version, logger: true });

  let shuttingDown = false;
  const shutdown = async (reason: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info({ reason }, "daemon shutting down");
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "daemon failed to close cleanly");
      process.exit(1);
    }
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  // SIGTERM never fires on win32; kept for macOS/Linux, with SIGBREAK as the
  // Windows counterpart and SIGHUP covering console close on both families.
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGHUP", () => void shutdown("SIGHUP"));
  if (process.platform === "win32") {
    process.once("SIGBREAK", () => void shutdown("SIGBREAK"));
  }

  // Sidecar mode (opt-in): the desktop shell spawns the daemon with piped
  // stdio and sets this flag; stdin ending or erroring then means the parent
  // died and signals would never arrive (Windows kills via TerminateProcess).
  if (process.env.NIHIL_DAEMON_WATCH_STDIN === "1") {
    process.stdin.on("end", () => void shutdown("stdin ended (parent exited)"));
    process.stdin.on("close", () => void shutdown("stdin closed (parent exited)"));
    process.stdin.on("error", () => void shutdown("stdin error (parent exited)"));
    process.stdin.resume();
  }

  await app.listen({ host: config.host, port: config.port });
}

void main().catch((error: unknown) => {
  console.error("daemon failed to start:", error);
  process.exit(1);
});
