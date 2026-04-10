import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { extractErrorCodes, parseIssueToErrorEntry, appendErrorLogs } from "../src/lib/evaluator.js";
import type { TaskEvaluationResult, ChildSessionInfo } from "../src/lib/evaluator.js";

// ── extractErrorCodes ──────────────────────────────────────────────────

describe("extractErrorCodes", () => {
  it("extracts single FM code", () => {
    expect(extractErrorCodes("[FM-2.6 / FC-1.1][DRIFT] Agent drifted")).toEqual(["FM-2.6"]);
  });

  it("extracts multiple FM codes", () => {
    expect(extractErrorCodes("[FM-1.3][LOOP] and also FM-2.6 reasoning issue")).toEqual(["FM-1.3", "FM-2.6"]);
  });

  it("returns empty array for no FM codes", () => {
    expect(extractErrorCodes("evaluator did not score this agent")).toEqual([]);
  });

  it("handles FC codes without FM codes", () => {
    expect(extractErrorCodes("[FC-1.1][MINOR] Something")).toEqual([]);
  });

  it("extracts FM code from complex issue string", () => {
    const issue =
      "[FM-3.1 / FC-1.1][FAILED_EDIT_NO_RECOVERY] Optimizer issued an `edit()` against `agents/evaluator/skills/monitor-session.cjs` that produced identical content";
    expect(extractErrorCodes(issue)).toEqual(["FM-3.1"]);
  });
});

// ── parseIssueToErrorEntry ─────────────────────────────────────────────

describe("parseIssueToErrorEntry", () => {
  it("parses issue with FM code into error entry", () => {
    const issue = "[FM-2.6 / FC-1.1][REASONING_ACTION_MISMATCH] Agent's task doesn't match actions";
    const entries = parseIssueToErrorEntry(issue, "s_12345", "2026-03-13");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      date: "2026-03-13",
      task_id: "s_12345",
      error_code: "FM-2.6",
      trigger: "REASONING_ACTION_MISMATCH",
      critique: "Agent's task doesn't match actions",
      correction: "",
    });
  });

  it("returns empty for issue without FM code", () => {
    const entries = parseIssueToErrorEntry("evaluator did not score this agent", "s_12345", "2026-03-13");
    expect(entries).toEqual([]);
  });

  it("handles multiple FM codes in one issue", () => {
    const issue = "[FM-1.3][LOOP] Repeated steps, also FM-2.6 drift detected";
    const entries = parseIssueToErrorEntry(issue, "s_99999", "2026-03-14");
    expect(entries).toHaveLength(2);
    expect(entries[0].error_code).toBe("FM-1.3");
    expect(entries[1].error_code).toBe("FM-2.6");
  });
});

// ── appendErrorLogs (integration) ──────────────────────────────────────

describe("appendErrorLogs", () => {
  const testAgentDir = join("agents", "_test_error_log_agent");
  const errorLogPath = join(testAgentDir, "ERROR_LOG.jsonl");

  beforeEach(() => {
    mkdirSync(testAgentDir, { recursive: true });
    // Clean up any previous test artifacts
    if (existsSync(errorLogPath)) rmSync(errorLogPath);
  });

  afterEach(() => {
    if (existsSync(errorLogPath)) rmSync(errorLogPath);
    if (existsSync(testAgentDir)) rmSync(testAgentDir, { recursive: true });
  });

  it("writes JSONL entries for issues with FM codes", () => {
    const result: TaskEvaluationResult = {
      agents: {
        s_test_001: {
          agent: "_test_error_log_agent",
          sessionId: "s_test_001",
          efficiency: 3,
          quality: 2,
          productive_calls: 5,
          wasted_calls: 3,
          verdict: "needs_improvement",
          issues: [
            "[FM-2.6 / FC-1.1][DRIFT] Agent drifted from task",
            "[FM-1.3][LOOP] Agent looped on same command 5 times",
          ],
        },
      },
      overall: {
        efficiency: 3,
        quality: 2,
        verdict: "needs_improvement",
        result_delivered: false,
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        cost: 0,
        turns: 0,
      },
      lessons: null,
      failureChains: {},
      sessionIds: ["s_test_001"],
      raw: "",
    };

    const children: ChildSessionInfo[] = [
      {
        sessionId: "s_test_001",
        agent: "_test_error_log_agent",
        task: "test task",
        status: "done",
        messages: [],
      },
    ];

    appendErrorLogs(result, children);

    expect(existsSync(errorLogPath)).toBe(true);
    const content = readFileSync(errorLogPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const entry1 = JSON.parse(lines[0]);
    expect(entry1.tool).toBe("evaluator");
    expect(entry1.context).toBe("s_test_001");
    expect(entry1.error).toContain("FM-2.6");
    expect(entry1.critique).toBe("Agent drifted from task");
    expect(entry1).toHaveProperty("timestamp");
    expect(entry1).toHaveProperty("state_snapshot");

    const entry2 = JSON.parse(lines[1]);
    expect(entry2.error).toContain("FM-1.3");
    expect(entry2.critique).toBe("Agent looped on same command 5 times");
    expect(entry2.context).toBe("s_test_001");
    expect(entry2).toHaveProperty("state_snapshot");
  });

  it("skips issues without FM codes", () => {
    const result: TaskEvaluationResult = {
      agents: {
        s_test_002: {
          agent: "_test_error_log_agent",
          sessionId: "s_test_002",
          efficiency: 5,
          quality: 5,
          productive_calls: 10,
          wasted_calls: 0,
          verdict: "good",
          issues: ["evaluator did not score this agent"],
        },
      },
      overall: {
        efficiency: 5,
        quality: 5,
        verdict: "good",
        result_delivered: true,
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        cost: 0,
        turns: 0,
      },
      lessons: null,
      failureChains: {},
      sessionIds: ["s_test_002"],
      raw: "",
    };

    const children: ChildSessionInfo[] = [
      {
        sessionId: "s_test_002",
        agent: "_test_error_log_agent",
        task: "test task",
        status: "done",
        messages: [],
      },
    ];

    appendErrorLogs(result, children);

    // No FM codes → no file written
    expect(existsSync(errorLogPath)).toBe(false);
  });

  it("appends to existing error log", () => {
    // Write an initial entry
    const initialEntry = JSON.stringify({
      timestamp: "2026-03-12T00:00:00Z",
      tool: "evaluator",
      error: "FM-4.1: OLD_ISSUE",
      critique: "Previous failure",
      correction: "Fix it",
      context: "s_old",
    });
    mkdirSync(testAgentDir, { recursive: true });
    require("node:fs").writeFileSync(errorLogPath, initialEntry + "\n", "utf-8");

    const result: TaskEvaluationResult = {
      agents: {
        s_test_003: {
          agent: "_test_error_log_agent",
          sessionId: "s_test_003",
          efficiency: 2,
          quality: 2,
          productive_calls: 3,
          wasted_calls: 5,
          verdict: "needs_improvement",
          issues: ["[FM-3.3 / FC-2.1][INCORRECT_VERIFICATION] Declared success without evidence"],
        },
      },
      overall: {
        efficiency: 2,
        quality: 2,
        verdict: "needs_improvement",
        result_delivered: false,
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        cost: 0,
        turns: 0,
      },
      lessons: null,
      failureChains: {},
      sessionIds: ["s_test_003"],
      raw: "",
    };

    const children: ChildSessionInfo[] = [
      {
        sessionId: "s_test_003",
        agent: "_test_error_log_agent",
        task: "test task",
        status: "done",
        messages: [],
      },
    ];

    appendErrorLogs(result, children);

    const content = readFileSync(errorLogPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    // First line is the initial entry
    const old = JSON.parse(lines[0]);
    expect(old.error).toContain("FM-4.1");

    // Second line is the new entry
    const newEntry = JSON.parse(lines[1]);
    expect(newEntry.error).toContain("FM-3.3");
    expect(newEntry.context).toBe("s_test_003");
    expect(newEntry.critique).toBe("Declared success without evidence");
  });

  it("produces valid JSONL (each line is parseable JSON)", () => {
    const result: TaskEvaluationResult = {
      agents: {
        s_test_004: {
          agent: "_test_error_log_agent",
          sessionId: "s_test_004",
          efficiency: 1,
          quality: 1,
          productive_calls: 1,
          wasted_calls: 8,
          verdict: "needs_improvement",
          issues: [
            "[FM-2.2 / FC-1.1][CONSTRAINT_MISMATCH] Brief explicitly instructed updating `agents/evaluator/SOUL.md`, but optimizer attempted it and hit a hard P53 boundary.",
            "[FM-3.1 / FC-1.1][FAILED_EDIT_NO_RECOVERY] Edit produced identical content",
            "[FM-2.5 / FC-2.1][UNNECESSARY_TOOL_CALL] Called agents({}) with missing params",
          ],
        },
      },
      overall: {
        efficiency: 1,
        quality: 1,
        verdict: "needs_improvement",
        result_delivered: false,
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        cost: 0,
        turns: 0,
      },
      lessons: null,
      failureChains: {},
      sessionIds: ["s_test_004"],
      raw: "",
    };

    const children: ChildSessionInfo[] = [
      {
        sessionId: "s_test_004",
        agent: "_test_error_log_agent",
        task: "test task",
        status: "done",
        messages: [],
      },
    ];

    appendErrorLogs(result, children);

    const content = readFileSync(errorLogPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(3);

    // Each line must be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
      const entry = JSON.parse(line);
      expect(entry).toHaveProperty("timestamp");
      expect(entry).toHaveProperty("tool");
      expect(entry).toHaveProperty("error");
      expect(entry).toHaveProperty("critique");
      expect(entry).toHaveProperty("correction");
      expect(entry).toHaveProperty("context");
      expect(entry).toHaveProperty("state_snapshot");
    }
  });
});
