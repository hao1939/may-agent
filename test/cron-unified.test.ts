import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { Cron } from "../run/cron.js";
import type { JobResult } from "../src/cron-tool.js";

/**
 * Flush microtask queue so async .then() chains in fireHandler / fireHeartbeat
 * complete. We advance fake timers by 0ms async (which processes pending
 * microtasks) multiple times to cover chained .then()s.
 */
const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
};

/** Minimal mock of SubagentManager with the APIs Cron actually calls. */
function makeMockManager() {
  const calls: Array<{ method: string; args: any[] }> = [];
  let sessionCounter = 0;
  const activeSessions = new Map<string, { sessionId: string; status: string }>();

  return {
    calls,
    activeSessions,

    followUp(sessionId: string, message: string, source?: string) {
      calls.push({ method: "followUp", args: [sessionId, message, source] });
    },

    run(agentName: string, task: string, opts?: any): string {
      const sid = `mock-sid-${++sessionCounter}`;
      calls.push({ method: "run", args: [agentName, task, opts] });
      activeSessions.set(sid, { sessionId: sid, status: "running" });
      return sid;
    },

    status() {
      return Array.from(activeSessions.values());
    },

    async waitForIdle(_sessionId: string): Promise<void> {
      return Promise.resolve();
    },

    hasAgent(_name: string) { return true; },
    agentNames() { return ["may", "bob", "optimizer"]; },
  };
}

describe("Cron — unified design", () => {
  let dir: string;
  let configPath: string;
  /** Points to where Cron actually writes job-history.jsonl (projectRoot/.state). */
  let stateDir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "cron-unified-"));
    configPath = resolve(dir, "agents", "may", "cron.json");
    // Cron derives projectRoot = resolve(dirname(configPath), "..") = dir/agents
    // so persistDir = dir/agents/.state
    stateDir = resolve(dir, "agents", ".state");
    mkdirSync(resolve(dir, "agents", "may"), { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  // ── Backward compatibility ──────────────────────────────────────────

  it("legacy entries without type: followUp into main session", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "ping", intervalMs: 30000, message: "hello" },
    ]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    vi.advanceTimersByTime(30000);
    expect(mgr.calls).toHaveLength(1);
    expect(mgr.calls[0].method).toBe("followUp");
    expect(mgr.calls[0].args).toEqual(["sid-1", "hello", "cron"]);

    c.stop();
  });

  it("legacy entries with agent but no handler: skipped with error", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "analyze", intervalMs: 60000, agent: "bob", message: "do analysis" },
    ]));
    const mgr = makeMockManager();
    const errors: string[] = [];
    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.start();

    vi.advanceTimersByTime(60000);
    c.stop();
    // Entry should be rejected at startup, no calls at all
    expect(mgr.calls).toHaveLength(0);
    expect(errors.some(e => e.includes("no registered handler"))).toBe(true);
  });

  it("legacy entries with registered handler: run JS handler", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "js-job", intervalMs: 30000, message: "run handler" },
    ]));
    const mgr = makeMockManager();
    let handlerCalled = false;
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("js-job", async () => { handlerCalled = true; });
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    expect(handlerCalled).toBe(true);
    // Should NOT have called followUp (handler takes priority)
    expect(mgr.calls.filter(c => c.method === "followUp")).toHaveLength(0);

    c.stop();
  });

  // ── Heartbeat type ──────────────────────────────────────────────────

  it("heartbeat type: creates persistent session on first fire", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "hb-bob", type: "heartbeat", intervalMs: 30000, agent: "bob", message: "wake up" },
    ]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const runCalls = mgr.calls.filter(c => c.method === "run");
    expect(runCalls).toHaveLength(1);
    expect(runCalls[0].args[0]).toBe("bob");
    expect(runCalls[0].args[1]).toBe("wake up");
    expect(runCalls[0].args[2]).toEqual({ persistent: true, compaction: { threshold: 0.6, keepRatio: 0.3 } });

    c.stop();
  });

  it("heartbeat type: uses followUp on subsequent fires", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "hb-bob", type: "heartbeat", intervalMs: 30000, agent: "bob", message: "wake up" },
    ]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.start();

    // First fire: creates session
    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    // Second fire: should followUp
    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const followUpCalls = mgr.calls.filter(c => c.method === "followUp");
    expect(followUpCalls).toHaveLength(1);
    expect(followUpCalls[0].args[1]).toBe("wake up");
    expect(followUpCalls[0].args[2]).toBe("cron");

    c.stop();
  });

  // ── Job with handler ────────────────────────────────────────────────

  it("job type with handler: runs JS handler and records result", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "eval", type: "job", intervalMs: 30000, message: "evaluate", handler: "eval" },
    ]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("eval", async () => { /* success */ });
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

  it("job type with handler: records failure on error", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "fail-job", type: "job", intervalMs: 30000, message: "fail", handler: "fail-job" },
    ]));
    const mgr = makeMockManager();
    const errors: string[] = [];
    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.registerHandler("fail-job", async () => { throw new Error("handler broke"); });
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    const historyPath = resolve(stateDir, "job-history.jsonl");
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    const result: JobResult = JSON.parse(lines[0]);
    expect(result.status).toBe("failure");
    expect(result.error).toContain("handler broke");
    expect(errors.some(e => e.includes("handler broke"))).toBe(true);

    c.stop();
  });

  // ── Skip policy ─────────────────────────────────────────────────────

  it("handler skip: doesn't fire if previous handler still running", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "slow-handler", type: "job", intervalMs: 10000, message: "slow", handler: "slow-handler" },
    ]));
    const mgr = makeMockManager();
    const errors: string[] = [];
    let resolveHandler!: () => void;
    let callCount = 0;

    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.registerHandler("slow-handler", () => {
      callCount++;
      return new Promise<void>((r) => { resolveHandler = r; });
    });
    c.start();

    // First fire: starts handler (doesn't complete)
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    // Second fire: should be skipped (handler still running — promise not resolved)
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    expect(callCount).toBe(1);
    expect(errors.some(e => e.includes("skipped"))).toBe(true);

    // Check skip was recorded in history
    const historyPath = resolve(stateDir, "job-history.jsonl");
    expect(existsSync(historyPath)).toBe(true);
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    const skipResult: JobResult = JSON.parse(lines[0]);
    expect(skipResult.status).toBe("skipped");

    // Complete the handler
    resolveHandler();
    await flush();

    c.stop();
  });

  it("heartbeat skip: doesn't fire if previous heartbeat still processing", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "hb-slow", type: "heartbeat", intervalMs: 10000, agent: "bob", message: "hb" },
    ]));
    const mgr = makeMockManager();
    const errors: string[] = [];
    // Make waitForIdle hang
    let resolveIdle!: () => void;
    mgr.waitForIdle = () => new Promise<void>(r => { resolveIdle = r; });

    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.start();

    // First fire
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    // Second fire: should skip
    await vi.advanceTimersByTimeAsync(10000);
    await flush();

    expect(errors.some(e => e.includes("skipped"))).toBe(true);

    // Check skip recorded
    const historyPath = resolve(stateDir, "job-history.jsonl");
    const lines = readFileSync(historyPath, "utf-8").trim().split("\n");
    const skipResult: JobResult = JSON.parse(lines[0]);
    expect(skipResult.status).toBe("skipped");
    expect(skipResult.type).toBe("heartbeat");

    resolveIdle();
    await flush();
    c.stop();
  });

  // ── onFire callback ─────────────────────────────────────────────────

  it("onFire called with correct type for each mode", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "hb", type: "heartbeat", intervalMs: 30000, agent: "bob", message: "heartbeat" },
      { name: "js", type: "job", intervalMs: 30000, message: "js job", handler: "js" },
      { name: "legacy", intervalMs: 30000, message: "legacy followup" },
    ]));
    const mgr = makeMockManager();
    const fires: Array<{ name: string; type: string }> = [];
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("js", async () => {});
    c.onFire((entry, type) => fires.push({ name: entry.name, type }));
    c.start();

    await vi.advanceTimersByTimeAsync(30000);
    await flush();

    expect(fires).toHaveLength(3);
    expect(fires.find(f => f.name === "hb")?.type).toBe("heartbeat");
    expect(fires.find(f => f.name === "js")?.type).toBe("js");
    expect(fires.find(f => f.name === "legacy")?.type).toBe("heartbeat");

    c.stop();
  });

  // ── JobResult history ───────────────────────────────────────────────

  it("appends multiple results to job-history.jsonl", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "multi", type: "job", intervalMs: 10000, message: "run", handler: "multi" },
    ]));
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

  // ── Heartbeat records results ──────────────────────────────────────

  it("heartbeat records success result in job-history", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "hb-may", type: "heartbeat", intervalMs: 30000, agent: "may", message: "heartbeat check" },
    ]));
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

  // ── Mode resolution ────────────────────────────────────────────────

  it("resolves mode correctly for all entry type combinations", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "explicit-hb", type: "heartbeat", intervalMs: 30000, agent: "bob", message: "hb" },
      { name: "explicit-job-h", type: "job", intervalMs: 30000, message: "jh", handler: "explicit-job-h" },
    ]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("explicit-job-h", async () => {});
    c.start();

    vi.advanceTimersByTime(30000);

    // Heartbeat → run() for first fire
    const runCalls = mgr.calls.filter(c => c.method === "run");
    expect(runCalls.length).toBeGreaterThanOrEqual(1);

    // Job with handler → no followUp calls
    const followUpCalls = mgr.calls.filter(c => c.method === "followUp");
    expect(followUpCalls).toHaveLength(0);

    c.stop();
  });
});
