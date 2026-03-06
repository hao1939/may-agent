import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { runSystemStatus, formatStatusReport } from "../run/system-status.js";
import { Cron } from "../run/cron.js";

describe("system-status (LLM-to-JS #3)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "sys-status-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("runSystemStatus returns structured results", () => {
    const persistDir = join(dir, ".state");
    const agentsRoot = join(dir, "agents");
    mkdirSync(join(persistDir, "sessions"), { recursive: true });
    mkdirSync(join(persistDir, "evaluations"), { recursive: true });
    mkdirSync(join(agentsRoot, "coder", "knowledge"), { recursive: true });
    writeFileSync(join(agentsRoot, "coder", "knowledge", "lessons.md"), "line1\nline2\nline3\n");

    const result = runSystemStatus({
      persistDir,
      projectRoot: dir,
      agentsRoot,
      healthLogPath: join(dir, "health-log.md"),
      skipBuildChecks: true,
    });

    expect(result.sessionsLast24h).toBe(0);
    expect(result.unevaluated.total).toBe(0);
    expect(result.runningSessions).toEqual([]);
    expect(result.lessonLineCounts).toHaveProperty("coder");
    expect(result.lessonLineCounts.coder).toBe(4); // 3 lines + trailing newline
    expect(result.tscResult).toBe("PASS");
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("counts sessions from last 24h", () => {
    const persistDir = join(dir, ".state");
    const agentsRoot = join(dir, "agents");
    mkdirSync(join(persistDir, "sessions", "s_recent_0"), { recursive: true });
    mkdirSync(join(persistDir, "evaluations"), { recursive: true });

    // Create a session meta that started recently
    writeFileSync(
      join(persistDir, "sessions", "s_recent_0", "meta.json"),
      JSON.stringify({ agent: "coder", task: "test", status: "done", startedAt: Date.now() - 3600_000 }),
    );

    const result = runSystemStatus({
      persistDir,
      projectRoot: dir,
      agentsRoot,
      healthLogPath: join(dir, "health-log.md"),
      skipBuildChecks: true,
    });

    expect(result.sessionsLast24h).toBe(1);
  });

  it("detects unevaluated sessions", () => {
    const persistDir = join(dir, ".state");
    const agentsRoot = join(dir, "agents");
    mkdirSync(join(persistDir, "sessions", "s_1_0"), { recursive: true });
    mkdirSync(join(persistDir, "evaluations"), { recursive: true });

    // Session with transcript but no evaluation
    writeFileSync(
      join(persistDir, "sessions", "s_1_0", "meta.json"),
      JSON.stringify({ agent: "coder", task: "test", status: "done", startedAt: Date.now() - 86400_000 }),
    );
    writeFileSync(join(persistDir, "sessions", "s_1_0", "session.jsonl"), '{"role":"user"}\n');

    const result = runSystemStatus({
      persistDir,
      projectRoot: dir,
      agentsRoot,
      healthLogPath: join(dir, "health-log.md"),
      skipBuildChecks: true,
    });

    expect(result.unevaluated.total).toBe(1);
    expect(result.unevaluated.actionable).toBe(1);
    expect(result.unevaluated.autoSkippable).toBe(0);
  });

  it("classifies meta-agent sessions as auto-skippable", () => {
    const persistDir = join(dir, ".state");
    const agentsRoot = join(dir, "agents");
    mkdirSync(join(persistDir, "sessions", "s_1_0"), { recursive: true });
    mkdirSync(join(persistDir, "evaluations"), { recursive: true });

    writeFileSync(
      join(persistDir, "sessions", "s_1_0", "meta.json"),
      JSON.stringify({ agent: "evaluator", task: "eval", status: "done", startedAt: Date.now() - 86400_000 }),
    );

    const result = runSystemStatus({
      persistDir,
      projectRoot: dir,
      agentsRoot,
      healthLogPath: join(dir, "health-log.md"),
      skipBuildChecks: true,
    });

    expect(result.unevaluated.total).toBe(1);
    expect(result.unevaluated.autoSkippable).toBe(1);
    expect(result.unevaluated.actionable).toBe(0);
  });

  it("formatStatusReport produces readable markdown", () => {
    const result = {
      timestamp: "2026-03-05T14:00",
      sessionsLast24h: 12,
      unevaluated: { total: 5, actionable: 3, autoSkippable: 2 },
      runningSessions: ["may (s_1_0)"],
      lessonLineCounts: { coder: 50, qa: 30 },
      analysisAge: "fresh (2h ago)",
      tscResult: "PASS" as const,
      testResult: "914 tests pass",
      anomalies: [],
    };

    const report = formatStatusReport(result);
    expect(report).toContain("2026-03-05T14:00");
    expect(report).toContain("Sessions (24h): 12");
    expect(report).toContain("Unevaluated: 5 total");
    expect(report).toContain("3 actionable");
    expect(report).toContain("may (s_1_0)");
    expect(report).toContain("tsc: PASS");
    expect(report).toContain("914 tests pass");
    expect(report).toContain("coder 50");
    expect(report).toContain("No anomalies");
    expect(report).toContain("JS cron handler");
  });

  it("reports anomalies when present", () => {
    const result = {
      timestamp: "2026-03-05T14:00",
      sessionsLast24h: 0,
      unevaluated: { total: 0, actionable: 0, autoSkippable: 0 },
      runningSessions: [],
      lessonLineCounts: {},
      analysisAge: "missing",
      tscResult: "PASS" as const,
      testResult: null,
      anomalies: ["Bob analysis file missing"],
    };

    const report = formatStatusReport(result);
    expect(report).toContain("⚠️ Bob analysis file missing");
    expect(report).not.toContain("No anomalies");
  });
});

describe("Cron handler registration", () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "cron-handler-"));
    configPath = resolve(dir, "cron.json");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it("calls JS handler instead of followUp when registered", async () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "system-status", intervalMs: 10000, message: "ignored when handler exists" },
    ]));

    const followUpCalls: string[] = [];
    const mgr = { followUp: (_sid: string, msg: string) => { followUpCalls.push(msg); } };
    const handlerCalls: number[] = [];

    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("system-status", async () => { handlerCalls.push(Date.now()); });
    c.load();
    c.start();

    await vi.advanceTimersByTimeAsync(10000);
    expect(handlerCalls).toHaveLength(1);
    expect(followUpCalls).toHaveLength(0); // LLM NOT called

    await vi.advanceTimersByTimeAsync(10000);
    expect(handlerCalls).toHaveLength(2);
    expect(followUpCalls).toHaveLength(0);

    c.stop();
  });

  it("falls back to followUp for jobs without handler", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "system-status", intervalMs: 10000, message: "handled" },
      { name: "health-check", intervalMs: 10000, message: "llm msg" },
    ]));

    const followUpCalls: string[] = [];
    const mgr = { followUp: (_sid: string, msg: string) => { followUpCalls.push(msg); } };

    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.registerHandler("system-status", async () => { /* JS handler */ });
    c.load();
    c.start();

    vi.advanceTimersByTime(10000);
    // Only health-check should have called followUp
    expect(followUpCalls).toHaveLength(1);
    expect(followUpCalls[0]).toBe("llm msg");

    c.stop();
  });

  it("reports handler errors via onError", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "failing", intervalMs: 10000, message: "msg" },
    ]));

    const errors: string[] = [];
    const mgr = { followUp: () => {} };

    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.registerHandler("failing", async () => { throw new Error("handler broke"); });
    c.load();
    c.start();

    vi.advanceTimersByTime(10000);
    // Error is async — need to flush the promise
    return vi.waitFor(() => {
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("handler broke");
    });
  });
});
