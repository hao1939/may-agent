import { expect, test } from "bun:test";
import { openDatabase } from "../db.js";
import { applyDbSchema } from "./schema.js";
import { normalizeLegacyTaskFormats } from "./legacy-task-formats.js";
import { matchesAppTaskSpecHash } from "../../app/core/tasks/app-task-reconciler.js";
import { createHash } from "node:crypto";

function legacyDb() {
  const db = openDatabase(":memory:");
  applyDbSchema(db);
  db.exec("DELETE FROM host_schema_migrations");
  return db;
}

test("schema normalization preserves generation, replay hashes and results and runs once across reopen", () => {
  const db = legacyDb();
  const intent = { id: "work", outcome: "Retain useful work", acceptance: ["Preserve the accepted result"] };
  // Retained encoding from the pre-cutover Host, including its sorted fields.
  const specHash = createHash("sha256").update(JSON.stringify({ acceptance: intent.acceptance, dependsOn: [],
    executor: "agent", input: {}, mode: "maintain", outcome: intent.outcome, outputs: [], owner: "worker", workflow: null })).digest("hex");
  const resource = { metadata: { id: "work", generation: 7, resourceVersion: 12 },
    spec: { ...intent, mode: "maintain" }, status: { phase: "converged", summary: "Accepted result" } };
  const attempt = { taskId: "work", taskGeneration: 7, handler: "owner:worker", owner: "worker", specHash,
    acceptedResult: { summary: "Accepted result", result: { evidence: "retained" } } };
  const admission = { taskId: "work", taskGeneration: 7, specHash };
  try {
    db.prepare(`INSERT INTO app_tasks(app_id, task_id, generation, resource_version, observed_generation,
      phase, lane, changed, ready, updated_at, resource_json) VALUES ('sample', 'work', 7, 12, 7, 'converged', 'normal', 0, 0, 100, ?)`)
      .run(JSON.stringify(resource));
    db.prepare(`INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
      VALUES ('sample', 'attempt', 'work', 7, 'completed', 100, ?)`).run(JSON.stringify(attempt));
    db.prepare("INSERT INTO app_task_admissions VALUES ('sample', 'input-key', ?)").run(JSON.stringify(admission));
    db.prepare("INSERT INTO app_task_conditions VALUES ('sample', 'approval', 'unknown', ?)")
      .run(JSON.stringify({ spec: { owner: "Hao", type: "project.approval.submitted" }, status: { state: "unknown" } }));
    applyDbSchema(db);
    expect(JSON.parse(String(db.prepare("SELECT resource_json FROM app_tasks").get()!.resource_json)))
      .toEqual({ ...resource, spec: intent });
    expect(JSON.parse(String(db.prepare("SELECT attempt_json FROM app_task_attempts").get()!.attempt_json)))
      .toEqual({ ...attempt, handler: "agent:worker" });
    expect(JSON.parse(String(db.prepare("SELECT admission_json FROM app_task_admissions").get()!.admission_json))).toEqual(admission);
    expect(matchesAppTaskSpecHash(intent, "worker", specHash)).toBe(true);
    expect(matchesAppTaskSpecHash({ ...intent, outcome: "Different work" }, "worker", specHash)).toBe(false);
    expect(db.prepare("SELECT json_extract(condition_json, '$.spec.owner') AS owner FROM app_task_conditions").get())
      .toEqual({ owner: "human:Hao" });
    const revision = db.prepare("SELECT value FROM app_task_store_meta WHERE app_id='sample' AND key='revision'").get();
    expect(revision).toEqual({ value: "1" });
    const plan = db.prepare("SELECT sql FROM sqlite_master WHERE name='idx_app_task_conditions_open_human_owner'").get();
    expect(String(plan!.sql)).not.toContain("= 'Hao'");
    applyDbSchema(db);
    expect(db.prepare("SELECT value FROM app_task_store_meta WHERE app_id='sample' AND key='revision'").get()).toEqual(revision);
  } finally { db.close(); }
});

test("unconverted receipts fail before rewriting any Task evidence or completing the migration", () => {
  const db = legacyDb();
  try {
    db.exec("CREATE TABLE app_task_receipts(app_id TEXT, receipt_id TEXT, receipt_json TEXT)");
    db.prepare("INSERT INTO app_task_receipts VALUES ('sample', 'work', ?)")
      .run(JSON.stringify({ metadata: { generation: 1 }, specHash: "unconverted" }));
    expect(() => normalizeLegacyTaskFormats(db)).toThrow("unconverted legacy app_task_receipts");
    expect(db.prepare("SELECT receipt_id FROM app_task_receipts").get()).toEqual({ receipt_id: "work" });
    expect(db.prepare("SELECT * FROM host_schema_migrations").all()).toEqual([]);
    db.exec("DELETE FROM app_task_receipts");
    expect(() => normalizeLegacyTaskFormats(db)).not.toThrow();
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='app_task_receipts'").get()).toBeNull();
  } finally { db.close(); }
});
