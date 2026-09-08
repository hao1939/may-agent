import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "./connection.js";
import { readSessionLastActivityAt, upsertSession, updateSessionDb, updateSessionProgress } from "./sessions.js";

describe("session DB progress", () => {
  it("replaces or clears the whole Task binding on start, but preserves it on status/progress updates", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-session-db-"));
    const entry = { sessionId: "s_scope", agent: "worker", task: "work", status: "running", startedAt: 1000 };
    const binding = () =>
      getDb(persistDir)
        .prepare(
          "SELECT app_id, task_id, task_generation, attempt_id, projectId, workflowRunId FROM sessions WHERE sessionId = ?",
        )
        .get(entry.sessionId);
    try {
      upsertSession(persistDir, {
        ...entry,
        projectId: "sample",
        workflowRunId: "workflow-one",
        taskBinding: { appId: "sample", taskId: "work/one", generation: 2, attemptId: "attempt-old" },
      });
      upsertSession(persistDir, {
        ...entry,
        taskBinding: { appId: "other", taskId: "work/two", generation: 3, attemptId: "attempt-current" },
      });
      const current = {
        app_id: "other",
        task_id: "work/two",
        task_generation: 3,
        attempt_id: "attempt-current",
        projectId: "sample",
        workflowRunId: "workflow-one",
      };
      expect(binding()).toEqual(current);
      updateSessionProgress(persistDir, entry.sessionId, { opCount: 1 });
      updateSessionDb(persistDir, entry.sessionId, { status: "interrupted" });
      expect(binding()).toEqual(current);

      upsertSession(persistDir, entry);
      const unbound = { ...current, app_id: null, task_id: null, task_generation: null, attempt_id: null };
      expect(binding()).toEqual(unbound);
      updateSessionProgress(persistDir, entry.sessionId, { opCount: 2 });
      updateSessionDb(persistDir, entry.sessionId, { status: "done" });
      closeDb(persistDir);
      expect(binding()).toEqual(unbound);
    } finally {
      closeDb(persistDir);
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it("persists live op count and last activity without ending the session", () => {
    const persistDir = mkdtempSync(join(tmpdir(), "may-session-db-"));
    try {
      upsertSession(persistDir, {
        sessionId: "s_live",
        agent: "dev",
        task: "do work",
        status: "running",
        startedAt: 1000,
        taskBinding: {
          appId: "evaluation",
          taskId: "task-1",
          generation: 3,
          attemptId: "attempt-4",
        },
      });

      updateSessionProgress(persistDir, "s_live", {
        opCount: 2,
        lastActivityAt: 2000,
      });
      updateSessionProgress(persistDir, "s_live", {
        opCount: 1,
        lastActivityAt: 1500,
      });

      const row = getDb(persistDir)
        .prepare(
          "select status, endedAt, opCount, lastActivityAt, app_id, task_id, task_generation, attempt_id from sessions where sessionId = ?",
        )
        .get("s_live") as { status: string; endedAt: number | null; opCount: number; lastActivityAt: number };
      const foreignKeys = getDb(persistDir).prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };

      expect(row.status).toBe("running");
      expect(row.endedAt).toBeNull();
      expect(row.opCount).toBe(2);
      expect(row.lastActivityAt).toBe(2000);
      expect(row).toMatchObject({
        app_id: "evaluation",
        task_id: "task-1",
        task_generation: 3,
        attempt_id: "attempt-4",
      });
      expect(readSessionLastActivityAt(persistDir, "s_live")).toBe(2000);
      expect(readSessionLastActivityAt(persistDir, "missing")).toBeNull();
      expect(foreignKeys.foreign_keys).toBe(1);
    } finally {
      closeDb(persistDir);
    }
  });
});
