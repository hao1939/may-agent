import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentRun } from "./agent-runner.js";
import { SubagentManager } from "./manager.js";
import { ensureSessionDir, markSessionActive } from "./persistence.js";

type Listener = (event: any) => void;

function fakeAgent() {
  const listeners = new Set<Listener>();
  let cancelled = false;
  const agent: AgentRun = {
    state: { messages: [] } as any,
    prompt: async () => new Promise<void>(() => undefined),
    waitForIdle: async () => undefined,
    followUp: () => undefined,
    continue: async () => undefined,
    steer: () => undefined,
    cancel: () => {
      cancelled = true;
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    agent,
    emit: (type: string) => {
      for (const listener of listeners) listener({ type });
    },
    cancelled: () => cancelled,
  };
}

function session(agent: AgentRun, kind: "job" | "call" | "chat" = "job"): any {
  return {
    sessionId: "observation-test",
    agent,
    agentName: "test-agent",
    task: "test observation timeout",
    startedAt: Date.now(),
    status: "running",
    kind,
    autoClose: kind === "chat" ? "never" : "immediate",
    toolCalls: 0,
    turnCount: 0,
    openTurnTraces: [],
    loadedSkillHashes: new Set(),
    requireFinish: false,
    toolPolicy: "full",
  };
}

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function manager(timeoutMs: number): SubagentManager {
  const persistDir = mkdtempSync(join(tmpdir(), "may-observation-timeout-"));
  dirs.push(persistDir);
  return new SubagentManager({ persistDir, noObservationTimeoutMs: timeoutMs });
}

describe("job/call no-observation deadline", () => {
  it("cancels silent work", async () => {
    const runtime = manager(20);
    const fake = fakeAgent();
    const active = session(fake.agent);

    await expect((runtime as any).withObservationDeadline(active, () => fake.agent.prompt("work"))).rejects.toThrow(
      "No agent observation",
    );
    expect(fake.cancelled()).toBe(true);
    expect(active.status).toBe("interrupted");
  });

  it("resets the deadline on every observation", async () => {
    const runtime = manager(60);
    const fake = fakeAgent();
    const active = session(fake.agent, "call");
    const work = (runtime as any).withObservationDeadline(
      active,
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => fake.emit("message_end"), 35);
          setTimeout(() => fake.emit("tool_execution_update"), 75);
          setTimeout(() => resolve("done"), 105);
        }),
    );

    await expect(work).resolves.toBe("done");
    expect(fake.cancelled()).toBe(false);
  });

  it("does not let partial model deltas hide a stalled turn", async () => {
    const runtime = manager(30);
    const fake = fakeAgent();
    const active = session(fake.agent);
    const updates = setInterval(() => fake.emit("message_update"), 5);

    try {
      await expect(
        (runtime as any).withObservationDeadline(active, () => new Promise<void>(() => undefined)),
      ).rejects.toThrow("No agent observation");
    } finally {
      clearInterval(updates);
    }
    expect(fake.cancelled()).toBe(true);
  });

  it("does not apply the worker deadline to persistent chat", async () => {
    const runtime = manager(20);
    const fake = fakeAgent();
    const active = session(fake.agent, "chat");

    await expect(
      (runtime as any).withObservationDeadline(
        active,
        () => new Promise<string>((resolve) => setTimeout(() => resolve("idle"), 45)),
      ),
    ).resolves.toBe("idle");
    expect(fake.cancelled()).toBe(false);
  });

  it("records a terminal result and releases managed-session capacity", async () => {
    const runtime = manager(20);
    const fake = fakeAgent();
    const active = session(fake.agent);
    const persistDir = (runtime as any)._persistDir as string;
    ensureSessionDir(persistDir, active.sessionId);
    markSessionActive(persistDir, active.sessionId);
    (runtime as any)._registry.saveSession(active.sessionId, {
      agent: active.agentName,
      task: active.task,
      status: "running",
      startedAt: active.startedAt,
      kind: active.kind,
      autoClose: active.autoClose,
    });
    runtime.activeSessions.set(active.sessionId, active);

    (runtime as any).startManagedExecution(active);
    const result = await runtime.waitFor(active.sessionId);

    expect(result.status).toBe("interrupted");
    expect(result.error).toContain("No agent observation");
    expect(runtime.hasActiveSession(active.sessionId)).toBe(false);
    expect(runtime.getSessionSummary(active.sessionId).status).toBe("interrupted");
  });
});
