import { describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "./connection.js";
import { runDbMaintenancePass } from "./maintenance.js";
import { openDatabase } from "../db.js";
import { createAppInboxItem } from "../../app/core/state/app-inbox-store.js";

describe("bounded DB maintenance", () => {
  it.each([
    { table: "event_traces", key: "event_id", counter: "event_traces" },
    { table: "event_trace_links", key: "id", counter: "event_trace_links_orphaned" },
  ])("finds $table orphans without blocking a writer and rechecks before deletion", ({ table, key, counter }) => {
    const root = mkdtempSync(join(tmpdir(), "may-maintenance-orphan-race-"));
    const db = getDb(root);
    const writer = openDatabase(join(root, "may.db"));
    writer.exec("PRAGMA busy_timeout = 0");
    const now = Date.now();
    const insertEvent = "INSERT INTO events(id, event_type, timestamp) VALUES (?, 'fixture', ?)";
    db.prepare(insertEvent).run(1, now);
    if (table === "event_traces") {
      for (const id of [10, 20, 30])
        db.prepare("INSERT INTO event_traces(event_id, trace_id) VALUES (?, 'fixture')").run(id);
    } else {
      // Exercise both sides of the missing-endpoint predicate. Row 30 is
      // outside this batch even though its second endpoint is missing.
      for (const [id, from, to] of [[10, 10, 1], [20, 1, 20], [30, 1, 30]])
        db.prepare("INSERT INTO event_trace_links(id, from_event_id, to_event_id, type, created_at) VALUES (?, ?, ?, 'fixture', ?)")
          .run(id, from, to, now);
    }
    const prepare = db.prepare.bind(db);
    let candidateReads = 0;
    const spy = spyOn(db, "prepare").mockImplementation((sql) => {
      const statement = prepare(sql);
      if (!sql.trimStart().startsWith(`SELECT ${key} AS id FROM ${table}`)) return statement;
      return {
        ...statement,
        all: (...params) => {
          candidateReads++;
          // The real scan must succeed with another connection holding the
          // writer slot. Publish a previously missing event after selection.
          writer.exec("BEGIN IMMEDIATE");
          try {
            writer.prepare(insertEvent).run(100 + candidateReads, now);
            const rows = statement.all(...params);
            if (candidateReads === 1) writer.prepare(insertEvent).run(10, now);
            writer.exec("COMMIT");
            return rows;
          } catch (error) {
            writer.exec("ROLLBACK");
            throw error;
          }
        },
      };
    });
    try {
      const first = runDbMaintenancePass(root, { now, batchSize: 2 });
      expect(candidateReads).toBe(1);
      expect(first.deleted[counter]).toBe(1);
      expect(prepare(`SELECT ${key} FROM ${table} WHERE ${key} IN (10, 20, 30) ORDER BY ${key}`).all())
        .toEqual([{ [key]: 10 }, { [key]: 30 }]);
      expect(writer.prepare("SELECT id FROM events WHERE id = 101").get()).toEqual({ id: 101 });

      const second = runDbMaintenancePass(root, { now, batchSize: 2 });
      expect(second.deleted[counter]).toBe(1);
      const third = runDbMaintenancePass(root, { now, batchSize: 2 });
      expect(third.deleted[counter]).toBe(0);
      expect(candidateReads).toBe(3);
      expect(prepare(`SELECT ${key} FROM ${table} WHERE ${key} IN (10, 20, 30)`).all()).toEqual([{ [key]: 10 }]);
    } finally {
      spy.mockRestore();
      writer.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("discovers expired rows alongside another writer and rechecks changes before deleting", () => {
    const root = mkdtempSync(join(tmpdir(), "may-maintenance-expiry-race-"));
    const db = getDb(root);
    const writer = openDatabase(join(root, "may.db"));
    writer.exec("PRAGMA busy_timeout = 0");
    const now = 10 * 86_400_000;
    for (const id of [1, 2, 3, 4]) {
      db.prepare("INSERT INTO events(id, event_type, timestamp) VALUES (?, 'fixture', 1)").run(id);
      db.prepare(`INSERT INTO event_pair_runs(id, pair_name, correlation_key, open_event_id, status, opened_at, expected_close_at)
        VALUES (?, 'fixture', ?, ?, 'closed', 1, ?)`)
        .run(id, String(id), id, now + 60_000);
    }
    const prepare = db.prepare.bind(db);
    const reads: string[] = [];
    const spy = spyOn(db, "prepare").mockImplementation((sql) => {
      const statement = prepare(sql);
      const table = sql.startsWith("SELECT rowid AS id FROM event_pair_runs") ? "event_pair_runs"
        : sql.startsWith("SELECT id AS id FROM events") ? "events" : null;
      if (!table) return statement;
      return { ...statement, all(...params) {
        writer.exec("BEGIN IMMEDIATE");
        try {
          const rows = statement.all(...params);
          reads.push(table);
          if (table === "event_pair_runs") {
            writer.run("UPDATE event_pair_runs SET status = 'open' WHERE id = 1");
            writer.run("UPDATE event_pair_runs SET opened_at = ? WHERE id = 2", [now]);
          } else {
            // This row was eligible at selection; the new reference must win.
            writer.run(`INSERT INTO event_trace_links(from_event_id, to_event_id, type, created_at)
              VALUES (2, 1, 'fixture', ?)`, [now]);
            writer.run("UPDATE events SET timestamp = ? WHERE id = 3", [now]);
          }
          writer.exec("COMMIT");
          return rows;
        } catch (error) {
          writer.exec("ROLLBACK");
          throw error;
        }
      } };
    });
    try {
      const result = runDbMaintenancePass(root, { now, batchSize: 3 });
      expect(reads).toEqual(["event_pair_runs", "events"]);
      expect(result.deleted.event_pair_runs).toBe(2);
      expect(result.deleted.events).toBe(1);
      expect(prepare("SELECT id FROM event_pair_runs ORDER BY id").all()).toEqual([{ id: 1 }, { id: 2 }]);
      expect(prepare("SELECT id FROM events ORDER BY id").all()).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    } finally {
      spy.mockRestore();
      writer.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips protected admissions and inputs so a small batch reaches later eligible Events", () => {
    const root = mkdtempSync(join(tmpdir(), "may-maintenance-protected-batch-"));
    const db = getDb(root);
    const now = 10 * 86_400_000;
    try {
      for (const id of [1, 2, 3, 4]) {
        db.prepare("INSERT INTO events(id, event_type, timestamp) VALUES (?, 'fixture', ?)").run(id, id);
      }
      for (const [id, status] of [[1, "pending"], [3, "completed"]] as const) {
        db.prepare(`INSERT INTO app_event_admission_plans(event_id, registry_snapshot_id, registry_generation, status, created_at, updated_at)
          VALUES (?, 'fixture', 1, ?, 1, 1)`).run(id, status);
      }
      for (const id of [2, 4]) {
        createAppInboxItem(db, { id: `input-${id}`, appId: "sample", originEventId: id,
          source: { kind: "system", id: "fixture" }, input: { kind: "message", data: {} }, now: 1 });
      }
      db.run("UPDATE app_inbox_items SET status = 'done' WHERE id = 'input-4'");
      // Inspect retained identities: driver changes may also count the completed
      // admission plan removed by the foreign-key cascade.
      runDbMaintenancePass(root, { now, batchSize: 1 });
      expect(db.prepare("SELECT id FROM events ORDER BY id").all()).toEqual([{ id: 1 }, { id: 2 }, { id: 4 }]);
      runDbMaintenancePass(root, { now, batchSize: 1 });
      expect(runDbMaintenancePass(root, { now, batchSize: 1 }).deleted.events).toBe(0);
      expect(db.prepare("SELECT id FROM events ORDER BY id").all()).toEqual([{ id: 1 }, { id: 2 }]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("retains prospective App-admission markers and expires them after acknowledgement", () => {
    const root = mkdtempSync(join(tmpdir(), "may-maintenance-app-admission-"));
    const db = getDb(root);
    const now = 10 * 86_400_000;
    try {
      db.prepare(`INSERT INTO events
        (id, event_type, data, timestamp, delivery_status, app_admission_pending)
        VALUES (1, 'app.input.requested', ?, 1, 'accepted', 1)`).run(
        JSON.stringify({ appId: "sample", input: { kind: "message", data: { message: "owed" } } }),
      );
      // Historical and manually imported rows remain NULL and gain no new obligation.
      db.prepare(`INSERT INTO events
        (id, event_type, data, timestamp, delivery_status)
        VALUES (2, 'fixture', '{}', 1, 'pending')`).run();

      expect(runDbMaintenancePass(root, { now, batchSize: 100 }).deleted.events).toBe(1);
      expect(db.prepare("SELECT id FROM events ORDER BY id").all()).toEqual([{ id: 1 }]);

      db.prepare("UPDATE events SET app_admission_pending = 0 WHERE id = 1").run();
      expect(runDbMaintenancePass(root, { now, batchSize: 100 }).deleted.events).toBe(1);
      expect(db.prepare("SELECT id FROM events").all()).toEqual([]);
    } finally {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("indexes the retained-event cutoff instead of sorting event history under the writer lock", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-event-index-"));
    try {
      const db = getDb(persistDir);
      const indexes = db.prepare("PRAGMA index_list(events)").all() as Array<{ name?: string }>;
      expect(indexes.some((index) => index.name === "idx_events_timestamp")).toBe(true);

      const plan = db
        .prepare("EXPLAIN QUERY PLAN SELECT id FROM events WHERE timestamp < ? ORDER BY timestamp LIMIT ?")
        .all(Date.now(), 5_000) as Array<{ detail?: string }>;
      expect(plan.some((step) => step.detail?.includes("idx_events_timestamp"))).toBe(true);
      expect(plan.some((step) => step.detail?.includes("TEMP B-TREE FOR ORDER BY"))).toBe(false);
    } finally {
      closeDb(persistDir);
    }
  });

  it("keeps WAL checkpoint work on the maintenance path", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-checkpoint-"));
    try {
      const db = getDb(persistDir);
      expect(db.prepare("PRAGMA wal_autocheckpoint").get()).toEqual({ wal_autocheckpoint: 0 });
      db.run(
        `INSERT INTO sessions (sessionId, agent, task, status, startedAt)
         VALUES ('checkpoint-fixture', 'dev', 'task', 'done', 1)`,
      );

      expect(runDbMaintenancePass(persistDir, { now: Date.now(), batchSize: 1 }).checkpoint).toBe("ok");
    } finally {
      closeDb(persistDir);
    }
  });

  it("deletes at most one batch and preserves active sessions", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-"));
    const now = 40 * 86_400_000;
    try {
      const db = getDb(persistDir);
      for (let index = 0; index < 5; index++) {
        db.run(
          `INSERT INTO sessions (sessionId, agent, task, status, startedAt)
           VALUES (?, 'dev', 'task', 'done', 1)`,
          [`old_${index}`],
        );
        mkdirSync(join(persistDir, "sessions", `old_${index}`), { recursive: true });
        writeFileSync(join(persistDir, "sessions", `old_${index}`, "session.jsonl"), "history");
      }
      db.run(
        `INSERT INTO sessions (sessionId, agent, task, status, startedAt)
         VALUES ('active', 'dev', 'task', 'running', 1)`,
      );

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 2 });
      expect(result.deleted.sessions).toBe(2);
      expect(result.deleted.sessionDirectories).toBe(2);
      expect((db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE status = 'done'").get() as any).count).toBe(3);
      expect(db.prepare("SELECT sessionId FROM sessions WHERE sessionId = 'active'").get()).toBeTruthy();
      const remainingDirectories = Array.from({ length: 5 }, (_, index) => `old_${index}`).filter((sessionId) =>
        existsSync(join(persistDir, "sessions", sessionId)),
      );
      expect(remainingDirectories).toHaveLength(3);
    } finally {
      closeDb(persistDir);
    }
  });

  it("preserves old session directories that still have an active marker", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-active-dir-"));
    const now = 40 * 86_400_000;
    try {
      const db = getDb(persistDir);
      db.run(
        `INSERT INTO sessions (sessionId, agent, task, status, startedAt)
         VALUES ('stale-marker', 'dev', 'task', 'done', 1)`,
      );
      const dir = join(persistDir, "sessions", "stale-marker");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "[ACTIVE]"), "active");

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 2 });
      expect(result.deleted.sessions).toBe(0);
      expect(result.deleted.sessionDirectories).toBe(0);
      expect(db.prepare("SELECT sessionId FROM sessions WHERE sessionId = 'stale-marker'").get()).toBeTruthy();
      expect(existsSync(dir)).toBe(true);
    } finally {
      closeDb(persistDir);
    }
  });

  it("retires stale orphans in bounded batches", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-orphans-"));
    const now = 10 * 86_400_000;
    try {
      const db = getDb(persistDir);
      for (let index = 0; index < 5; index++) {
        db.run(
          `INSERT INTO event_pair_runs
             (pair_name, correlation_key, open_event_id, status, opened_at, expected_close_at)
           VALUES ('handler', ?, ?, 'orphan', ?, ?)`,
          [`orphan_${index}`, index + 1, now - 10_000, now - 5 * 60 * 60 * 1000],
        );
      }

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 2 });
      expect(result.deleted.retiredOrphans).toBe(2);
      expect(
        (db.prepare("SELECT COUNT(*) AS count FROM event_pair_runs WHERE closed_at IS NOT NULL").get() as any).count,
      ).toBe(2);
    } finally {
      closeDb(persistDir);
    }
  });

  it("retires old message pairs as generic stale infrastructure", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-messages-"));
    const now = 10 * 86_400_000;
    try {
      const db = getDb(persistDir);
      const event = db
        .prepare(
          `INSERT INTO events (event_type, source, owner, data, timestamp)
           VALUES ('message.created', 'agent:scout', 'agent:scout', ?, ?)`,
        )
        .run(JSON.stringify({ from: "scout", to: "human", content: "Unfinished request" }), now - 5 * 86_400_000);
      const openEventId = Number(event.lastInsertRowid);
      db.prepare(
        `INSERT INTO event_pair_runs
         (pair_name, correlation_key, open_event_id, owner, status, opened_at, expected_close_at)
         VALUES ('owner_inbox', ?, ?, 'agent:scout', 'orphan', ?, ?)`,
      ).run(`event:${openEventId}`, openEventId, now - 5 * 86_400_000, now - 5 * 60 * 60_000);

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 100 });

      expect(result.deleted.retiredOrphans).toBe(1);
      expect(db.prepare("SELECT status FROM event_pair_runs WHERE open_event_id = ?").get(openEventId)).toBeNull();
    } finally {
      closeDb(persistDir);
    }
  });

  it("retains handled approval identity after the general event window", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-maintenance-approval-"));
    const now = 10 * 86_400_000;
    try {
      const db = getDb(persistDir);
      db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES ('project.approval.submitted', 'human', 'project:sample', ?, ?)`,
        [JSON.stringify({ approvalId: "approval:handled", decision: "approve" }), now - 6 * 86_400_000],
      );
      db.run(
        `INSERT INTO events (event_type, source, owner, data, timestamp)
         VALUES ('old.detail', 'test', 'agent:may', '{}', ?)`,
        [now - 6 * 86_400_000],
      );

      const result = runDbMaintenancePass(persistDir, { now, batchSize: 100 });

      expect(result.deleted.events).toBe(1);
      expect(db.prepare("SELECT 1 FROM events WHERE event_type = 'old.detail'").get()).toBeFalsy();
      expect(
        db
          .prepare(
            `SELECT 1 FROM events
             WHERE event_type = 'project.approval.submitted'
               AND json_extract(data, '$.approvalId') = ?`,
          )
          .get("approval:handled"),
      ).toBeTruthy();
    } finally {
      closeDb(persistDir);
    }
  });
});
