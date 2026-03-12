/**
 * Cron tests — tests the current Cron class behavior.
 *
 * Execution modes:
 *   1. heartbeat: manager.run() + waitFor() — fresh task session each fire
 *   2. job-handler: registered JS function runs in-process
 *   3. job-detached: spawnDetachedAgent() in separate OS process
 *
 * No legacy followUp mode — that was removed in the Chat+Task refactor.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { Cron } from "../src/app/cron.js";
import type { JobResult } from "../src/lib/cron-tool.js";

// Mock spawnDetachedAgent — we don't want real child processes in tests
vi.mock("../src/lib/detached.js", () => ({
  spawnDetachedAgent: vi.fn(() => ({ pid: 99999 })),
}));

import { spawnDetachedAgent } from "../src/lib/detached.js";
const mockSpawn = vi.mocked(spawnDetachedAgent);

/**
 * Flush microtask queue so async .then() chains in fireHandler / fireHeartbeat
 * complete. Advancing by 0ms async processes pending microtasks.
 */
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
};

/** Minimal mock of SubagentManager with the APIs Cron actually calls. */
function makeMockManager() {
  const calls: Array<{ method: string; args: any[] }> = [];
  let sessionCounter = 0;

  // Default: waitFor resolves immediately
  let waitForResolver: ((sid: string) => Promise<void>) | null = null;

  return {
    calls,

    run(agentName: string, task: string, opts?: any): string {
      const sid = `mock-sid-${++sessionCounter}`;
      calls.push({ method: "run", args: [agentName, task, opts] });
      return sid;
    },

    waitFor(sessionId: string): Promise<any> {
      calls.push({ method: "waitFor", args: [sessionId] });
      if (waitForResolver) return waitForResolver(sessionId);
      return Promise.resolve({ status: "complete" });
    },

    status() {
      return [];
    },

    hasAgent(_name: string) {
      return true;
    },
    agentNames() {
      return ["may", "bob", "optimizer"];
    },

    /** Override waitFor behavior for testing overlap/blocking. */
    setWaitFor(fn: (sid: string) => Promise<void>) {
      waitForResolver = fn;
    },
  };
}

describe("Cron", () => {
  let dir: string;
  let configPath: string;
  let stateDir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "cron-"));
    // Cron derives projectRoot = resolve(dirname(configPath), "../..")
    // so configPath must be at <dir>/agents/may/cron.json → projectRoot = <dir>
    configPath = resolve(dir, "agents", "may", "cron.json");
    stateDir = resolve(dir, ".state");
    mkdirSync(resolve(dir, "agents", "may"), { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    vi.useFakeTimers();
    mockSpawn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  // ── Loading ─────────────────────────────────────────────────────────

  it("loads entries from cron.json", () => {
    writeFileSync(configPath, JSON.stringify([{ name: "health", intervalMs: 60000, message: "check" }]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    const entries = c.load();
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("health");
  });

  it("returns empty when no config file", () => {
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    expect(c.load()).toHaveLength(0);
  });

  it("skips invalid entries", () => {
    const errors: string[] = [];
    writeFileSync(
      configPath,
      JSON.stringify([
        { name: "ok", intervalMs: 60000, message: "fine" },
        { name: 123 },
        { name: "fast", intervalMs: 500, message: "too fast" },
      ]),
    );
    const mgr = makeMockManager();
    const c = new Cron(
      configPath,
      mgr as any,
      () => "sid-1",
      (msg) => errors.push(msg),
    );
    const entries = c.load();
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("ok");
    expect(errors).toHaveLength(2);
  });

  it("skips disabled entries on start", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([
        { name: "active", type: "job", intervalMs: 10000, message: "yes", enabled: true, handler: "active" },
        { name: "disabled", type: "job", intervalMs: 10000, message: "no", enabled: false, handler: "disabled" },
      ]),
    );
    const mgr = makeMockManager();
    let activeCalled = false;
    let disabledCalled = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("active", async () => {
      activeCalled = true;
    });
    c.registerHandler("disabled", async () => {
      disabledCalled = true;
    });
    c.start();

    await vi.advanceTimersByTimeAsync(10000);
    await flush();
    expect(activeCalled).toBe(true);
    expect(disabledCalled).toBe(false);

    c.stop();
  });

  it("treats entries without enabled field as enabled", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "implicit", type: "job", intervalMs: 10000, message: "go", handler: "implicit" }]),
    );
    const mgr = makeMockManager();
    let called = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("implicit", async () => {
      called = true;
    });
    c.start();

    await vi.advanceTimersByTimeAsync(10000);
    await flush();
    expect(called).toBe(true);

    c.stop();
  });

  it("stop clears all jobs", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "a", type: "job", intervalMs: 10000, message: "m1", handler: "a" }]),
    );
    const mgr = makeMockManager();
    let callCount = 0;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("a", async () => {
      callCount++;
    });
    c.start();

    c.stop();
    await vi.advanceTimersByTimeAsync(100000);
    await flush();
    expect(callCount).toBe(0);
  });

  it("reload picks up new entries", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "old", type: "job", intervalMs: 10000, message: "old", handler: "old" }]),
    );
    const mgr = makeMockManager();
    const calls: string[] = [];
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("old", async () => {
      calls.push("old");
    });
    c.registerHandler("new", async () => {
      calls.push("new");
    });
    c.start();

    // Replace config
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "new", type: "job", intervalMs: 15000, message: "new", handler: "new" }]),
    );
    c.reload();

    await vi.advanceTimersByTimeAsync(15000);
    await flush();
    expect(calls).toEqual(["new"]);

    c.stop();
  });

  // ── Heartbeat mode ──────────────────────────────────────────────────

  it("heartbeat: calls manager.run() with agent name and message", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "hb-bob", type: "heartbeat", intervalMs: 30000, agent: "bob", message: "wake up" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const runCalls = mgr.calls.filter((c) => c.method === "run");
    expect(runCalls).toHaveLength(1);
    expect(runCalls[0].args[0]).toBe("bob");
    expect(runCalls[0].args[1]).toBe("wake up");

    c.stop();
  });

  it("heartbeat: calls waitFor() after run()", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "hb", type: "heartbeat", intervalMs: 30000, agent: "may", message: "check" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const waitCalls = mgr.calls.filter((c) => c.method === "waitFor");
    expect(waitCalls).toHaveLength(1);
    expect(waitCalls[0].args[0]).toMatch(/^mock-sid-/);

    c.stop();
  });

  it("heartbeat: spawns fresh session each fire (no reuse)", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "hb", type: "heartbeat", intervalMs: 10000, agent: "bob", message: "go" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    await vi.advanceTimersByTimeAsync(10000);
    await flush();
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    const runCalls = mgr.calls.filter((c) => c.method === "run");
    expect(runCalls).toHaveLength(2);
    // Each run returns a different session ID
    const sids = mgr.calls.filter((c) => c.method === "waitFor").map((c) => c.args[0]);
    expect(sids[0]).not.toBe(sids[1]);

    c.stop();
  });

  it("heartbeat: records success in job-history", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([
        { name: "hb-may", type: "heartbeat", intervalMs: 30000, agent: "may", message: "heartbeat check" },
      ]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const historyPath = resolve(stateDir, "job-history.jsonl");
    expect(existsSync(historyPath)).toBe(true);
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    const result: JobResult = JSON.parse(lines[0]);
    expect(result.jobName).toBe("hb-may");
    expect(result.type).toBe("heartbeat");
    expect(result.status).toBe("success");
    expect(result.agent).toBe("may");

    c.stop();
  });

  it("heartbeat: records failure when waitFor rejects", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "hb-fail", type: "heartbeat", intervalMs: 30000, agent: "bob", message: "boom" }]),
    );
    const mgr = makeMockManager();
    mgr.setWaitFor(() => Promise.reject(new Error("session exploded")));
    const errors: string[] = [];
    const c = new Cron(
      configPath,
      mgr as any,
      () => "sid-1",
      (msg) => errors.push(msg),
    );
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const historyPath = resolve(stateDir, "job-history.jsonl");
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    const result: JobResult = JSON.parse(lines[0]);
    expect(result.status).toBe("failure");
    expect(result.error).toContain("session exploded");
    expect(errors.some((e) => e.includes("session exploded"))).toBe(true);

    c.stop();
  });

  it("heartbeat: skips if previous heartbeat still processing", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "hb-slow", type: "heartbeat", intervalMs: 10000, agent: "bob", message: "hb" }]),
    );
    const mgr = makeMockManager();
    const errors: string[] = [];
    let resolveWait!: () => void;
    mgr.setWaitFor(
      () =>
        new Promise<void>((r) => {
          resolveWait = r;
        }),
    );

    const c = new Cron(
      configPath,
      mgr as any,
      () => "sid-1",
      (msg) => errors.push(msg),
    );
    c.start();

    // First fire — starts, hangs on waitFor
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    // Second fire — should skip
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    expect(errors.some((e) => e.includes("skipped"))).toBe(true);
    // Only one run() call — the second was skipped
    const runCalls = mgr.calls.filter((c) => c.method === "run");
    expect(runCalls).toHaveLength(1);

    // Check skip recorded in history
    const historyPath = resolve(stateDir, "job-history.jsonl");
    expect(existsSync(historyPath)).toBe(true);
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    const skipResult: JobResult = JSON.parse(lines[0]);
    expect(skipResult.status).toBe("skipped");
    expect(skipResult.type).toBe("heartbeat");

    resolveWait();
    await flush();
    c.stop();
  });

  it("heartbeat: defaults agent to 'may' when not specified", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "hb-default", type: "heartbeat", intervalMs: 30000, message: "check" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const runCalls = mgr.calls.filter((c) => c.method === "run");
    expect(runCalls[0].args[0]).toBe("may");

    c.stop();
  });

  // ── Job with handler ────────────────────────────────────────────────

  it("job-handler: runs registered JS handler", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "eval", type: "job", intervalMs: 30000, message: "evaluate", handler: "eval" }]),
    );
    const mgr = makeMockManager();
    let handlerCalled = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("eval", async () => {
      handlerCalled = true;
    });
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    expect(handlerCalled).toBe(true);
    // Should NOT have called manager.run() — handler takes priority
    expect(mgr.calls.filter((c) => c.method === "run")).toHaveLength(0);

    c.stop();
  });

  it("job-handler: records success in job-history", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "eval", type: "job", intervalMs: 30000, message: "evaluate", handler: "eval" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("eval", async () => {});
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const historyPath = resolve(stateDir, "job-history.jsonl");
    expect(existsSync(historyPath)).toBe(true);
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(1);
    const result: JobResult = JSON.parse(lines[0]);
    expect(result.jobName).toBe("eval");
    expect(result.type).toBe("job");
    expect(result.status).toBe("success");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    c.stop();
  });

  it("job-handler: records failure on error", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "fail-job", type: "job", intervalMs: 30000, message: "fail", handler: "fail-job" }]),
    );
    const mgr = makeMockManager();
    const errors: string[] = [];
    const c = new Cron(
      configPath,
      mgr as any,
      () => "sid-1",
      (msg) => errors.push(msg),
    );
    c.registerHandler("fail-job", async () => {
      throw new Error("handler broke");
    });
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const historyPath = resolve(stateDir, "job-history.jsonl");
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    const result: JobResult = JSON.parse(lines[0]);
    expect(result.status).toBe("failure");
    expect(result.error).toContain("handler broke");
    expect(errors.some((e) => e.includes("handler broke"))).toBe(true);

    c.stop();
  });

  it("job-handler: skips if previous handler still running", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "slow", type: "job", intervalMs: 10000, message: "slow", handler: "slow" }]),
    );
    const mgr = makeMockManager();
    const errors: string[] = [];
    let resolveHandler!: () => void;
    let callCount = 0;

    const c = new Cron(
      configPath,
      mgr as any,
      () => "sid-1",
      (msg) => errors.push(msg),
    );
    c.registerHandler("slow", () => {
      callCount++;
      return new Promise<void>((r) => {
        resolveHandler = r;
      });
    });
    c.start();

    // First fire: starts handler (doesn't complete)
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    // Second fire: should be skipped
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    expect(callCount).toBe(1);
    expect(errors.some((e) => e.includes("skipped"))).toBe(true);

    const historyPath = resolve(stateDir, "job-history.jsonl");
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    const skipResult: JobResult = JSON.parse(lines[0]);
    expect(skipResult.status).toBe("skipped");

    resolveHandler();
    await flush();
    c.stop();
  });

  it("job-handler: appends multiple results to job-history", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "multi", type: "job", intervalMs: 10000, message: "run", handler: "multi" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("multi", async () => {});
    c.start();

    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(10000);
      await flush();
    }

    const historyPath = resolve(stateDir, "job-history.jsonl");
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      const result: JobResult = JSON.parse(line);
      expect(result.jobName).toBe("multi");
      expect(result.status).toBe("success");
    }

    c.stop();
  });

  // ── Job-detached mode (agent without handler) ───────────────────────

  it("job-detached: spawns detached agent for entry with agent but no handler", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "analyze", intervalMs: 60000, agent: "bob", message: "do analysis" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    await vi.advanceTimersByTimeAsync(60000);
    await flush();

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const call = mockSpawn.mock.calls[0][0];
    expect(call.agentName).toBe("bob");
    expect(call.task).toBe("do analysis");

    c.stop();
  });

  it("job-detached: records spawn result in job-history", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "analyze", intervalMs: 60000, agent: "bob", message: "do analysis" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    await vi.advanceTimersByTimeAsync(60000);
    await flush();

    const historyPath = resolve(stateDir, "job-history.jsonl");
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    const result: JobResult = JSON.parse(lines[0]);
    expect(result.jobName).toBe("analyze");
    expect(result.type).toBe("job");
    expect(result.status).toBe("success");
    expect(result.agent).toBe("bob");
    expect(result.summary).toContain("pid=99999");

    c.stop();
  });

  it("job-detached: records failure when spawn throws", async () => {
    mockSpawn.mockImplementation(() => {
      throw new Error("spawn failed");
    });
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "fail-spawn", intervalMs: 60000, agent: "bob", message: "boom" }]),
    );
    const mgr = makeMockManager();
    const errors: string[] = [];
    const c = new Cron(
      configPath,
      mgr as any,
      () => "sid-1",
      (msg) => errors.push(msg),
    );
    c.start();

    await vi.advanceTimersByTimeAsync(60000);
    await flush();

    const historyPath = resolve(stateDir, "job-history.jsonl");
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    const result: JobResult = JSON.parse(lines[0]);
    expect(result.status).toBe("failure");
    expect(result.error).toContain("spawn failed");

    c.stop();
  });

  // ── Mode resolution (no type field) ─────────────────────────────────

  it("entry with handler but no type: resolves as job-handler", async () => {
    writeFileSync(configPath, JSON.stringify([{ name: "js-job", intervalMs: 30000, message: "run handler" }]));
    const mgr = makeMockManager();
    let handlerCalled = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("js-job", async () => {
      handlerCalled = true;
    });
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    expect(handlerCalled).toBe(true);
    expect(mgr.calls.filter((c) => c.method === "run")).toHaveLength(0);

    c.stop();
  });

  it("entry with no handler, no agent, no type: rejected with error", () => {
    writeFileSync(configPath, JSON.stringify([{ name: "orphan", intervalMs: 30000, message: "nobody" }]));
    const mgr = makeMockManager();
    const errors: string[] = [];
    const c = new Cron(
      configPath,
      mgr as any,
      () => "sid-1",
      (msg) => errors.push(msg),
    );
    c.start();

    vi.advanceTimersByTime(30000);
    // Entry rejected at startEntry — no timer registered, no fire
    expect(errors.some((e) => e.includes("no handler and no agent"))).toBe(true);

    c.stop();
  });

  // ── onFire callback ─────────────────────────────────────────────────

  it("onFire called with correct type for each mode", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([
        { name: "hb", type: "heartbeat", intervalMs: 30000, agent: "bob", message: "heartbeat" },
        { name: "js", type: "job", intervalMs: 30000, message: "js job", handler: "js" },
        { name: "det", intervalMs: 30000, agent: "optimizer", message: "detached job" },
      ]),
    );
    const mgr = makeMockManager();
    const fires: Array<{ name: string; type: string }> = [];
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("js", async () => {});
    c.onFire((entry, type) => fires.push({ name: entry.name, type }));
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    expect(fires).toHaveLength(3);
    expect(fires.find((f) => f.name === "hb")?.type).toBe("heartbeat");
    expect(fires.find((f) => f.name === "js")?.type).toBe("js");
    expect(fires.find((f) => f.name === "det")?.type).toBe("detached");

    c.stop();
  });

  // ── triggerNow() ────────────────────────────────────────────────────

  it("triggerNow: fires entry immediately", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "trigger-me", type: "job", intervalMs: 300000, message: "go", handler: "trigger-me" }]),
    );
    const mgr = makeMockManager();
    let called = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("trigger-me", async () => {
      called = true;
    });
    c.start();

    const result = c.triggerNow("trigger-me");
    await flush();

    expect(result).toBe(true);
    expect(called).toBe(true);

    c.stop();
  });

  it("triggerNow: returns false for unknown entry", () => {
    writeFileSync(configPath, JSON.stringify([]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    expect(c.triggerNow("nonexistent")).toBe(false);

    c.stop();
  });

  it("triggerNow: debounces rapid re-triggers", () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "debounced", type: "job", intervalMs: 300000, message: "go", handler: "debounced" }]),
    );
    const mgr = makeMockManager();
    let callCount = 0;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("debounced", async () => {
      callCount++;
    });
    c.start();

    expect(c.triggerNow("debounced")).toBe(true);
    // Second trigger within cooldown window — should be debounced
    expect(c.triggerNow("debounced")).toBe(false);

    c.stop();
  });

  it("triggerNow: latches heartbeat when agent is busy", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "hb-latch", type: "heartbeat", intervalMs: 300000, agent: "bob", message: "hb" }]),
    );
    const mgr = makeMockManager();
    let resolveWait!: () => void;
    mgr.setWaitFor(
      () =>
        new Promise<void>((r) => {
          resolveWait = r;
        }),
    );

    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    // First fire via triggerNow — starts heartbeat, hangs on waitFor
    expect(c.triggerNow("hb-latch")).toBe(true);
    await flush();

    // Advance past cooldown so debounce doesn't block
    vi.advanceTimersByTime(c.triggerCooldownMs + 1);

    // Second trigger while busy — should latch (return true) but not run
    expect(c.triggerNow("hb-latch")).toBe(true);
    const runCalls = mgr.calls.filter((c) => c.method === "run");
    expect(runCalls).toHaveLength(1); // Only the first run

    // Complete first heartbeat — latch fires second
    resolveWait();
    await flush();

    const runCallsAfter = mgr.calls.filter((c) => c.method === "run");
    expect(runCallsAfter).toHaveLength(2); // Latch caused second run

    c.stop();
  });

  // ── Mode resolution ────────────────────────────────────────────────

  it("resolves mode correctly for all entry combinations", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([
        { name: "explicit-hb", type: "heartbeat", intervalMs: 30000, agent: "bob", message: "hb" },
        { name: "explicit-job-h", type: "job", intervalMs: 30000, message: "jh", handler: "explicit-job-h" },
      ]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("explicit-job-h", async () => {});
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    // Heartbeat → run() called
    const runCalls = mgr.calls.filter((c) => c.method === "run");
    expect(runCalls.length).toBeGreaterThanOrEqual(1);
    expect(runCalls[0].args[0]).toBe("bob");

    c.stop();
  });
});
