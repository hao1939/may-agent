import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb } from "../../../lib/db/connection.js";
import { runDbMaintenancePass } from "../../../lib/db/maintenance.js";
import { saveExecutionUsage, observeExecutionUsage } from "../../../lib/db/execution-usage.js";
import { createExecutionUsage } from "../../../lib/execution-usage.js";
import { preparationFixture, usageReply, observeReply } from "../../../../test/fixtures/execution-usage.js";
import { contextUsageQuery, readContextUsage } from "./context-usage.js";

test("usage snapshots survive reopen, replace rather than add, and expose partial/model/outcome cohorts", () => {
  const root = mkdtempSync(join(tmpdir(), "usage-read-"));
  try {
    let db = getDb(root);
    const identity = {
      id: "one",
      sessionId: "reused",
      agent: "worker",
      appId: "research",
      configuredModel: "fixture/model-a",
      startedAt: 100,
    };
    const collector = createExecutionUsage(preparationFixture);
    observeReply(collector, usageReply());
    saveExecutionUsage(db, identity, collector.snapshot(), null, 101);
    closeDb(root);
    db = getDb(root);
    const query = contextUsageQuery(new URLSearchParams({ start: "100", end: "200" }), 200);
    expect(readContextUsage(db, query, 200).groups[0]).toMatchObject({
      outcome: "unfinished",
      measuredInvocations: 0,
      meanInput: null,
      input: 10,
      meanDurationMs: null,
    });
    observeReply(collector, usageReply());
    saveExecutionUsage(db, identity, collector.snapshot(), "done", 120);
    saveExecutionUsage(db, identity, collector.snapshot(), "done", 120);
    // A new invocation can reuse the session without overwriting old spend.
    const partial = createExecutionUsage(preparationFixture);
    observeReply(partial, usageReply({ usage: undefined as never }));
    saveExecutionUsage(db, { ...identity, id: "two" }, partial.snapshot(), "error", 130);
    const fallback = createExecutionUsage(preparationFixture);
    observeReply(fallback, usageReply({ model: "model-b" }));
    saveExecutionUsage(db, { ...identity, id: "three" }, fallback.snapshot(), "done", 140);
    saveExecutionUsage(db, { ...identity, id: "upper-bound", startedAt: 200 }, fallback.snapshot(), "done", 201);
    saveExecutionUsage(db, { ...identity, id: "other-app", appId: "other" }, fallback.snapshot(), "done", 140);
    const filtered = contextUsageQuery(new URLSearchParams({ start: "100", end: "200", appId: "research" }), 200);
    const result = readContextUsage(db, filtered, 200);
    expect(result.invocations).toBe(3);
    expect(result.groups).toHaveLength(3);
    expect(result.groups.find((row) => row.meanInput === 20)).toMatchObject({
      invocations: 1,
      measuredInvocations: 1,
      replies: 2,
      input: 20,
      cacheRead: 200,
      cacheWrite: 40,
      inputExposure: 260,
      meanInputExposure: 260,
      pricedInvocations: 1,
      meanOutput: 10,
      meanDurationMs: 20,
      meanEstimatedCost: 0.08,
    });
    expect(result.groups.find((row) => row.outcome === "error")).toMatchObject({
      measuredReplies: 0,
      meanInput: null,
      meanDurationMs: null,
      meanEstimatedCost: null,
    });
    expect(result.runs.map((row) => row.sessionId)).toEqual(["reused", "reused", "reused"]);
    expect(result.runs.every((row) => !row.sessionAvailable && !row.workflowAvailable)).toBe(true);
    expect(
      db
        .prepare("EXPLAIN QUERY PLAN SELECT * FROM execution_usage WHERE started_at >= ? AND started_at < ?")
        .all(100, 200)
        .map((row) => row.detail)
        .join(" "),
    ).toContain("idx_execution_usage_started");
    expect(() => contextUsageQuery(new URLSearchParams({ days: "NaN" }))).toThrow();
    expect(() => contextUsageQuery(new URLSearchParams({ days: "91" }))).toThrow();
    expect(readContextUsage(db, contextUsageQuery(new URLSearchParams({ agent: "' OR 1=1 --" }))).groups).toEqual([]);
    db.exec("BEGIN");
    for (let i = 0; i < 101; i++) {
      saveExecutionUsage(
        db,
        { ...identity, id: `cap-${i}`, agent: `worker-${i}`, taskId: "cap" },
        collector.snapshot(),
        "done",
        150,
      );
    }
    db.exec("COMMIT");
    const capped = readContextUsage(
      db,
      contextUsageQuery(new URLSearchParams({ start: "100", end: "200", taskId: "cap" }), 200),
    );
    expect(capped).toMatchObject({ invocations: 101, groupsTruncated: true, runsTruncated: true });
    expect(capped.groups).toHaveLength(100);
    expect(capped.runs).toHaveLength(50);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("existing maintenance retires stale usage in bounded batches and preserves recent updates", () => {
  const root = mkdtempSync(join(tmpdir(), "usage-retention-"));
  try {
    const db = getDb(root);
    const now = 40 * 86_400_000;
    const usage = createExecutionUsage(preparationFixture).snapshot();
    const identity = { sessionId: "retired", agent: "worker", configuredModel: "fixture/model-a", startedAt: 1 };
    for (const id of ["old-1", "old-2", "old-3"]) saveExecutionUsage(db, { ...identity, id }, usage, "done", 2);
    saveExecutionUsage(db, { ...identity, id: "recent-update" }, usage, null, now);
    saveExecutionUsage(db, { ...identity, id: "recent-start", startedAt: now }, usage, "done", now);
    expect(runDbMaintenancePass(root, { now, batchSize: 2 }).deleted.execution_usage).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS count FROM execution_usage").get()!.count).toBe(3);
    expect(runDbMaintenancePass(root, { now, batchSize: 2 }).deleted.execution_usage).toBe(1);
    expect(
      db
        .prepare("SELECT id FROM execution_usage ORDER BY id")
        .all()
        .map((row) => row.id),
    ).toEqual(["recent-start", "recent-update"]);
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("reporting failures are contained and the next cumulative write can recover", () => {
  const root = mkdtempSync(join(tmpdir(), "usage-failure-"));
  try {
    const db = getDb(root);
    const errors: unknown[] = [];
    const observer = observeExecutionUsage(
      root,
      { sessionId: "sample", agent: "worker", configuredModel: "fixture/model-a" },
      (error) => errors.push(error),
    );
    db.exec("ALTER TABLE execution_usage RENAME TO unavailable_usage");
    observer.preparation(preparationFixture);
    observer.observe({ type: "message_end", message: usageReply() }, {} as never);
    expect(errors).toHaveLength(1);
    db.exec("ALTER TABLE unavailable_usage RENAME TO execution_usage");
    observer.finish("done");
    const data = JSON.parse(db.prepare("SELECT data FROM execution_usage").get()!.data as string);
    expect(data.totals).toMatchObject({ input: 10, cacheRead: 100, cacheWrite: 20, replies: 1 });
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
