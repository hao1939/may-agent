/**
 * system-dashboard.ts — Read-only CLI status summary for `--status`
 *
 * Reads `may.db` without mutating `persistDir` and without copying multi-GB
 * live databases during normal closed or daemon-active operation.
 */

import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { openQueryOnlyDatabase, openReadOnlyDatabase, type SqliteDb } from "../db.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const TELEGRAM_CHUNK_LIMIT = 4000;

export interface StatusOptions {
  includeProcessHealth?: boolean;
  /** Test hook invoked after WAL presence check and before opening the database. */
  onBeforeAttach?: () => void;
  /** Test hook invoked inside the active read transaction after acquiring a WAL read-mark. */
  onSnapshotAcquired?: () => void;
}

function queryStatusDb<T>(
  dbPath: string,
  run: (db: SqliteDb) => T,
  hooks?: Pick<StatusOptions, "onBeforeAttach" | "onSnapshotAcquired">,
): T {
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;

  // Orphaned crash WAL (-wal present without -shm): isolate in tmpdir so WAL
  // recovery neither creates a -shm sidecar nor checkpoints persistDir/may.db.
  if (existsSync(walPath) && !existsSync(shmPath)) {
    const snapshotDir = mkdtempSync(join(tmpdir(), "may-status-crash-wal-"));
    try {
      const snapDb = join(snapshotDir, "may.db");
      copyFileSync(dbPath, snapDb);
      if (existsSync(walPath)) copyFileSync(walPath, `${snapDb}-wal`);
      const recoveredDb = openReadOnlyDatabase(snapDb);
      try {
        return run(recoveredDb);
      } finally {
        recoveredDb.close();
      }
    } finally {
      rmSync(snapshotDir, { recursive: true, force: true });
    }
  }

  hooks?.onBeforeAttach?.();

  let db: SqliteDb;
  let transactional = true;
  try {
    // Real SQLite WAL locking (`O_RDWR` + `PRAGMA query_only = ON`, no CREATE):
    // 1. Holds a genuine WAL read-mark during the deferred read transaction so
    //    concurrent writer commit + checkpoint + close cannot mix/tear pages.
    // 2. Holds an O_RDWR descriptor so `walClose` can acquire `F_WRLCK` when
    //    this probe is the last connection, unlinking `-wal`/`-shm` cleanly
    //    instead of stranding sidecars as `O_RDONLY` connections do on POSIX.
    db = openQueryOnlyDatabase(dbPath);
  } catch {
    // Read-only filesystem / file mode fallback where OS permissions forbid any local writer.
    transactional = false;
    db = openReadOnlyDatabase(`${pathToFileURL(dbPath).href}?immutable=1`);
  }

  try {
    if (!transactional) return run(db);
    db.exec("BEGIN DEFERRED");
    try {
      // Touch sqlite_schema to pin the MVCC WAL read-mark before running queries.
      db.prepare("SELECT 1 FROM sqlite_master LIMIT 1").get();
      hooks?.onSnapshotAcquired?.();
      return run(db);
    } finally {
      try {
        db.exec("COMMIT");
      } catch {
        // Ignore if connection was already rolled back
      }
    }
  } finally {
    db.close();
  }
}

export function chunkStatusMessage(status: string, maxLen = TELEGRAM_CHUNK_LIMIT): string[] {
  if (status.length <= maxLen) return [status];
  const chunks: string[] = [];
  let current = "";
  let hasLines = false;
  for (const rawLine of status.split("\n")) {
    let line = rawLine;
    while (line.length > maxLen) {
      if (hasLines) {
        chunks.push(current);
        current = "";
        hasLines = false;
      }
      chunks.push(line.slice(0, maxLen));
      line = line.slice(maxLen);
    }
    const nextLen = current.length + line.length + (hasLines ? 1 : 0);
    if (hasLines && nextLen > maxLen) {
      chunks.push(current);
      current = line;
      hasLines = true;
    } else {
      current += (hasLines ? "\n" : "") + line;
      hasLines = true;
    }
  }
  if (hasLines) chunks.push(current);
  return chunks;
}

export function printSystemStatus(persistDir: string, opts?: StatusOptions): string {
  const dbPath = join(persistDir, "may.db");
  const lines = ["may-agent status", "═".repeat(62)];

  if (!existsSync(dbPath)) {
    lines.push("  No runtime database found.", "");
    return lines.join("\n");
  }

  const since = Date.now() - DAY_MS;
  const agentRows = queryStatusDb(
    dbPath,
    (db) =>
      db
        .prepare(
          `SELECT agent,
                  COUNT(*) AS total,
                  SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed,
                  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS failed
           FROM sessions
           WHERE startedAt >= ?
           GROUP BY agent
           ORDER BY total DESC, agent ASC`,
        )
        .all(since) as Array<{
        agent: string;
        total: number;
        completed: number;
        failed: number;
      }>,
    opts,
  );

  lines.push("", "─".repeat(62), " AGENTS (last 24h)", "─".repeat(62));
  if (agentRows.length > 0) {
    lines.push(
      `  ${"Agent".padEnd(16)} ${"Sess".padStart(5)} ${"Done".padStart(5)} ${"Fail".padStart(5)} ${"Rate".padStart(6)}`,
    );
    for (const s of agentRows) {
      const total = Number(s.total ?? 0);
      const completed = Number(s.completed ?? 0);
      const failed = Number(s.failed ?? 0);
      const rate = total > 0 ? `${Math.round((completed / total) * 100)}%` : "—";
      lines.push(
        `  ${String(s.agent).padEnd(16)} ${String(total).padStart(5)} ${String(completed).padStart(5)} ${String(failed).padStart(5)} ${rate.padStart(6)}`,
      );
    }
  } else {
    lines.push("  No sessions in the last 24h.");
  }

  lines.push("");
  return lines.join("\n");
}

export async function notifyStatus(
  persistDir: string,
  sendFn: typeof fetch = fetch,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_ID || "").split(",").filter(Boolean);
  if (!token || chatIds.length === 0) {
    console.error("[status] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — cannot notify");
    return;
  }
  const chunks = chunkStatusMessage(printSystemStatus(persistDir));
  for (const chatId of chatIds) {
    for (const chunk of chunks) {
      try {
        const resp = await sendFn(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: chunk }),
        });
        if (!resp.ok) {
          console.error(`[status] Telegram send failed: ${resp.status} ${await resp.text()}`);
        }
      } catch (err) {
        console.error(`[status] Telegram send error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
