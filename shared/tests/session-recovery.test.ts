import { describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create } from "../../may/handlers/session-recovery.js";
import { execute } from "../workflows/session-recovery.js";

function makeCtx(action?: string | null, overrides: Record<string, unknown> = {}) {
  const runWorkflow = vi.fn(async () => ({ status: "done" as const, summary: "ok", runId: "wr_recovery" }));
  return {
    agentName: "may",
    sdk: {
      paths: { root: "/tmp/session-recovery-test", persist: "/tmp/session-recovery-test/.state" },
      getDb: vi.fn(),
      runAgent: vi.fn(() => { throw new Error("session-recovery handler should dispatch a workflow, not run agents directly"); }),
      runWorkflow,
      emit: vi.fn(),
      log: vi.fn(),
      escalate: vi.fn(),
      ...overrides,
    },
    getLastDigest: vi.fn(() => action ? { action } : null),
    classifyError: vi.fn(() => "infra"),
    upsertDigest: vi.fn(async () => null),
  } as any;
}

function staleHarness() {
  const root = mkdtempSync(join(tmpdir(), "session-recovery-"));
  const persist = join(root, ".state");
  const sessionDir = join(persist, "sessions", "s_stale");
  mkdirSync(sessionDir, { recursive: true });
  const startedAt = Date.now() - 60 * 60_000;
  const row = {
    sessionId: "s_stale",
    agent: "master",
    task: "echo hello",
    status: "running",
    startedAt,
  };
  writeFileSync(join(sessionDir, "meta.json"), JSON.stringify({
    agent: "master",
    task: "echo hello",
    status: "running",
    startedAt,
    kind: "job",
    autoClose: "immediate",
  }));
  writeFileSync(join(sessionDir, "session.jsonl"), JSON.stringify({
    role: "user",
    content: [{ type: "text", text: "echo hello" }],
    timestamp: startedAt,
  }) + "\n");

  const updates: Array<unknown[]> = [];
  const prepare = vi.fn((sql: string) => {
    if (sql.includes("SELECT sessionId")) return { all: vi.fn(() => [row]) };
    if (sql.includes("UPDATE sessions")) return { run: vi.fn((...args: unknown[]) => { updates.push(args); return { changes: 1 }; }) };
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const db = { prepare };
  const emit = vi.fn();
  const ctx = makeCtx(null, {
    paths: { root, persist },
    getDb: vi.fn(() => db),
    emit,
  });
  return { root, ctx, emit, updates };
}

describe("session-recovery handler", () => {
  it("dispatches recoverable failures through the session-recovery workflow", async () => {
    const ctx = makeCtx("requeue");
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.failed",
      source: "event",
      entry: "session-recovery",
      timestamp: Date.now(),
      data: {
        sessionId: "s_failed",
        agent: "dev",
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
      type: "session.failed",
      source: "event",
      entry: "session-recovery",
      timestamp: Date.now(),
      data: {
        sessionId: "s_failed",
        agent: "dev",
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

  it("auto-closes stale immediate sessions with no assistant activity on timer fallback", async () => {
    const { root, ctx, emit, updates } = staleHarness();
    try {
      const handler = create(ctx, {} as any);

      await handler();

      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual(expect.arrayContaining([
        "Auto-closed stale immediate session with no assistant activity",
        "s_stale",
      ]));
      expect(emit).toHaveBeenCalledWith("session.end", expect.objectContaining({
        sessionId: "s_stale",
        autoClosed: true,
        reason: "stale_immediate_no_assistant_activity",
      }));
      expect(emit).toHaveBeenCalledWith("session.failed", expect.objectContaining({
        sessionId: "s_stale",
        task: "echo hello",
        autoClosed: true,
      }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not auto-close stale immediate sessions that have assistant activity", async () => {
    const { root, ctx, emit, updates } = staleHarness();
    try {
      const jsonlPath = join(root, ".state", "sessions", "s_stale", "session.jsonl");
      writeFileSync(jsonlPath, readFileSync(jsonlPath, "utf8") + JSON.stringify({ role: "assistant", content: "hello" }) + "\n");
      const handler = create(ctx, {} as any);

      await handler();

      expect(updates).toHaveLength(0);
      expect(emit).not.toHaveBeenCalledWith("session.end", expect.anything());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("session-recovery workflow", () => {
  it("reruns the failed agent for recoverable decisions and emits recovery evidence", async () => {
    const emit = vi.fn();
    const runAgent = vi.fn(async () => ({
      sessionId: "s_recovery",
      status: "done",
      lastAssistantText: "ok",
      messages: [],
      duration: "1s",
      outputDir: "/tmp",
    }));
    const ctx = {
      task: [
        "[session-recovery] Handle failed session s_failed.",
        "",
        "## Recovery Decision",
        "```json",
        JSON.stringify({
          sessionId: "s_failed",
          agent: "dev",
          action: "requeue",
          source: "digest",
          attempt: 1,
          maxAttempts: 2,
          error: "provider transient",
          task: "fix the bug",
        }),
        "```",
      ].join("\n"),
      runAgent,
      emit,
      done: (summary: string) => ({ type: "done", summary }),
      escalate: (reason: string, context?: unknown) => ({ type: "escalate", reason, context }),
    } as any;

    const result = await execute(ctx);

    expect(result).toMatchObject({ type: "done" });
    expect(runAgent).toHaveBeenCalledWith("dev", expect.stringContaining("## Original Task\nfix the bug"));
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      type: "session.recovery_attempted",
      sessionId: "s_failed",
      newSessionId: "s_recovery",
      status: "done",
    }));
  });
});
