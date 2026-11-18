import type { SqliteDb } from "../db.js";

/** Old completion receipts must never disappear without matching retained evidence. */
export function assertConvertedTaskReceipts(db: SqliteDb): void {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_task_receipts'").get()) return;
  const row = db.prepare(`SELECT r.app_id, r.receipt_id FROM app_task_receipts r
    WHERE NOT EXISTS (SELECT 1 FROM app_task_attempts a
      WHERE a.app_id = r.app_id AND a.task_id = r.receipt_id
        AND a.task_generation = json_extract(r.receipt_json, '$.metadata.generation')
        AND json_extract(a.attempt_json, '$.runtimeId') = 'retired:task-receipt'
        AND json_extract(a.attempt_json, '$.specHash') = json_extract(r.receipt_json, '$.specHash'))
    LIMIT 1`).get();
  if (row) throw new Error(`App ${row.app_id} still contains unconverted legacy app_task_receipts rows (Task ${row.receipt_id}); convert and remove legacy completion receipts before opening the database`);
}

/** Runs under the schema upgrade transaction (a savepoint also supports standalone stores). */
export function normalizeLegacyTaskFormats(db: SqliteDb): void {
  db.exec("CREATE TABLE IF NOT EXISTS host_schema_migrations (id TEXT PRIMARY KEY)");
  if (db.prepare("SELECT 1 FROM host_schema_migrations WHERE id = 'task-formats-20261118'").get()) return;
  db.exec("SAVEPOINT legacy_task_formats");
  try {
    assertConvertedTaskReceipts(db);
    // Capture affected Apps before rewriting rows so cached readers are invalidated once.
    const apps = db.prepare(`SELECT app_id FROM app_task_attempts
      WHERE json_extract(attempt_json, '$.handler') LIKE 'owner:%'
      UNION SELECT app_id FROM app_tasks WHERE json_type(resource_json, '$.spec.mode') IS NOT NULL
      UNION SELECT app_id FROM app_task_conditions
      WHERE trim(json_extract(condition_json, '$.spec.owner')) = 'Hao'`).all();
    db.exec(`UPDATE app_task_attempts SET attempt_json = json_set(attempt_json, '$.handler',
        'agent:' || substr(json_extract(attempt_json, '$.handler'), 7))
      WHERE json_extract(attempt_json, '$.handler') LIKE 'owner:%';
      UPDATE app_tasks SET resource_json = json_remove(resource_json, '$.spec.mode')
      WHERE json_type(resource_json, '$.spec.mode') IS NOT NULL;
      UPDATE app_task_conditions SET condition_json = json_set(condition_json, '$.spec.owner', 'human:Hao')
      WHERE trim(json_extract(condition_json, '$.spec.owner')) = 'Hao';`);
    // Hashes are immutable replay evidence. Old generations may no longer have
    // their desired spec; removing mode cannot recover a different SHA-256 hash.
    // The small admission hash comparator continues to recognize those records.
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_task_receipts'").get()) {
      db.exec("DROP TABLE app_task_receipts");
    }
    db.exec(`DROP INDEX IF EXISTS idx_app_task_conditions_open_human_owner;
      CREATE INDEX idx_app_task_conditions_open_human_owner ON app_task_conditions(app_id, condition_id)
      WHERE state != 'true' AND (trim(json_extract(condition_json, '$.spec.owner')) = 'human'
        OR trim(json_extract(condition_json, '$.spec.owner')) GLOB 'human:?*');`);
    for (const app of apps) db.prepare(`INSERT INTO app_task_store_meta(app_id, key, value) VALUES (?, 'revision', '1')
      ON CONFLICT(app_id, key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`).run(app.app_id);
    db.prepare("INSERT INTO host_schema_migrations(id) VALUES ('task-formats-20261118')").run();
    db.exec("RELEASE legacy_task_formats");
  } catch (error) {
    db.exec("ROLLBACK TO legacy_task_formats");
    db.exec("RELEASE legacy_task_formats");
    throw error;
  }
}
