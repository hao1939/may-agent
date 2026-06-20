import { describe, expect, it, vi, beforeEach } from "vitest";
import { create } from "./db-retention.js";

// ── Mock factory ─────────────────────────────────────────────────────────
function makeCtx(opts: { runResults?: Record<string, number> } = {}) {
  const runResults = opts.runResults ?? {};
  const runCalls: Array<{ sql: string; params: unknown[] }> = [];
  const logCalls: Array<{ level: string; msg: string }> = [];
  const emitCalls: Array<{ type: string; data: unknown }> = [];

  const db = {
    run: vi.fn((sql: string, params?: unknown[]) => {
      runCalls.push({ sql, params: params ?? [] });
      // Match by SQL prefix to return specific deletion counts
      for (const [key, changes] of Object.entries(runResults)) {
        if (sql.includes(key)) return { changes };
      }
      return { changes: 0 };
    }),
  };

  const ctx = {
    agentName: "may",
    sdk: {
      getDb: vi.fn(() => db),
      log: vi.fn((level: string, msg: string) => {
        logCalls.push({ level, msg });
      }),
      emit: vi.fn((type: string, data: unknown) => {
        emitCalls.push({ type, data });
      }),
    },
  } as any;

  return { ctx, db, runCalls, logCalls, emitCalls };
}

describe("db-retention handler", () => {
  it("exports a create function", () => {
    expect(typeof create).toBe("function");
  });

  it("deletes from all expected tables", async () => {
    const { ctx, runCalls } = makeCtx();
    const handler = create(ctx, {} as any);
    await handler();

    // Should have DELETE statements for: events, sessions, metric_snapshots,
    // session_digests, workflow_runs, evaluations, and size-based for all 4 tables
    const deleteSqls = runCalls
      .filter(c => c.sql.startsWith("DELETE"))
      .map(c => c.sql);

    expect(deleteSqls.some(s => s.includes("events") && s.includes("timestamp"))).toBe(true);
    expect(deleteSqls.some(s => s.includes("sessions") && s.includes("startedAt"))).toBe(true);
    expect(deleteSqls.some(s => s.includes("metric_snapshots") && s.includes("measured_at"))).toBe(true);
    expect(deleteSqls.some(s => s.includes("session_digests") && s.includes("created_at"))).toBe(true);
    expect(deleteSqls.some(s => s.includes("workflow_runs") && s.includes("startedAt"))).toBe(true);
    expect(deleteSqls.some(s => s.includes("evaluations") && s.includes("createdAt"))).toBe(true);
  });

  it("uses correct retention windows", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const { ctx, runCalls } = makeCtx();
    const handler = create(ctx, {} as any);
    await handler();

    // Events: 7 days
    const eventDelete = runCalls.find(c =>
      c.sql.includes("DELETE FROM events") && c.sql.includes("timestamp"));
    expect(eventDelete).toBeTruthy();
    const eventCutoff = eventDelete!.params[0] as number;
    expect(eventCutoff).toBe(now - 7 * 86_400_000);

    // Sessions: 14 days
    const sessionDelete = runCalls.find(c =>
      c.sql.includes("DELETE FROM sessions") && c.sql.includes("startedAt"));
    expect(sessionDelete).toBeTruthy();
    const sessionCutoff = sessionDelete!.params[0] as number;
    expect(sessionCutoff).toBe(now - 14 * 86_400_000);

    // Metric snapshots: 14 days (was 30, reduced per KE-2000)
    const snapshotDelete = runCalls.find(c =>
      c.sql.includes("DELETE FROM metric_snapshots"));
    expect(snapshotDelete).toBeTruthy();
    const snapshotCutoff = snapshotDelete!.params[0] as number;
    expect(snapshotCutoff).toBe(now - 14 * 86_400_000);

    // Evaluations: 30 days
    const evalDelete = runCalls.find(c =>
      c.sql.includes("DELETE FROM evaluations"));
    expect(evalDelete).toBeTruthy();
    const evalCutoff = evalDelete!.params[0] as number;
    expect(evalCutoff).toBe(now - 30 * 86_400_000);

    vi.restoreAllMocks();
  });

  it("applies size-based retention for oversized rows", async () => {
    const { ctx, runCalls } = makeCtx();
    const handler = create(ctx, {} as any);
    await handler();

    // Should delete rows where data/task > 1MB from 4 tables
    const sizeDeletes = runCalls.filter(c =>
      c.sql.includes("DELETE") && c.sql.includes("LENGTH"));

    expect(sizeDeletes.length).toBe(4);
    expect(sizeDeletes.some(s => s.sql.includes("events") && s.sql.includes("LENGTH(data)"))).toBe(true);
    expect(sizeDeletes.some(s => s.sql.includes("sessions") && s.sql.includes("LENGTH(task)"))).toBe(true);
    expect(sizeDeletes.some(s => s.sql.includes("session_digests") && s.sql.includes("LENGTH(task)"))).toBe(true);
    expect(sizeDeletes.some(s => s.sql.includes("workflow_runs") && s.sql.includes("LENGTH(task)"))).toBe(true);

    // All should use 1MB threshold
    for (const del of sizeDeletes) {
      expect(del.params[0]).toBe(1_048_576);
    }
  });

  it("triggers VACUUM when deletions exceed threshold", async () => {
    const { ctx, runCalls, emitCalls } = makeCtx({
      runResults: {
        "DELETE FROM events WHERE timestamp": 1200,  // > 1000 threshold
      },
    });
    const handler = create(ctx, {} as any);
    await handler();

    // Should have VACUUM in the run calls
    const vacuumCalls = runCalls.filter(c => c.sql === "VACUUM");
    expect(vacuumCalls.length).toBe(1);

    // Should emit completion with vacuumed=true
    expect(emitCalls.length).toBe(1);
    const completionData = emitCalls[0].data as any;
    expect(completionData.vacuumed).toBe(true);
  });

  it("triggers VACUUM when oversized rows are deleted", async () => {
    const { ctx, runCalls } = makeCtx({
      runResults: {
        "DELETE FROM events WHERE LENGTH": 1,  // Only 1 oversized row
      },
    });
    const handler = create(ctx, {} as any);
    await handler();

    const vacuumCalls = runCalls.filter(c => c.sql === "VACUUM");
    expect(vacuumCalls.length).toBe(1);
  });

  it("skips VACUUM when deletions are below threshold", async () => {
    const { ctx, runCalls, emitCalls } = makeCtx({
      runResults: {
        "DELETE FROM events WHERE timestamp": 50,
      },
    });
    const handler = create(ctx, {} as any);
    await handler();

    const vacuumCalls = runCalls.filter(c => c.sql === "VACUUM");
    expect(vacuumCalls.length).toBe(0);

    expect(emitCalls.length).toBe(1);
    const completionData = emitCalls[0].data as any;
    expect(completionData.vacuumed).toBe(false);
  });

  it("truncates oversized session_digests.task columns", async () => {
    const { ctx, runCalls } = makeCtx();
    const handler = create(ctx, {} as any);
    await handler();

    const truncateCall = runCalls.find(c =>
      c.sql.includes("UPDATE session_digests") && c.sql.includes("SUBSTR"));
    expect(truncateCall).toBeTruthy();
    // Should use 2048-byte max
    expect(truncateCall!.params[0]).toBe(2048);
  });

  it("runs WAL checkpoint", async () => {
    const { ctx, runCalls } = makeCtx();
    const handler = create(ctx, {} as any);
    await handler();

    const walCalls = runCalls.filter(c =>
      c.sql.includes("wal_checkpoint"));
    expect(walCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("emits handler.completed with summary data", async () => {
    const { ctx, emitCalls } = makeCtx({
      runResults: {
        "DELETE FROM events WHERE timestamp": 500,
        "DELETE FROM sessions WHERE startedAt": 100,
      },
    });
    const handler = create(ctx, {} as any);
    await handler();

    expect(emitCalls.length).toBe(1);
    expect(emitCalls[0].type).toBe("handler.completed");
    const data = emitCalls[0].data as any;
    expect(data.handler).toBe("db-retention");
    expect(data.deletedEvents).toBeGreaterThanOrEqual(600);
    expect(typeof data.oversizedDeleted).toBe("number");
    expect(typeof data.truncatedDigestTasks).toBe("number");
    expect(typeof data.vacuumed).toBe("boolean");
  });

  it("handles db.run errors gracefully without crashing", async () => {
    const ctx = {
      agentName: "may",
      sdk: {
        getDb: vi.fn(() => ({
          run: vi.fn(() => { throw new Error("DB locked"); }),
        })),
        log: vi.fn(),
        emit: vi.fn(),
      },
    } as any;

    const handler = create(ctx, {} as any);
    // Should not throw — all db operations are wrapped in try/catch
    await expect(handler()).resolves.not.toThrow();

    // Should still emit completion event
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.completed", expect.objectContaining({
      handler: "db-retention",
    }));
  });

  it("runs post-VACUUM WAL checkpoint", async () => {
    const { ctx, runCalls } = makeCtx({
      runResults: {
        "DELETE FROM events WHERE timestamp": 1200,  // trigger VACUUM
      },
    });
    const handler = create(ctx, {} as any);
    await handler();

    // After VACUUM, should run another WAL checkpoint
    const vacuumIdx = runCalls.findIndex(c => c.sql === "VACUUM");
    expect(vacuumIdx).toBeGreaterThan(-1);

    const postVacuumWal = runCalls.slice(vacuumIdx + 1).find(c =>
      c.sql.includes("wal_checkpoint"));
    expect(postVacuumWal).toBeTruthy();
  });
});
