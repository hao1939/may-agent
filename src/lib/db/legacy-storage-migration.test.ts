import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJsonArtifact, sessionMetaRef, writeJsonArtifact } from "../artifacts.js";
import { closeDb, getDb } from "./connection.js";
import {
  legacyStorageMigrationUpdatedCount,
  migrateLegacyStoragePass,
} from "./legacy-storage-migration.js";
import { getWorkflowRun } from "./workflows.js";

describe("one-off legacy storage migration", () => {
  it("archives full payloads before replacing SQL values with bounded projections", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-legacy-storage-"));
    const eventText = "event ".repeat(2_000);
    const sessionTask = "session task ".repeat(1_000);
    const workflowTask = "workflow task ".repeat(1_000);
    const digestTask = "digest task ".repeat(1_000);
    try {
      writeJsonArtifact(persistDir, sessionMetaRef("s_legacy"), {
        agent: "dev",
        task: sessionTask,
        status: "done",
        startedAt: 1,
      });
      const db = getDb(persistDir);
      db.run(
        "INSERT INTO events (event_type, data, timestamp) VALUES ('session.end', ?, 1)",
        [JSON.stringify({ sessionId: "s_legacy", detail: eventText })],
      );
      const invalidEventText = "not-json ".repeat(1_000);
      db.run(
        "INSERT INTO events (event_type, data, timestamp) VALUES ('legacy.invalid', ?, 2)",
        [invalidEventText],
      );
      db.run(
        `INSERT INTO sessions (sessionId, agent, task, status, startedAt)
         VALUES ('s_legacy', 'dev', ?, 'done', 1)`,
        [sessionTask],
      );
      db.run(
        `INSERT INTO workflow_runs
          (runId, workflow, task, depth, status, startedAt)
         VALUES ('wr_legacy', 'demo', ?, 1, 'done', 1)`,
        [workflowTask],
      );
      db.run(
        `INSERT INTO session_digests
          (sessionId, agent, trigger, step, task, created_at)
         VALUES ('s_legacy', 'dev', 'test', 1, ?, 1)`,
        [digestTask],
      );

      const result = migrateLegacyStoragePass(persistDir, { batchSize: 10 });
      expect(result.updated).toEqual({ events: 2, sessions: 1, workflowRuns: 1, sessionDigests: 1 });
      expect(result.removedSqlBytes).toBeGreaterThan(30_000);

      const event = db.prepare(
        "SELECT data, body_ref, session_id FROM events WHERE event_type = 'session.end'",
      ).get() as { data: string; body_ref: string; session_id: string };
      expect(Buffer.byteLength(event.data)).toBeLessThan(12_000);
      expect(event.session_id).toBe("s_legacy");
      expect(existsSync(join(persistDir, event.body_ref))).toBe(true);
      expect(readJsonArtifact<{ detail: string }>(persistDir, event.body_ref)?.detail).toBe(eventText);
      const invalidEvent = db.prepare(
        "SELECT data, body_ref FROM events WHERE event_type = 'legacy.invalid'",
      ).get() as { data: string; body_ref: string };
      expect(Buffer.byteLength(invalidEvent.data)).toBeLessThan(1_000);
      expect(readFileSync(join(persistDir, invalidEvent.body_ref), "utf8")).toBe(invalidEventText);

      const session = db.prepare(
        "SELECT task, task_ref FROM sessions WHERE sessionId = 's_legacy'",
      ).get() as { task: string; task_ref: string };
      expect(session.task.length).toBeLessThan(2_100);
      expect(session.task_ref).toBe(sessionMetaRef("s_legacy"));

      const workflow = getWorkflowRun(persistDir, "wr_legacy");
      expect(workflow?.task).toBe(workflowTask);
      const digest = db.prepare(
        "SELECT task, task_ref FROM session_digests WHERE sessionId = 's_legacy'",
      ).get() as { task: string; task_ref: string };
      expect(digest.task.length).toBeLessThan(2_100);
      expect(existsSync(join(persistDir, digest.task_ref))).toBe(true);

      const second = migrateLegacyStoragePass(persistDir, { batchSize: 10 });
      expect(legacyStorageMigrationUpdatedCount(second)).toBe(0);
    } finally {
      closeDb(persistDir);
    }
  });
});
