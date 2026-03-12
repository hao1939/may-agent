/**
 * Tests for runWatchdog() from watchdog handler.
 */

import { describe, it, expect } from "vitest";
import { runWatchdog } from "../../agents/may/handlers/watchdog.js";
import type { HandlerContext } from "../../src/lib/handler-context.js";

function makeContext(
  sessions: Array<{
    agent: string;
    sessionId: string;
    status: string;
    startedAt: number;
    parentSessionId?: string;
    autoClose?: "immediate" | "never";
  }>,
): HandlerContext {
  const cancelled: string[] = [];
  return {
    manager: {
      status: () =>
        sessions.map((s) => ({
          agent: s.agent,
          sessionId: s.sessionId,
          status: s.status,
          startedAt: s.startedAt,
          parentSessionId: s.parentSessionId,
          autoClose: s.autoClose,
          task: "some task",
          runtime: "1m",
        })),
      cancel: (sid: string) => {
        cancelled.push(sid);
      },
      _cancelled: cancelled,
    } as any,
    persistDir: "/tmp/test",
    projectRoot: "/tmp/test",
    agentsRoot: "/tmp/test/agents",
    agentName: "may",
    getSessionId: () => null,
    log: () => {},
    triggerNow: () => false,
  };
}

describe("runWatchdog", () => {
  it("cancels sessions exceeding default timeout (30 min)", () => {
    const now = Date.now();
    const ctx = makeContext([{ agent: "coder", sessionId: "s1", status: "running", startedAt: now - 35 * 60 * 1000 }]);
    const result = runWatchdog(ctx, {});

    expect(result.checked).toBe(1);
    expect(result.cancelled).toHaveLength(1);
    expect(result.cancelled[0].sessionId).toBe("s1");
    expect(result.cancelled[0].agent).toBe("coder");
    expect((ctx.manager as any)._cancelled).toContain("s1");
  });

  it("does not cancel sessions under timeout", () => {
    const now = Date.now();
    const ctx = makeContext([{ agent: "coder", sessionId: "s1", status: "running", startedAt: now - 10 * 60 * 1000 }]);
    const result = runWatchdog(ctx, {});

    expect(result.checked).toBe(1);
    expect(result.cancelled).toHaveLength(0);
    expect(result.warned).toHaveLength(0);
  });

  it("warns sessions at >75% of timeout", () => {
    const now = Date.now();
    // 24 min = 80% of 30 min default
    const ctx = makeContext([{ agent: "coder", sessionId: "s1", status: "running", startedAt: now - 24 * 60 * 1000 }]);
    const result = runWatchdog(ctx, {});

    expect(result.warned).toHaveLength(1);
    expect(result.warned[0].sessionId).toBe("s1");
    expect(result.cancelled).toHaveLength(0);
  });

  it("skips non-running sessions", () => {
    const now = Date.now();
    const ctx = makeContext([
      { agent: "coder", sessionId: "s1", status: "idle", startedAt: now - 60 * 60 * 1000 },
      { agent: "coder", sessionId: "s2", status: "complete", startedAt: now - 60 * 60 * 1000 },
    ]);
    const result = runWatchdog(ctx, {});

    expect(result.checked).toBe(0);
    expect(result.cancelled).toHaveLength(0);
  });

  it("skips persistent agent (may) sessions without parent", () => {
    const now = Date.now();
    const ctx = makeContext([
      { agent: "may", sessionId: "s1", status: "running", startedAt: now - 60 * 60 * 1000, autoClose: "never" },
    ]);
    const result = runWatchdog(ctx, {});

    expect(result.checked).toBe(0);
    expect(result.cancelled).toHaveLength(0);
  });

  it("does NOT skip may's child sessions (with parentSessionId)", () => {
    const now = Date.now();
    const ctx = makeContext([
      {
        agent: "may",
        sessionId: "s1",
        status: "running",
        startedAt: now - 60 * 60 * 1000,
        parentSessionId: "parent-1",
      },
    ]);
    const result = runWatchdog(ctx, {});

    expect(result.checked).toBe(1);
    expect(result.cancelled).toHaveLength(1);
  });

  it("respects per-agent timeout overrides", () => {
    const now = Date.now();
    const ctx = makeContext([
      // evaluator has 45 min default timeout — 35 min should be safe
      { agent: "evaluator", sessionId: "s1", status: "running", startedAt: now - 35 * 60 * 1000 },
      // coder has 30 min default — 35 min should be cancelled
      { agent: "coder", sessionId: "s2", status: "running", startedAt: now - 35 * 60 * 1000 },
    ]);
    const result = runWatchdog(ctx, {});

    expect(result.cancelled).toHaveLength(1);
    expect(result.cancelled[0].agent).toBe("coder");
  });

  it("respects custom config overrides", () => {
    const now = Date.now();
    const ctx = makeContext([{ agent: "coder", sessionId: "s1", status: "running", startedAt: now - 35 * 60 * 1000 }]);
    // Custom: coder gets 60 min timeout
    const result = runWatchdog(ctx, { agentTimeouts: { coder: 60 * 60 * 1000 } });

    expect(result.cancelled).toHaveLength(0);
  });

  it("dryRun mode does not cancel", () => {
    const now = Date.now();
    const ctx = makeContext([{ agent: "coder", sessionId: "s1", status: "running", startedAt: now - 60 * 60 * 1000 }]);
    const result = runWatchdog(ctx, { dryRun: true });

    expect(result.cancelled).toHaveLength(1); // Still reported
    expect((ctx.manager as any)._cancelled).toHaveLength(0); // But not actually cancelled
  });
});
