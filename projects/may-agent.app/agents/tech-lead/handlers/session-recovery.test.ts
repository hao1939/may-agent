import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { create } from "./session-recovery.js";

function makeCtx(action?: string | null) {
  return {
    agentName: "tech-lead",
    sdk: {
      runAgent: vi.fn(() => { throw new Error("session-recovery handler should dispatch a workflow, not run agents directly"); }),
      emit: vi.fn(),
      log: vi.fn(),
    },
    getLastDigest: vi.fn(() => action ? { action } : null),
    classifyError: vi.fn(() => "infra"),
    upsertDigest: vi.fn(async () => null),
  } as any;
}

describe("session-recovery handler", () => {
  it("routes recoverable failures to the May-agent App", async () => {
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
    expect(ctx.sdk.emit).toHaveBeenCalledWith(
      "session.recovery.requested",
      expect.objectContaining({
        sessionId: "s_failed",
        agent: "dev",
        action: "requeue",
        task: "fix the bug",
      }),
      expect.objectContaining({
        owner: "app:may-agent",
        target: { appId: "may-agent", project: "may-agent" },
      }),
    );
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.routed", expect.objectContaining({
      handler: "session-recovery",
      source: "tech-lead",
      route: "app:may-agent",
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

    expect(ctx.sdk.emit).not.toHaveBeenCalledWith("session.recovery.requested", expect.anything(), expect.anything());
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      handler: "session-recovery",
      sessionId: "s_failed",
      reason: "classifier chose nothing",
    }));
  });

  it("records a terminal recovery route for aborted telegram admission reviews instead of skipping them", async () => {
    const persist = mkdtempSync(join(tmpdir(), "tech-lead-session-recovery-"));
    const sessionDir = join(persist, "sessions", "s_telegram_failed");
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(join(sessionDir, "meta.json"), JSON.stringify({
      sessionId: "s_telegram_failed",
      agent: "may",
      source: "telegram-human-attention-review",
      task: [
        "Review one proposed proactive Telegram message as Hao's deputy.",
        "Candidate:",
        JSON.stringify({
          sourceEventId: 5085126,
          eventType: "message.created",
          from: "tech-lead",
          content: "Daily ops digest.",
          projectId: "projects/may-agent.app",
        }, null, 2),
      ].join("\n"),
    }), "utf8");

    const emit = vi.fn();
    const ctx = {
      agentName: "may",
      sdk: {
        runAgent: vi.fn(() => { throw new Error("session-recovery handler should dispatch a workflow, not run agents directly"); }),
        emit,
        log: vi.fn(),
        paths: { root: persist, persist },
        getDb: vi.fn(() => ({
          prepare: vi.fn(() => ({
            all: vi.fn(() => []),
            get: vi.fn(() => undefined),
          })),
        })),
      },
      getLastDigest: vi.fn(() => ({ action: "nothing" })),
      classifyError: vi.fn(() => "logic"),
      upsertDigest: vi.fn(async () => null),
    } as any;
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.end",
      source: "runtime",
      owner: "agent:may",
      timestamp: Date.now(),
      data: {
        sessionId: "s_telegram_failed",
        agent: "may",
        status: "error",
        outcome: "error",
        error: "Request was aborted.",
      },
    });

    expect(emit).not.toHaveBeenCalledWith("session.recovery.requested", expect.anything(), expect.anything());
    expect(emit).toHaveBeenCalledWith("human.attention.reviewed", expect.objectContaining({
      sourceEventId: 5085126,
      status: "completed",
      disposition: "route",
      owner: "tech-lead",
      recovery: expect.objectContaining({
        failedSessionId: "s_telegram_failed",
        reason: "telegram-admission-review-failed",
      }),
    }));
    expect(emit).toHaveBeenCalledWith("project.owner.requested", expect.objectContaining({
      project: "may-agent",
      reason: "telegram-admission-review-failed",
      params: expect.objectContaining({
        sourceEventId: 5085126,
        candidateEventType: "message.created",
        candidateFrom: "tech-lead",
        candidateProjectId: "projects/may-agent.app",
      }),
    }));
    expect(emit).not.toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      sessionId: "s_telegram_failed",
      reason: "classifier chose nothing",
    }));
  });

  it("escalates unsupported model configuration failures instead of requeueing them", async () => {
    const ctx = makeCtx(undefined);
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.end",
      source: "runtime",
      owner: "agent:scout",
      timestamp: Date.now(),
      data: {
        sessionId: "s_unsupported",
        agent: "scout",
        status: "error",
        outcome: "error",
        error: "400 {\"error\":{\"message\":\"litellm.BadRequestError: Github_copilotException - The requested model is not supported.. Received Model Group=claude-opus-4-6\\nAvailable Model Group Fallbacks=None\"}}",
        task: "explore github",
      },
    });

    expect(ctx.sdk.emit).toHaveBeenCalledWith(
      "session.recovery.requested",
      expect.objectContaining({ action: "escalate" }),
      expect.anything(),
    );
    expect(ctx.sdk.emit).not.toHaveBeenCalledWith(
      "session.recovery.requested",
      expect.objectContaining({ action: "requeue" }),
      expect.anything(),
    );
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
    expect(ctx.sdk.emit).not.toHaveBeenCalledWith("session.recovery.requested", expect.anything(), expect.anything());
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

    expect(ctx.sdk.emit).not.toHaveBeenCalledWith("session.recovery.requested", expect.anything(), expect.anything());
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

    expect(ctx.sdk.emit).not.toHaveBeenCalledWith("session.recovery.requested", expect.anything(), expect.anything());
    expect(ctx.sdk.emit).not.toHaveBeenCalled();
  });
});
