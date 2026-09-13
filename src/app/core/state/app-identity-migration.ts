import type { AppDefinition } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { indexTaskReference } from "./task-reference-index.js";

const APP_ID_TABLES = [
  "app_task_events",
  "app_task_relations",
  "app_task_attempts",
  "app_task_condition_routes",
  "app_task_conditions",
  "app_task_receipts",
  "app_task_cancellations",
  "app_task_control_receipts",
  "app_task_groups",
  "app_task_admissions",
  "app_tasks",
  "app_task_store_meta",
  "app_event_admission_commands",
  "app_inbox_items",
  "conversation_requests",
  "conversation_topics",
  "conversation_topic_tasks",
  "sessions",
  "workflow_runs",
] as const;

const OWNED_JSON_COLUMNS = [
  ["app_tasks", "resource_json"],
  ["app_tasks", "trigger_json"],
  ["app_task_attempts", "attempt_json"],
  ["app_task_conditions", "condition_json"],
  ["app_task_receipts", "receipt_json"],
  ["app_task_cancellations", "cancellation_json"],
  ["app_task_control_receipts", "receipt_json"],
  ["app_task_groups", "group_json"],
  ["app_task_admissions", "admission_json"],
  ["app_event_admission_commands", "payload"],
  ["app_inbox_items", "handling"],
  ["app_inbox_items", "result"],
] as const;

function parseObject(value: unknown, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // Report one stable migration error below.
  }
  throw new Error(`${label} contains invalid JSON`);
}

function rewriteIdentityFields(value: unknown, oldId: string, canonicalId: string): boolean {
  if (!value || typeof value !== "object") return false;
  let changed = false;
  const entries: Array<[string, unknown]> = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value as Record<string, unknown>);
  for (const [key, item] of entries) {
    if ((key === "appId" || key === "project" || key === "projectId") && item === oldId) {
      (value as Record<string, unknown>)[key] = canonicalId;
      changed = true;
      continue;
    }
    if (key === "owner" && item === `app:${oldId}`) {
      (value as Record<string, unknown>)[key] = `app:${canonicalId}`;
      changed = true;
      continue;
    }
    if (rewriteIdentityFields(item, oldId, canonicalId)) changed = true;
  }
  return changed;
}

function updateOwnedJson(db: SqliteDb, table: string, column: string, oldId: string, canonicalId: string): void {
  const rows = db
    .prepare(`SELECT rowid, ${column} FROM ${table} WHERE app_id = ? AND ${column} IS NOT NULL`)
    .all(oldId) as Array<Record<string, unknown>>;
  const write = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`);
  for (const row of rows) {
    const value = parseObject(row[column], `${table}.${column}`);
    if (rewriteIdentityFields(value, oldId, canonicalId)) write.run(JSON.stringify(value), row.rowid);
  }
}

function rewriteLiveReferences(db: SqliteDb, oldId: string, canonicalId: string): void {
  for (const [table, column] of OWNED_JSON_COLUMNS) {
    updateOwnedJson(db, table, column, oldId, canonicalId);
  }
  const metadata = db
    .prepare("SELECT rowid, value FROM app_task_store_meta WHERE app_id = ? AND key = 'app_metadata'")
    .all(oldId) as Array<Record<string, unknown>>;
  const updateMetadata = db.prepare("UPDATE app_task_store_meta SET value = ? WHERE rowid = ?");
  for (const row of metadata) {
    const value = parseObject(row.value, "app_task_store_meta.value");
    if (rewriteIdentityFields(value, oldId, canonicalId)) updateMetadata.run(JSON.stringify(value), row.rowid);
  }

  const requestRows = db.prepare("SELECT rowid, task_refs FROM conversation_requests").all() as Array<
    Record<string, unknown>
  >;
  const updateRequest = db.prepare("UPDATE conversation_requests SET task_refs = ? WHERE rowid = ?");
  for (const row of requestRows) {
    let refs: unknown;
    try {
      refs = JSON.parse(String(row.task_refs));
    } catch {
      throw new Error("conversation_requests.task_refs contains invalid JSON");
    }
    if (!Array.isArray(refs)) throw new Error("conversation_requests.task_refs contains invalid JSON");
    const changed = rewriteIdentityFields(refs, oldId, canonicalId);
    if (changed) updateRequest.run(JSON.stringify(refs), row.rowid);
  }

  db.prepare("UPDATE app_inbox_items SET source_id = ? WHERE source_kind = 'app' AND source_id = ?").run(
    canonicalId,
    oldId,
  );
  db.prepare(
    `UPDATE app_inbox_items
     SET idempotency_key = ? || substr(idempotency_key, length(?) + 1)
     WHERE source_kind = 'app' AND idempotency_key LIKE ?`,
  ).run(`task-dependency:${canonicalId}:`, `task-dependency:${oldId}:`, `task-dependency:${oldId}:%`);
  db.prepare(
    `UPDATE app_inbox_items
     SET idempotency_key = ? || substr(idempotency_key, length(?) + 1)
     WHERE idempotency_key LIKE ?`,
  ).run(`schedule:${canonicalId}:`, `schedule:${oldId}:`, `schedule:${oldId}:%`);

  db.prepare("UPDATE sessions SET projectId = ? WHERE projectId = ?").run(canonicalId, oldId);
  db.prepare("UPDATE workflow_runs SET projectId = ? WHERE projectId = ?").run(canonicalId, oldId);
  db.prepare("UPDATE notification_messages SET project_id = ? WHERE project_id = ?").run(canonicalId, oldId);
  db.prepare("UPDATE metrics SET project = ? WHERE project = ?").run(canonicalId, oldId);
  db.prepare("UPDATE projects SET id = ?, name = CASE WHEN name = ? THEN ? ELSE name END WHERE id = ?").run(
    canonicalId,
    oldId,
    canonicalId,
    oldId,
  );
}

function migrateOne(db: SqliteDb, oldId: string, canonicalId: string): void {
  rewriteLiveReferences(db, oldId, canonicalId);
  db.prepare(
    `INSERT OR IGNORE INTO app_task_ref_aliases(digest, prefix8, prefix16, app_id, task_id, indexed_at)
     SELECT digest, prefix8, prefix16, ?, task_id, indexed_at FROM app_task_refs WHERE app_id = ?`,
  ).run(canonicalId, oldId);
  db.prepare("DELETE FROM app_task_refs WHERE app_id = ?").run(oldId);
  for (const table of APP_ID_TABLES)
    db.prepare(`UPDATE ${table} SET app_id = ? WHERE app_id = ?`).run(canonicalId, oldId);

  const taskIds = db
    .prepare(
      `SELECT task_id FROM app_tasks WHERE app_id = ?
       UNION SELECT receipt_id AS task_id FROM app_task_receipts WHERE app_id = ?`,
    )
    .all(canonicalId, canonicalId) as Array<{ task_id?: string }>;
  for (const row of taskIds) if (row.task_id) indexTaskReference(db, canonicalId, row.task_id);
}

export type AppIdentityMigrationPublication = Readonly<{
  commit(): void;
  rollback(): void;
}>;

/** Stage declared prior identities in the registry publication transaction. */
export function stageAppIdentityMigration(
  db: SqliteDb,
  definitions: readonly AppDefinition[],
): AppIdentityMigrationPublication | null {
  const renames = definitions.flatMap((definition) =>
    (definition.previousIds ?? []).map((previousId) => ({ oldId: previousId, canonicalId: definition.id })),
  );
  if (renames.length === 0) return null;

  db.exec("BEGIN IMMEDIATE");
  let active = true;
  try {
    db.exec("PRAGMA defer_foreign_keys = ON");
    for (const { oldId, canonicalId } of renames) {
      try {
        migrateOne(db, oldId, canonicalId);
      } catch (error) {
        throw new Error(
          `Cannot rename App ${oldId} to ${canonicalId}: conflicting or invalid persisted state (${error instanceof Error ? error.message : String(error)})`,
          { cause: error },
        );
      }
    }
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the migration error.
    }
    throw error;
  }
  return Object.freeze({
    commit() {
      if (!active) throw new Error("App identity migration transaction is already closed");
      db.exec("COMMIT");
      active = false;
    },
    rollback() {
      if (!active) return;
      db.exec("ROLLBACK");
      active = false;
    },
  });
}

/** Move declared prior App identities before any runtime opens their canonical stores. */
export function migrateAppIdentities(db: SqliteDb, definitions: readonly AppDefinition[]): void {
  const publication = stageAppIdentityMigration(db, definitions);
  publication?.commit();
}
