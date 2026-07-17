import { closeAllDbs, getDb } from "../../lib/db/connection.js";
import {
  legacyStorageMigrationUpdatedCount,
  migrateLegacyStoragePass,
} from "../../lib/db/legacy-storage-migration.js";

function parseBatchSize(argv: string[]): number {
  const index = argv.indexOf("--legacy-migration-batch-size");
  const value = index >= 0 ? Number(argv[index + 1]) : 100;
  return Number.isFinite(value) ? Math.max(1, Math.min(value, 1_000)) : 100;
}

export async function runLegacyStorageMigrationMode(opts: {
  persistDir: string;
  argv?: string[];
}): Promise<void> {
  const argv = opts.argv ?? process.argv;
  const batchSize = parseBatchSize(argv);
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  let pass = 0;
  let removedSqlBytes = 0;
  const updated = { events: 0, sessions: 0, workflowRuns: 0, sessionDigests: 0 };

  try {
    while (!stopping) {
      pass += 1;
      const startedAt = Date.now();
      const result = migrateLegacyStoragePass(opts.persistDir, { batchSize });
      removedSqlBytes += result.removedSqlBytes;
      for (const key of Object.keys(updated) as Array<keyof typeof updated>) {
        updated[key] += result.updated[key];
      }
      console.log(JSON.stringify({
        type: "db.legacy_storage_migration.pass_completed",
        pass,
        durationMs: Date.now() - startedAt,
        ...result,
      }));
      if (legacyStorageMigrationUpdatedCount(result) === 0) break;

      const db = getDb(opts.persistDir);
      try { db.prepare("PRAGMA wal_checkpoint(PASSIVE)").get(); } catch { /* best effort */ }
      try { db.exec("PRAGMA incremental_vacuum(1_000)"); } catch { /* best effort */ }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    console.log(JSON.stringify({
      type: stopping ? "db.legacy_storage_migration.stopped" : "db.legacy_storage_migration.completed",
      passes: pass,
      updated,
      removedSqlBytes,
    }));
  } finally {
    closeAllDbs();
  }
}
