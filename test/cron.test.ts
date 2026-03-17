/**
 * Cron tests — tests the Cron class behavior.
 *
 * Execution modes:
 *   1. heartbeat: manager.run() + waitFor() — fresh task session each fire
 *   2. job-handler: registered JS function runs in-process
 *   3. job-detached: spawnDetachedAgent() in separate OS process
 *
 * Results are tracked via the requests table (SQLite).
 * Since vitest runs under Node.js (no bun:sqlite), we mock the request functions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { Cron } from "../src/app/cron.js";

// ── Mocks ─────────────────────────────────────────────────────────────

// Mock spawnDetachedAgent — no real child processes in tests
vi.mock("../src/lib/detached.js", () => ({
  spawnDetachedAgent: vi.fn(() => ({ pid: 99999 })),
}));
import { spawnDetachedAgent } from "../src/lib/detached.js";
const mockSpawn = vi.mocked(spawnDetachedAgent);

// Mock request tracking — no bun:sqlite in vitest
// We track calls and provide a simple in-memory store for overlap queries.
const requestStore = new Map<string, { requestId: string; artifact: string; status: string; fromEntity: string; createdAt: number; context: string | null; sessionId: string | null }>();
let requestCounter = 0;

const mockTrackRequest = vi.fn((_persistDir: string, opts: any) => {
  const requestId = `req-${++requestCounter}`;
  requestStore.set(requestId, {
    requestId,
    artifact: opts.artifact ?? "",
    status: "CREATED",
    fromEntity: opts.fromEntity ?? "cron",
    createdAt: Date.now(),
    context: opts.context ?? null,
    sessionId: opts.sessionId ?? null,
  });
  return requestId;
});

const mockUpdateRequest = vi.fn((_persistDir: string, requestId: string, update: any) => {
  const entry = requestStore.get(requestId);
  if (entry && update.status) entry.status = update.status;
  if (entry && update.sessionId) entry.sessionId = update.sessionId;
});

// Mock getDb — returns an object with .query() and .run() that read from requestStore
function makeMockDb() {
  return {
    query(sql: string) {
      return {
        get(...args: any[]) {
          // Overlap check: SELECT 1 FROM requests WHERE artifact = ? AND status IN (...)
          if (sql.includes("artifact") && sql.includes("IN ('CREATED', 'IN_PROGRESS')")) {
            const artifact = args[0];
            for (const entry of requestStore.values()) {
              if (entry.artifact === artifact && (entry.status === "CREATED" || entry.status === "IN_PROGRESS")) {
                return { 1: 1 };
              }
            }
            return null;
          }
          // Last fire time: SELECT MAX(createdAt)
          if (sql.includes("MAX(createdAt)")) {
            const artifact = args[0];
            let maxTime: number | null = null;
            for (const entry of requestStore.values()) {
              if (entry.artifact === artifact) {
                if (maxTime === null || entry.createdAt > maxTime) maxTime = entry.createdAt;
              }
            }
            return maxTime !== null ? { lastFire: maxTime } : null;
          }
          // PID check: SELECT context FROM requests WHERE artifact = ?
          if (sql.includes("context") && sql.includes("artifact")) {
            const artifact = args[0];
            for (const entry of requestStore.values()) {
              if (entry.artifact === artifact && (entry.status === "CREATED" || entry.status === "IN_PROGRESS")) {
                return { context: entry.context };
              }
            }
            return null;
          }
          return null;
        },
        all(..._args: any[]) {
          return [];
        },
      };
    },
    run(_sql: string, _args?: any[]) {
      // For failOrphans: UPDATE requests SET status = 'FAILED' WHERE artifact = ?
      if (_sql.includes("status = 'FAILED'") && _args) {
        const artifact = _args[_args.length - 1];
        for (const entry of requestStore.values()) {
          if (entry.artifact === artifact && (entry.status === "CREATED" || entry.status === "IN_PROGRESS")) {
            entry.status = "FAILED";
          }
        }
      }
      return { changes: 0 };
    },
  };
}

vi.mock("../src/lib/requests.js", () => ({
  getDb: vi.fn(() => makeMockDb()),
  trackRequest: (...args: any[]) => mockTrackRequest(...args),
  updateRequest: (...args: any[]) => mockUpdateRequest(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
};

/** Minimal mock of SubagentManager with the APIs Cron actually calls. */
function makeMockManager() {
  const calls: Array<{ method: string; args: any[] }> = [];
  let sessionCounter = 0;
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

    status() { return []; },
    hasAgent(_name: string) { return true; },
    agentNames() { return ["may", "bob", "optimizer"]; },

    setWaitFor(fn: (sid: string) => Promise<void>) {
      waitForResolver = fn;
    },
  };
}

/** Get tracked requests by artifact name. */
function getRequestsByArtifact(artifact: string) {
  return [...requestStore.values()].filter((r) => r.artifact === artifact);
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("Cron", () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "cron-"));
    configPath = resolve(dir, "agents", "may", "cron.json");
    mkdirSync(resolve(dir, "agents", "may"), { recursive: true });
    mkdirSync(resolve(dir, ".state"), { recursive: true });
    vi.useFakeTimers();
    mockSpawn.mockClear();
    mockTrackRequest.mockClear();
    mockUpdateRequest.mockClear();
    requestStore.clear();
    requestCounter = 0;
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
    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    const entries = c.load();
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("ok");
    expect(errors).toHaveLength(2);
  });

  it("skips disabled entries on start", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([
        { name: "active", type: "job", intervalMs: 10000, message: "yes", enabled: true },
        { name: "disabled", type: "job", intervalMs: 10000, message: "no", enabled: false },
      ]),
    );
    const mgr = makeMockManager();
    let activeCalled = false;
    let disabledCalled = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("active", async () => { activeCalled = true; });
    c.registerHandler("disabled", async () => { disabledCalled = true; });
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
      JSON.stringify([{ name: "implicit", type: "job", intervalMs: 10000, message: "go" }]),
    );
    const mgr = makeMockManager();
    let called = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("implicit", async () => { called = true; });
    c.start();

    await vi.advanceTimersByTimeAsync(10000);
    await flush();
    expect(called).toBe(true);

    c.stop();
  });

  it("stop clears all jobs", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "a", type: "job", intervalMs: 10000, message: "m1" }]),
    );
    const mgr = makeMockManager();
    let callCount = 0;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("a", async () => { callCount++; });
    c.start();

    c.stop();
    await vi.advanceTimersByTimeAsync(100000);
    await flush();
    expect(callCount).toBe(0);
  });

  it("reload picks up new entries", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "old", type: "job", intervalMs: 10000, message: "old" }]),
    );
    const mgr = makeMockManager();
    const calls: string[] = [];
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("old", async () => { calls.push("old"); });
    c.registerHandler("new", async () => { calls.push("new"); });
    c.start();

    writeFileSync(
      configPath,
      JSON.stringify([{ name: "new", type: "job", intervalMs: 15000, message: "new" }]),
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
    const sids = mgr.calls.filter((c) => c.method === "waitFor").map((c) => c.args[0]);
    expect(sids[0]).not.toBe(sids[1]);

    c.stop();
  });

  it("heartbeat: tracks request on fire", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "hb-may", type: "heartbeat", intervalMs: 30000, agent: "may", message: "heartbeat check" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    expect(mockTrackRequest).toHaveBeenCalled();
    const trackCall = mockTrackRequest.mock.calls[0];
    expect(trackCall[1].fromEntity).toBe("cron");
    expect(trackCall[1].toAgent).toBe("may");
    expect(trackCall[1].artifact).toBe("hb-may");

    // Should have been updated to COMPLETED
    const updateCalls = mockUpdateRequest.mock.calls;
    const completedUpdate = updateCalls.find((c) => c[2].status === "COMPLETED");
    expect(completedUpdate).toBeDefined();

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
    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const failUpdate = mockUpdateRequest.mock.calls.find((c) => c[2].status === "FAILED");
    expect(failUpdate).toBeDefined();
    expect(failUpdate![2].error).toContain("session exploded");
    expect(errors.some((e) => e.includes("session exploded"))).toBe(true);

    c.stop();
  });

  it("heartbeat: cron timer skips if previous heartbeat still running", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "hb-slow", type: "heartbeat", intervalMs: 10000, agent: "bob", message: "hb" }]),
    );
    const mgr = makeMockManager();
    const errors: string[] = [];
    let resolveWait!: () => void;
    mgr.setWaitFor(() => new Promise<void>((r) => { resolveWait = r; }));

    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.start();

    // First fire — starts, hangs on waitFor
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    // Second fire — should skip (request is still IN_PROGRESS)
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    expect(errors.some((e) => e.includes("skipped"))).toBe(true);
    const runCalls = mgr.calls.filter((c) => c.method === "run");
    expect(runCalls).toHaveLength(1);

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
      JSON.stringify([{ name: "eval", type: "job", intervalMs: 30000, message: "evaluate" }]),
    );
    const mgr = makeMockManager();
    let handlerCalled = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("eval", async () => { handlerCalled = true; });
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    expect(handlerCalled).toBe(true);
    expect(mgr.calls.filter((c) => c.method === "run")).toHaveLength(0);

    c.stop();
  });

  it("job-handler: tracks request on success", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "eval", type: "job", intervalMs: 30000, message: "evaluate" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("eval", async () => {});
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    expect(mockTrackRequest).toHaveBeenCalled();
    const trackCall = mockTrackRequest.mock.calls[0];
    expect(trackCall[1].artifact).toBe("eval");
    expect(trackCall[1].fromEntity).toBe("cron");

    const completedUpdate = mockUpdateRequest.mock.calls.find((c) => c[2].status === "COMPLETED");
    expect(completedUpdate).toBeDefined();

    c.stop();
  });

  it("job-handler: records failure on error", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "fail-job", type: "job", intervalMs: 30000, message: "fail" }]),
    );
    const mgr = makeMockManager();
    const errors: string[] = [];
    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.registerHandler("fail-job", async () => { throw new Error("handler broke"); });
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const failUpdate = mockUpdateRequest.mock.calls.find((c) => c[2].status === "FAILED");
    expect(failUpdate).toBeDefined();
    expect(failUpdate![2].error).toContain("handler broke");
    expect(errors.some((e) => e.includes("handler broke"))).toBe(true);

    c.stop();
  });

  it("job-handler: cron timer skips if previous handler still running", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "slow", type: "job", intervalMs: 10000, message: "slow" }]),
    );
    const mgr = makeMockManager();
    const errors: string[] = [];
    let resolveHandler!: () => void;
    let callCount = 0;

    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.registerHandler("slow", () => {
      callCount++;
      return new Promise<void>((r) => { resolveHandler = r; });
    });
    c.start();

    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    expect(callCount).toBe(1);
    expect(errors.some((e) => e.includes("skipped"))).toBe(true);

    resolveHandler();
    await flush();
    c.stop();
  });

  // ── Job-detached mode ───────────────────────────────────────────────

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

  it("job-detached: tracks request on spawn", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "analyze", intervalMs: 60000, agent: "bob", message: "do analysis" }]),
    );
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    await vi.advanceTimersByTimeAsync(60000);
    await flush();

    expect(mockTrackRequest).toHaveBeenCalled();
    const trackCall = mockTrackRequest.mock.calls[0];
    expect(trackCall[1].artifact).toBe("analyze");
    expect(trackCall[1].fromEntity).toBe("cron");
    expect(trackCall[1].toAgent).toBe("bob");
    const ctx = JSON.parse(trackCall[1].context);
    expect(ctx.type).toBe("detached");
    expect(ctx.pid).toBe(99999);

    c.stop();
  });

  it("job-detached: records failure when spawn throws", async () => {
    mockSpawn.mockImplementation(() => { throw new Error("spawn failed"); });
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "fail-spawn", intervalMs: 60000, agent: "bob", message: "boom" }]),
    );
    const mgr = makeMockManager();
    const errors: string[] = [];
    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.start();

    await vi.advanceTimersByTimeAsync(60000);
    await flush();

    const failUpdate = mockUpdateRequest.mock.calls.find((c) => c[2].status === "FAILED");
    expect(failUpdate).toBeDefined();
    expect(failUpdate![2].error).toContain("spawn failed");

    c.stop();
  });

  // ── Mode resolution ─────────────────────────────────────────────────

  it("entry with handler but no type: resolves as job-handler", async () => {
    writeFileSync(configPath, JSON.stringify([{ name: "js-job", intervalMs: 30000, message: "run handler" }]));
    const mgr = makeMockManager();
    let handlerCalled = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("js-job", async () => { handlerCalled = true; });
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
    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.start();

    vi.advanceTimersByTime(30000);
    expect(errors.some((e) => e.includes("no handler and no agent"))).toBe(true);

    c.stop();
  });

  // ── onFire callback ─────────────────────────────────────────────────

  it("onFire called with correct type for each mode", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([
        { name: "hb", type: "heartbeat", intervalMs: 30000, agent: "bob", message: "heartbeat" },
        { name: "js", type: "job", intervalMs: 30000, message: "js job" },
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
      JSON.stringify([{ name: "trigger-me", type: "job", intervalMs: 300000, message: "go" }]),
    );
    const mgr = makeMockManager();
    let called = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("trigger-me", async () => { called = true; });
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
      JSON.stringify([{ name: "debounced", type: "job", intervalMs: 300000, message: "go" }]),
    );
    const mgr = makeMockManager();
    let callCount = 0;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("debounced", async () => { callCount++; });
    c.start();

    expect(c.triggerNow("debounced")).toBe(true);
    // Second trigger within cooldown — debounced
    expect(c.triggerNow("debounced")).toBe(false);

    c.stop();
  });

  it("triggerNow: force bypasses debounce", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "force-test", type: "job", intervalMs: 300000, message: "go" }]),
    );
    const mgr = makeMockManager();
    let callCount = 0;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("force-test", async () => { callCount++; });
    c.start();

    expect(c.triggerNow("force-test")).toBe(true);
    await flush();
    expect(callCount).toBe(1);

    // Debounced
    expect(c.triggerNow("force-test")).toBe(false);

    // Force bypasses
    expect(c.triggerNow("force-test", { force: true })).toBe(true);
    await flush();
    expect(callCount).toBe(2);

    c.stop();
  });

  it("triggerNow: always fires even if job is already running (no overlap check for manual)", async () => {
    writeFileSync(
      configPath,
      JSON.stringify([{ name: "hb-manual", type: "heartbeat", intervalMs: 300000, agent: "bob", message: "hb" }]),
    );
    const mgr = makeMockManager();
    let resolveWait!: () => void;
    mgr.setWaitFor(() => new Promise<void>((r) => { resolveWait = r; }));

    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    // First trigger
    expect(c.triggerNow("hb-manual")).toBe(true);
    await flush();

    // Advance past cooldown
    vi.advanceTimersByTime(150001);

    // Second trigger while first still running — should still fire (manual = no overlap check)
    expect(c.triggerNow("hb-manual")).toBe(true);
    const runCalls = mgr.calls.filter((c) => c.method === "run");
    expect(runCalls).toHaveLength(2);

    resolveWait();
    await flush();
    c.stop();
  });

  it("triggerNow: uses per-entry cooldown (half of intervalMs, min 60s)", () => {
    writeFileSync(
      configPath,
      JSON.stringify([
        { name: "short", type: "job", intervalMs: 60000, message: "go" },
        { name: "long", type: "job", intervalMs: 600000, message: "go" },
      ]),
    );
    const mgr = makeMockManager();
    let shortCount = 0;
    let longCount = 0;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("short", async () => { shortCount++; });
    c.registerHandler("long", async () => { longCount++; });
    c.start();

    expect(c.triggerNow("short")).toBe(true);
    expect(c.triggerNow("long")).toBe(true);

    // Advance 31s — still within both cooldowns
    vi.advanceTimersByTime(31_000);
    expect(c.triggerNow("short")).toBe(false);
    expect(c.triggerNow("long")).toBe(false);

    // Advance to 61s total — short cooldown (60s) met, long (300s) not
    vi.advanceTimersByTime(30_000);
    expect(c.triggerNow("short")).toBe(true);
    expect(c.triggerNow("long")).toBe(false);

    c.stop();
  });
});
