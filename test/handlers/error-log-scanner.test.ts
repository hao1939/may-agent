import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanErrorLogs } from "../../agents/may/handlers/error-log-scanner.js";

describe("error-log-scanner — scanErrorLogs", () => {
  let agentsRoot: string;

  beforeEach(() => {
    agentsRoot = mkdtempSync(join(tmpdir(), "error-log-scanner-test-"));
  });

  afterEach(() => {
    rmSync(agentsRoot, { recursive: true, force: true });
  });

  it("returns empty when no agents have ERROR_LOG.jsonl", () => {
    mkdirSync(join(agentsRoot, "alice"));
    const result = scanErrorLogs({ agentsRoot, threshold: 3, lookbackMs: 7 * 24 * 60 * 60 * 1000 });
    expect(result.agentsScanned).toBe(0);
    expect(result.triggered).toEqual([]);
  });

  it("returns empty when errors are below threshold", () => {
    const agentDir = join(agentsRoot, "bob");
    mkdirSync(agentDir);
    const now = new Date().toISOString();
    const lines = [
      JSON.stringify({ timestamp: now, error: "FM-2.5: TOOL_SCHEMA_ERROR", tool: "evaluator" }),
      JSON.stringify({ timestamp: now, error: "FM-2.5: TOOL_SCHEMA_ERROR", tool: "evaluator" }),
    ];
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), lines.join("\n"));

    const result = scanErrorLogs({ agentsRoot, threshold: 3, lookbackMs: 7 * 24 * 60 * 60 * 1000 });
    expect(result.agentsScanned).toBe(1);
    expect(result.triggered).toEqual([]);
  });

  it("triggers when errors meet threshold", () => {
    const agentDir = join(agentsRoot, "bob");
    mkdirSync(agentDir);
    const now = new Date().toISOString();
    const lines = [
      JSON.stringify({ timestamp: now, error: "FM-2.5: TOOL_SCHEMA_ERROR", tool: "evaluator" }),
      JSON.stringify({ timestamp: now, error: "FM-2.5: TOOL_SCHEMA_ERROR", tool: "evaluator" }),
      JSON.stringify({ timestamp: now, error: "FM-2.5: TOOL_SCHEMA_ERROR", tool: "evaluator" }),
    ];
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), lines.join("\n"));

    const result = scanErrorLogs({ agentsRoot, threshold: 3, lookbackMs: 7 * 24 * 60 * 60 * 1000 });
    expect(result.agentsScanned).toBe(1);
    expect(result.triggered).toHaveLength(1);
    expect(result.triggered[0]).toEqual({
      agent: "bob",
      errorType: "FM-2.5",
      count: 3,
    });
  });

  it("ignores errors older than lookback window", () => {
    const agentDir = join(agentsRoot, "bob");
    mkdirSync(agentDir);
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    const lines = [
      JSON.stringify({ timestamp: oldDate, error: "FM-2.5: TOOL_SCHEMA_ERROR", tool: "evaluator" }),
      JSON.stringify({ timestamp: oldDate, error: "FM-2.5: TOOL_SCHEMA_ERROR", tool: "evaluator" }),
      JSON.stringify({ timestamp: oldDate, error: "FM-2.5: TOOL_SCHEMA_ERROR", tool: "evaluator" }),
    ];
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), lines.join("\n"));

    const result = scanErrorLogs({ agentsRoot, threshold: 3, lookbackMs: 7 * 24 * 60 * 60 * 1000 });
    expect(result.agentsScanned).toBe(1);
    expect(result.triggered).toEqual([]);
  });

  it("normalizes FM-X.X error codes from longer strings", () => {
    const agentDir = join(agentsRoot, "tech-lead");
    mkdirSync(agentDir);
    const now = new Date().toISOString();
    const lines = [
      JSON.stringify({ timestamp: now, error: "FM-1.1: PATH_CONFUSION some extra text" }),
      JSON.stringify({ timestamp: now, error: "FM-1.1: [FM-1.1 / FC-1.1] Path confusion / wrong file" }),
      JSON.stringify({ timestamp: now, error: "FM-1.1: ENV_MISLOCATION" }),
    ];
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), lines.join("\n"));

    const result = scanErrorLogs({ agentsRoot, threshold: 3, lookbackMs: 7 * 24 * 60 * 60 * 1000 });
    expect(result.triggered).toHaveLength(1);
    expect(result.triggered[0].errorType).toBe("FM-1.1");
    expect(result.triggered[0].count).toBe(3);
  });

  it("triggers for multiple agents and error types", () => {
    const now = new Date().toISOString();

    // Agent A: 4 FM-2.5 errors
    const dirA = join(agentsRoot, "alice");
    mkdirSync(dirA);
    writeFileSync(
      join(dirA, "ERROR_LOG.jsonl"),
      Array(4).fill(JSON.stringify({ timestamp: now, error: "FM-2.5: SCHEMA" })).join("\n"),
    );

    // Agent B: 3 FM-1.1 + 2 FM-3.3 (only FM-1.1 triggers)
    const dirB = join(agentsRoot, "bob");
    mkdirSync(dirB);
    const bLines = [
      ...Array(3).fill(JSON.stringify({ timestamp: now, error: "FM-1.1: PATH" })),
      ...Array(2).fill(JSON.stringify({ timestamp: now, error: "FM-3.3: VERIFY" })),
    ];
    writeFileSync(join(dirB, "ERROR_LOG.jsonl"), bLines.join("\n"));

    const result = scanErrorLogs({ agentsRoot, threshold: 3, lookbackMs: 7 * 24 * 60 * 60 * 1000 });
    expect(result.agentsScanned).toBe(2);
    expect(result.triggered).toHaveLength(2);
    // Sorted by count descending
    expect(result.triggered[0]).toEqual({ agent: "alice", errorType: "FM-2.5", count: 4 });
    expect(result.triggered[1]).toEqual({ agent: "bob", errorType: "FM-1.1", count: 3 });
  });

  it("skips .lab and shared directories", () => {
    mkdirSync(join(agentsRoot, ".lab"));
    mkdirSync(join(agentsRoot, "shared"));
    const now = new Date().toISOString();
    writeFileSync(
      join(agentsRoot, ".lab", "ERROR_LOG.jsonl"),
      Array(5).fill(JSON.stringify({ timestamp: now, error: "FM-2.5: SCHEMA" })).join("\n"),
    );

    const result = scanErrorLogs({ agentsRoot, threshold: 3, lookbackMs: 7 * 24 * 60 * 60 * 1000 });
    expect(result.agentsScanned).toBe(0);
    expect(result.triggered).toEqual([]);
  });

  it("handles malformed JSON lines gracefully", () => {
    const agentDir = join(agentsRoot, "bob");
    mkdirSync(agentDir);
    const now = new Date().toISOString();
    const lines = [
      "not json at all",
      "{ broken json",
      JSON.stringify({ timestamp: now, error: "FM-2.5: SCHEMA" }),
      JSON.stringify({ timestamp: now, error: "FM-2.5: SCHEMA" }),
      JSON.stringify({ timestamp: now, error: "FM-2.5: SCHEMA" }),
    ];
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), lines.join("\n"));

    const result = scanErrorLogs({ agentsRoot, threshold: 3, lookbackMs: 7 * 24 * 60 * 60 * 1000 });
    expect(result.triggered).toHaveLength(1);
    expect(result.triggered[0].count).toBe(3);
  });

  it("excludes agents listed in excludeAgents", () => {
    const now = new Date().toISOString();
    // Coach has errors above threshold but is excluded
    const coachDir = join(agentsRoot, "coach");
    mkdirSync(coachDir);
    writeFileSync(
      join(coachDir, "ERROR_LOG.jsonl"),
      Array(5).fill(JSON.stringify({ timestamp: now, error: "FM-2.1: TOOL" })).join("\n"),
    );
    // Bob has errors and is NOT excluded
    const bobDir = join(agentsRoot, "bob");
    mkdirSync(bobDir);
    writeFileSync(
      join(bobDir, "ERROR_LOG.jsonl"),
      Array(3).fill(JSON.stringify({ timestamp: now, error: "FM-2.5: SCHEMA" })).join("\n"),
    );

    const result = scanErrorLogs({
      agentsRoot,
      threshold: 3,
      lookbackMs: 7 * 24 * 60 * 60 * 1000,
      excludeAgents: ["coach"],
    });
    expect(result.agentsScanned).toBe(1); // Only bob scanned
    expect(result.triggered).toHaveLength(1);
    expect(result.triggered[0].agent).toBe("bob");
  });

  it("skips entries without timestamp", () => {
    const agentDir = join(agentsRoot, "bob");
    mkdirSync(agentDir);
    const lines = [
      JSON.stringify({ error: "FM-2.5: SCHEMA" }),
      JSON.stringify({ error: "FM-2.5: SCHEMA" }),
      JSON.stringify({ error: "FM-2.5: SCHEMA" }),
    ];
    writeFileSync(join(agentDir, "ERROR_LOG.jsonl"), lines.join("\n"));

    const result = scanErrorLogs({ agentsRoot, threshold: 3, lookbackMs: 7 * 24 * 60 * 60 * 1000 });
    expect(result.triggered).toEqual([]);
  });
});
