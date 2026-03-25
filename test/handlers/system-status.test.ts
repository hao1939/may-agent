/**
 * Tests for runSystemStatus() and formatStatusReport() from system-status handler.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { runSystemStatus, formatStatusReport } from "../../agents/may/handlers/system-status.js";

describe("runSystemStatus", () => {
  let dir: string;
  let persistDir: string;
  let agentsRoot: string;
  let projectRoot: string;

  /** Build a loadAllSessionMetas function that reads session meta.json files from disk. */
  function makeLoadAllSessionMetas(): () => Record<string, any> {
    return () => {
      const sessionsDir = resolve(persistDir, "sessions");
      const result: Record<string, any> = {};
      if (!existsSync(sessionsDir)) return result;
      for (const sid of readdirSync(sessionsDir)) {
        const metaPath = resolve(sessionsDir, sid, "meta.json");
        if (existsSync(metaPath)) {
          result[sid] = JSON.parse(readFileSync(metaPath, "utf-8"));
        }
      }
      return result;
    };
  }

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "sys-status-"));
    persistDir = resolve(dir, ".state");
    agentsRoot = resolve(dir, "agents");
    projectRoot = dir;
    mkdirSync(resolve(persistDir, "sessions"), { recursive: true });
    mkdirSync(resolve(persistDir, "evaluations"), { recursive: true });
    mkdirSync(resolve(agentsRoot, "may", "knowledge"), { recursive: true });
    mkdirSync(resolve(agentsRoot, "bob", "workspace"), { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns baseline result with empty state", () => {
    const result = runSystemStatus({
      persistDir,
      projectRoot,
      agentsRoot,
      healthLogPath: resolve(dir, "health-log.md"),
      skipBuildChecks: true,
      loadAllSessionMetas: makeLoadAllSessionMetas(),
    });

    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(result.sessionsLast24h).toBe(0);
    expect(result.unevaluated.total).toBe(0);
    expect(result.unevaluated.actionable).toBe(0);
    expect(result.runningSessions).toEqual([]);
    expect(result.tscResult).toBe("PASS"); // skipped
  });

  it("counts sessions from last 24h", () => {
    // Create a session dir with a recent meta
    const sid = "s_recent_1";
    const sessionDir = resolve(persistDir, "sessions", sid);
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      resolve(sessionDir, "meta.json"),
      JSON.stringify({
        agent: "coder",
        status: "complete",
        startedAt: Date.now() - 3600000, // 1 hour ago
        task: "fix bug",
      }),
    );

    const result = runSystemStatus({
      persistDir,
      projectRoot,
      agentsRoot,
      healthLogPath: resolve(dir, "health-log.md"),
      skipBuildChecks: true,
      loadAllSessionMetas: makeLoadAllSessionMetas(),
    });

    expect(result.sessionsLast24h).toBe(1);
  });

  it("counts unevaluated sessions", () => {
    // Create a completed non-meta-agent session with a transcript
    const sid = "s_uneval_1";
    const sessionDir = resolve(persistDir, "sessions", sid);
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      resolve(sessionDir, "meta.json"),
      JSON.stringify({
        agent: "coder",
        status: "complete",
        startedAt: Date.now() - 7200000,
        task: "implement feature",
        parentSessionId: "parent-1",
      }),
    );
    writeFileSync(resolve(sessionDir, "session.jsonl"), '{"role":"user"}\n');

    const result = runSystemStatus({
      persistDir,
      projectRoot,
      agentsRoot,
      healthLogPath: resolve(dir, "health-log.md"),
      skipBuildChecks: true,
      loadAllSessionMetas: makeLoadAllSessionMetas(),
    });

    expect(result.unevaluated.total).toBe(1);
    expect(result.unevaluated.actionable).toBe(1);
  });

  it("auto-skips meta-agent sessions", () => {
    // evaluator session — should be auto-skippable
    const sid = "s_eval_1";
    const sessionDir = resolve(persistDir, "sessions", sid);
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      resolve(sessionDir, "meta.json"),
      JSON.stringify({
        agent: "evaluator",
        status: "complete",
        startedAt: Date.now() - 7200000,
        task: "evaluate",
        parentSessionId: "parent-1",
      }),
    );
    writeFileSync(resolve(sessionDir, "session.jsonl"), '{"role":"user"}\n');

    const result = runSystemStatus({
      persistDir,
      projectRoot,
      agentsRoot,
      healthLogPath: resolve(dir, "health-log.md"),
      skipBuildChecks: true,
      loadAllSessionMetas: makeLoadAllSessionMetas(),
    });

    expect(result.unevaluated.autoSkippable).toBe(1);
    expect(result.unevaluated.actionable).toBe(0);
  });

  it("counts lesson lines per agent", () => {
    writeFileSync(resolve(agentsRoot, "may", "knowledge", "lessons.md"), "Line 1\nLine 2\nLine 3\n");

    const result = runSystemStatus({
      persistDir,
      projectRoot,
      agentsRoot,
      healthLogPath: resolve(dir, "health-log.md"),
      skipBuildChecks: true,
      loadAllSessionMetas: makeLoadAllSessionMetas(),
    });

    expect(result.lessonLineCounts["may"]).toBe(4); // 3 lines + trailing newline split
  });

  it("detects missing Bob analysis as anomaly", () => {
    // Don't create analysis.md — should be flagged
    const result = runSystemStatus({
      persistDir,
      projectRoot,
      agentsRoot,
      healthLogPath: resolve(dir, "health-log.md"),
      skipBuildChecks: true,
      loadAllSessionMetas: makeLoadAllSessionMetas(),
    });

    expect(result.analysisAge).toBe("missing");
    expect(result.anomalies.some((a) => a.includes("Bob analysis"))).toBe(true);
  });

  it("detects stale running sessions as anomalies", () => {
    const sid = "s_stale_1";
    const sessionDir = resolve(persistDir, "sessions", sid);
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      resolve(sessionDir, "meta.json"),
      JSON.stringify({
        agent: "coder",
        status: "running",
        startedAt: Date.now() - 45 * 60 * 1000, // 45 min — over 30 min threshold
        task: "stuck task",
      }),
    );

    const result = runSystemStatus({
      persistDir,
      projectRoot,
      agentsRoot,
      healthLogPath: resolve(dir, "health-log.md"),
      skipBuildChecks: true,
      loadAllSessionMetas: makeLoadAllSessionMetas(),
    });

    expect(result.anomalies.some((a) => a.includes("may be stuck"))).toBe(true);
  });

  it("does not flag may sessions as stale", () => {
    const sid = "s_may_long_1";
    const sessionDir = resolve(persistDir, "sessions", sid);
    mkdirSync(sessionDir, { recursive: true });
    writeFileSync(
      resolve(sessionDir, "meta.json"),
      JSON.stringify({
        agent: "may",
        status: "running",
        startedAt: Date.now() - 120 * 60 * 1000, // 2 hours
        task: "main session",
        autoClose: "never",
      }),
    );

    const result = runSystemStatus({
      persistDir,
      projectRoot,
      agentsRoot,
      healthLogPath: resolve(dir, "health-log.md"),
      skipBuildChecks: true,
      loadAllSessionMetas: makeLoadAllSessionMetas(),
    });

    expect(result.anomalies.filter((a) => a.includes("may be stuck"))).toHaveLength(0);
  });
});

describe("formatStatusReport", () => {
  it("produces markdown with timestamp header", () => {
    const report = formatStatusReport({
      timestamp: "2026-03-05T14:00",
      sessionsLast24h: 5,
      unevaluated: { total: 2, actionable: 1, autoSkippable: 1 },
      runningSessions: ["bob (s_1)"],
      lessonLineCounts: { may: 10, bob: 20 },
      analysisAge: "fresh (2h ago)",
      tscResult: "PASS",
      testResult: "42 tests pass",
      anomalies: [],
    });

    expect(report).toContain("## 2026-03-05T14:00");
    expect(report).toContain("Sessions (24h): 5");
    expect(report).toContain("Unevaluated: 2 total, 1 actionable");
    expect(report).toContain("bob (s_1)");
    expect(report).toContain("tsc: PASS");
    expect(report).toContain("Tests: 42 tests pass");
    expect(report).toContain("Lessons: 30 lines total");
    expect(report).toContain("No anomalies");
  });

  it("formats anomalies with warning prefix", () => {
    const report = formatStatusReport({
      timestamp: "2026-03-05T14:00",
      sessionsLast24h: 0,
      unevaluated: { total: 0, actionable: 0, autoSkippable: 0 },
      runningSessions: [],
      lessonLineCounts: {},
      analysisAge: null,
      tscResult: "PASS",
      testResult: null,
      anomalies: ["tsc failed", "Bob analysis missing"],
    });

    expect(report).toContain("⚠️ tsc failed");
    expect(report).toContain("⚠️ Bob analysis missing");
    expect(report).not.toContain("No anomalies");
  });

  it("reports zero unevaluated as all caught up", () => {
    const report = formatStatusReport({
      timestamp: "2026-03-05T14:00",
      sessionsLast24h: 0,
      unevaluated: { total: 0, actionable: 0, autoSkippable: 0 },
      runningSessions: [],
      lessonLineCounts: {},
      analysisAge: null,
      tscResult: "PASS",
      testResult: null,
      anomalies: [],
    });

    expect(report).toContain("Unevaluated: 0 — all caught up");
  });
});
