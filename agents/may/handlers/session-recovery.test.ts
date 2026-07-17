import { describe, expect, it, vi } from "vitest";
import { create } from "./session-recovery.js";

function makeCtx(action?: string | null) {
  const runWorkflow = vi.fn(async () => ({ status: "done" as const, summary: "ok", runId: "wr_recovery" }));
  return {
    agentName: "may",
    sdk: {
      runAgent: vi.fn(() => { throw new Error("session-recovery handler should dispatch a workflow, not run agents directly"); }),
      runWorkflow,
      emit: vi.fn(),
      log: vi.fn(),
      escalate: vi.fn(),
    },
    getLastDigest: vi.fn(() => action ? { action } : null),
    classifyError: vi.fn(() => "infra"),
    upsertDigest: vi.fn(async () => null),
  } as any;
}

describe("session-recovery handler", () => {
  it("dispatches recoverable failures through the session-recovery workflow", async () => {
    const ctx = makeCtx("requeue");
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.end",
      source: "runtime",
      owner: "agent:dev",
      timestamp: Date.now(),
      data: {
        sessionId: "s_failed",
        agent: "dev",
        status: "error",
        outcome: "error",
        error: "provider transient",
        task: "fix the bug",
      },
    });

    expect(ctx.sdk.runAgent).not.toHaveBeenCalled();
    expect(ctx.sdk.runWorkflow).toHaveBeenCalledWith(
      "session-recovery",
      expect.stringContaining('"action": "requeue"'),
      { source: "may" },
    );
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.workflow_dispatched", expect.objectContaining({
      handler: "session-recovery",
      workflow: "session-recovery",
      workflowRunId: "wr_recovery",
      sessionId: "s_failed",
      agent: "dev",
      action: "requeue",
    }));
  });

  it("records non-recoverable decisions as skipped", async () => {
    const ctx = makeCtx("nothing");
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.end",
      source: "runtime",
      owner: "agent:dev",
      timestamp: Date.now(),
      data: {
        sessionId: "s_failed",
        agent: "dev",
        status: "error",
        outcome: "error",
        error: "logic failure",
        task: "fix the bug",
      },
    });

    expect(ctx.sdk.runWorkflow).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      handler: "session-recovery",
      sessionId: "s_failed",
      reason: "classifier chose nothing",
    }));
  });

  it("treats canonical timer.tick as the stale-session reap path", async () => {
    const ctx = makeCtx("requeue");
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(() => []),
      })),
    };
    ctx.sdk.paths = { root: "/tmp/may-agent-test", persist: "/tmp/may-agent-test/.state" };
    ctx.sdk.getDb = vi.fn(() => db);
    const handler = create(ctx, {} as any);

    await handler({
      type: "timer.tick",
      source: "timer",
      owner: "agent:may",
      timestamp: Date.now(),
      data: { entry: "session-recovery" },
    });

    expect(ctx.sdk.getDb).toHaveBeenCalled();
    expect(ctx.sdk.runWorkflow).not.toHaveBeenCalled();
  });

  it("reaps an extremely stale orphan when session metadata is missing", async () => {
    const ctx = makeCtx("requeue");
    const now = Date.now();
    const update = vi.fn(() => ({ changes: 1 }));
    const db = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("UPDATE sessions")) return { run: update };
        if (sql.includes("lastActivityAt")) return { all: vi.fn(() => []) };
        return {
          all: vi.fn(() => [{
            sessionId: "s_orphan",
            agent: "dev",
            task: "abandoned task",
            status: "running",
            startedAt: now - 2 * 60 * 60_000 - 1,
          }]),
        };
      }),
    };
    ctx.sdk.paths = { root: "/tmp/may-agent-test", persist: "/tmp/may-agent-test/missing-state" };
    ctx.sdk.getDb = vi.fn(() => db);
    const handler = create(ctx, {} as any);

    await handler({
      type: "timer.tick",
      source: "timer",
      owner: "agent:may",
      timestamp: now,
      data: { entry: "session-recovery" },
    });

    expect(update).toHaveBeenCalledWith(
      expect.any(Number),
      "Auto-closed stale immediate session with no assistant activity",
      "s_orphan",
      now - 2 * 60 * 60_000 - 1,
    );
    expect(ctx.sdk.emit).toHaveBeenCalledWith("session.end", expect.objectContaining({
      sessionId: "s_orphan",
      autoClosed: true,
      reason: "stale_immediate_no_assistant_activity",
    }));
  });

  it("preserves a normally stale session when session metadata is missing", async () => {
    const ctx = makeCtx("requeue");
    const now = Date.now();
    const update = vi.fn(() => ({ changes: 1 }));
    const db = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("UPDATE sessions")) return { run: update };
        if (sql.includes("lastActivityAt")) return { all: vi.fn(() => []) };
        return {
          all: vi.fn(() => [{
            sessionId: "s_recent_orphan",
            agent: "dev",
            task: "possibly active task",
            status: "running",
            startedAt: now - 31 * 60_000,
          }]),
        };
      }),
    };
    ctx.sdk.paths = { root: "/tmp/may-agent-test", persist: "/tmp/may-agent-test/missing-state" };
    ctx.sdk.getDb = vi.fn(() => db);
    const handler = create(ctx, {} as any);

    await handler({
      type: "timer.tick",
      source: "timer",
      owner: "agent:may",
      timestamp: now,
      data: { entry: "session-recovery" },
    });

    expect(update).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).not.toHaveBeenCalledWith("session.end", expect.objectContaining({
      sessionId: "s_recent_orphan",
    }));
  });

  it("does not unwrap nested event.data.data payloads", async () => {
    const ctx = makeCtx("requeue");
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.end",
      source: "runtime",
      owner: "agent:dev",
      timestamp: Date.now(),
      data: {
        data: {
          sessionId: "s_nested",
          agent: "dev",
          status: "error",
          outcome: "error",
          error: "provider transient",
          task: "fix the bug",
        },
      },
    });

    expect(ctx.sdk.runWorkflow).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      handler: "session-recovery",
      reason: "session.end is missing terminal status",
      eventType: "session.end",
      sessionId: null,
    }));
    expect(ctx.sdk.emit).not.toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      sessionId: "s_nested",
    }));
  });

  it("silently ignores successful terminal sessions", async () => {
    const ctx = makeCtx("requeue");
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.end",
      source: "runtime",
      owner: "agent:dev",
      timestamp: Date.now(),
      data: {
        sessionId: "s_done",
        agent: "dev",
        status: "done",
        outcome: "done",
        summary: "Done",
      },
    });

    expect(ctx.sdk.runWorkflow).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).not.toHaveBeenCalled();
  });
});
