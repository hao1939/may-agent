import { runDbMaintenancePass } from "../../lib/db/maintenance.js";
import { closeAllDbs } from "../../lib/db/connection.js";

function parseIntervalMs(argv: string[]): number {
  const index = argv.indexOf("--maintenance-interval-ms");
  const value = index >= 0 ? Number(argv[index + 1]) : 60 * 60 * 1_000;
  return Number.isFinite(value) ? Math.max(60_000, value) : 60 * 60 * 1_000;
}

export async function runMaintenanceMode(opts: {
  persistDir: string;
  argv?: string[];
}): Promise<void> {
  const argv = opts.argv ?? process.argv;
  const once = argv.includes("--maintenance-once");
  const intervalMs = parseIntervalMs(argv);
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    do {
      const startedAt = Date.now();
      try {
        const result = runDbMaintenancePass(opts.persistDir);
        console.log(JSON.stringify({ type: "db.maintenance.completed", startedAt, durationMs: Date.now() - startedAt, ...result }));
      } catch (error) {
        console.error(JSON.stringify({
          type: "db.maintenance.failed",
          startedAt,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
      if (once || stopping) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          clearInterval(poll);
          resolve();
        }, intervalMs);
        const poll = setInterval(() => {
          if (!stopping) return;
          clearInterval(poll);
          clearTimeout(timer);
          resolve();
        }, 250);
      });
    } while (!stopping);
  } finally {
    closeAllDbs();
  }
}
