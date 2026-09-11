import { createHash } from "node:crypto";
import type { SqliteDb } from "../../../lib/db.js";
import { ensureTaskResourceSchema } from "../../../lib/db/task-resource-schema.js";

const TASK_REFERENCE_VERSION = "task-reference-v1";

function lengthSafe(value: string): string {
  return `${Buffer.byteLength(value, "utf8")}:${value}`;
}

export function taskReferenceDigest(appId: string, taskId: string): string {
  const canonicalAppId = appId.trim().replace(/\.app$/, "");
  const canonicalTaskId = taskId.trim();
  if (!canonicalAppId || !canonicalTaskId) throw new Error("Task reference requires App and Task ids");
  return createHash("sha256")
    .update(`${TASK_REFERENCE_VERSION}\0${lengthSafe(canonicalAppId)}\0${lengthSafe(canonicalTaskId)}`)
    .digest("hex");
}

export function indexTaskReference(db: SqliteDb, appId: string, taskId: string, now = Date.now()): string {
  const canonicalAppId = appId.trim().replace(/\.app$/, "");
  const canonicalTaskId = taskId.trim();
  const digest = taskReferenceDigest(canonicalAppId, canonicalTaskId);
  db.prepare(
    `INSERT INTO app_task_refs(digest, prefix8, prefix16, app_id, task_id, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
  ).run(digest, digest.slice(0, 8), digest.slice(0, 16), canonicalAppId, canonicalTaskId, now);
  return digest;
}

/** One startup-only identity backfill; it never parses Task bodies or runs on a read. */
export function ensureTaskReferenceIndex(db: SqliteDb): void {
  ensureTaskResourceSchema(db);
  const rows = db
    .prepare(
      `SELECT app_id, task_id FROM app_tasks
       UNION
       SELECT app_id, receipt_id AS task_id FROM app_task_receipts
       EXCEPT
       SELECT app_id, task_id FROM app_task_refs`,
    )
    .all() as Array<{ app_id?: string; task_id?: string }>;
  if (rows.length === 0) return;
  // This is one logical migration. Autocommitting every identity separately
  // turns a modest backfill into thousands of journal flushes on a large Host
  // database and can prevent the control socket from opening before health
  // timeout. One transaction is both atomic and bounded by the missing rows.
  db.exec("BEGIN IMMEDIATE");
  try {
    const indexedAt = Date.now();
    for (const row of rows) {
      if (row.app_id && row.task_id) indexTaskReference(db, row.app_id, row.task_id, indexedAt);
    }
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the insertion failure.
    }
    throw error;
  }
}

export type ResolvedTaskReference = {
  appId: string;
  taskId: string;
  digest: string;
};

export type TaskReferenceResolution =
  | { kind: "resolved"; task: ResolvedTaskReference }
  | { kind: "ambiguous"; candidates: ResolvedTaskReference[] }
  | { kind: "missing" };

export function resolveTaskReference(db: SqliteDb, input: string): TaskReferenceResolution {
  const reference = input.trim().toLowerCase();
  if (!/^(?:[0-9a-f]{8}|[0-9a-f]{16}|[0-9a-f]{64})$/.test(reference)) {
    throw new Error("Task reference must contain 8, 16, or 64 hexadecimal characters");
  }
  const column = reference.length === 8 ? "prefix8" : reference.length === 16 ? "prefix16" : "digest";
  const rows = db
    .prepare(`SELECT app_id, task_id, digest FROM app_task_refs WHERE ${column} = ? ORDER BY app_id, task_id LIMIT 11`)
    .all(reference) as Array<{ app_id?: string; task_id?: string; digest?: string }>;
  const candidates = rows.flatMap((row) =>
    row.app_id && row.task_id && row.digest
      ? [{ appId: row.app_id, taskId: row.task_id, digest: row.digest }]
      : [],
  );
  if (candidates.length === 0) return { kind: "missing" };
  if (candidates.length > 1) return { kind: "ambiguous", candidates };
  return { kind: "resolved", task: candidates[0]! };
}

export function displayTaskReferences(
  db: SqliteDb,
  identities: Array<{ appId: string; taskId: string }>,
): Map<string, string> {
  const indexed = identities.map(({ appId, taskId }) => ({
    appId,
    taskId,
    digest: taskReferenceDigest(appId, taskId),
  }));
  const prefixes = [...new Set(indexed.map((item) => item.digest.slice(0, 8)))];
  const collisionCounts = new Map<string, number>();
  const prefix16CollisionCounts = new Map<string, number>();
  if (prefixes.length > 0) {
    const rows = db
      .prepare(
        `SELECT prefix8, COUNT(*) AS count FROM app_task_refs
         WHERE prefix8 IN (${prefixes.map(() => "?").join(", ")}) GROUP BY prefix8`,
      )
      .all(...prefixes) as Array<{ prefix8?: string; count?: number }>;
    for (const row of rows) if (row.prefix8) collisionCounts.set(row.prefix8, Number(row.count ?? 0));
    const collidingPrefix16 = [
      ...new Set(
        indexed
          .filter((item) => (collisionCounts.get(item.digest.slice(0, 8)) ?? 0) > 1)
          .map((item) => item.digest.slice(0, 16)),
      ),
    ];
    if (collidingPrefix16.length > 0) {
      const prefix16Rows = db
        .prepare(
          `SELECT prefix16, COUNT(*) AS count FROM app_task_refs
           WHERE prefix16 IN (${collidingPrefix16.map(() => "?").join(", ")}) GROUP BY prefix16`,
        )
        .all(...collidingPrefix16) as Array<{ prefix16?: string; count?: number }>;
      for (const row of prefix16Rows) {
        if (row.prefix16) prefix16CollisionCounts.set(row.prefix16, Number(row.count ?? 0));
      }
    }
  }
  return new Map(
    indexed.map((item) => {
      const prefix8 = item.digest.slice(0, 8);
      const prefix16 = item.digest.slice(0, 16);
      const value =
        (collisionCounts.get(prefix8) ?? 0) <= 1
          ? prefix8
          : (prefix16CollisionCounts.get(prefix16) ?? 0) <= 1
            ? prefix16
            : item.digest;
      return [`${item.appId}\0${item.taskId}`, value];
    }),
  );
}
