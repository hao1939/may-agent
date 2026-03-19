/**
 * transcript-utils.test.ts — Tests for gym transcript parsing utilities.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadTranscript,
  hasToolCall,
  getToolCalls,
  countToolUsage,
  getToolResult,
  hasToolCallWithArgs,
  hasVerificationAfterWrite,
  getFinishCall,
  countTurns,
  totalOps,
  summarizeToolCalls,
} from "./transcript-utils.js";

// ── Fixtures ───────────────────────────────────────────────────────────

const SAMPLE_TRANSCRIPT_LINES = [
  // User message
  JSON.stringify({
    role: "user",
    content: [{ type: "text", text: "Fix the bug in calc.js" }],
    timestamp: 1000,
  }),
  // Assistant turn 1: reads file
  JSON.stringify({
    role: "assistant",
    content: [
      { type: "text", text: "Let me read the file." },
      {
        type: "toolCall",
        id: "tc_1",
        name: "read",
        arguments: { path: "calc.js" },
      },
    ],
    timestamp: 1001,
    usage: { cost: { total: 0.01 } },
  }),
  // Tool result for read
  JSON.stringify({
    role: "toolResult",
    toolCallId: "tc_1",
    toolName: "read",
    content: [{ type: "text", text: "function add(a, b) { return a - b; }" }],
    isError: false,
    timestamp: 1002,
  }),
  // Assistant turn 2: writes fix
  JSON.stringify({
    role: "assistant",
    content: [
      { type: "text", text: "Found the bug. Fixing now." },
      {
        type: "toolCall",
        id: "tc_2",
        name: "write",
        arguments: {
          path: "calc.js",
          content: "function add(a, b) { return a + b; }",
        },
      },
    ],
    timestamp: 1003,
    usage: { cost: { total: 0.02 } },
  }),
  // Tool result for write
  JSON.stringify({
    role: "toolResult",
    toolCallId: "tc_2",
    toolName: "write",
    content: [{ type: "text", text: "Written successfully" }],
    isError: false,
    timestamp: 1004,
  }),
  // Assistant turn 3: runs tests
  JSON.stringify({
    role: "assistant",
    content: [
      { type: "text", text: "Now let me verify." },
      {
        type: "toolCall",
        id: "tc_3",
        name: "bash",
        arguments: { command: "npm test" },
      },
    ],
    timestamp: 1005,
    usage: { cost: { total: 0.015 } },
  }),
  // Tool result for bash
  JSON.stringify({
    role: "toolResult",
    toolCallId: "tc_3",
    toolName: "bash",
    content: [{ type: "text", text: "All tests pass" }],
    isError: false,
    timestamp: 1006,
  }),
  // Assistant turn 4: reads file again to verify
  JSON.stringify({
    role: "assistant",
    content: [
      { type: "text", text: "Let me verify the file content." },
      {
        type: "toolCall",
        id: "tc_4",
        name: "read",
        arguments: { path: "calc.js" },
      },
      {
        type: "toolCall",
        id: "tc_5",
        name: "finish",
        arguments: {
          status: "success",
          summary: "Fixed the add function",
          deliverables: [{ path: "calc.js", description: "Fixed add function" }],
        },
      },
    ],
    timestamp: 1007,
    usage: { cost: { total: 0.01 } },
  }),
];

// ── Helpers ────────────────────────────────────────────────────────────

let tmpDir: string;

function writeSampleTranscript(lines: string[] = SAMPLE_TRANSCRIPT_LINES): string {
  const filePath = join(tmpDir, "session.jsonl");
  writeFileSync(filePath, lines.join("\n") + "\n");
  return filePath;
}

beforeEach(() => {
  tmpDir = join(tmpdir(), `transcript-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ──────────────────────────────────────────────────────────────

describe("loadTranscript", () => {
  it("returns null for missing file", () => {
    expect(loadTranscript("/nonexistent/path.jsonl")).toBeNull();
  });

  it("parses a valid session JSONL", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    expect(t).not.toBeNull();
    expect(t.entries.length).toBe(SAMPLE_TRANSCRIPT_LINES.length);
    expect(t.toolCalls.length).toBe(5); // read, write, bash, read, finish
    expect(t.toolResults.length).toBe(3); // three toolResult entries
  });

  it("skips malformed lines", () => {
    const lines = [
      "not json",
      SAMPLE_TRANSCRIPT_LINES[0],
      "{bad json",
      SAMPLE_TRANSCRIPT_LINES[1],
    ];
    const t = loadTranscript(writeSampleTranscript(lines))!;
    expect(t.entries.length).toBe(2);
  });

  it("handles empty file", () => {
    const filePath = join(tmpDir, "empty.jsonl");
    writeFileSync(filePath, "");
    const t = loadTranscript(filePath)!;
    expect(t.entries.length).toBe(0);
    expect(t.toolCalls.length).toBe(0);
  });
});

describe("hasToolCall", () => {
  it("returns true for tools that were used", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    expect(hasToolCall(t, "read")).toBe(true);
    expect(hasToolCall(t, "write")).toBe(true);
    expect(hasToolCall(t, "bash")).toBe(true);
    expect(hasToolCall(t, "finish")).toBe(true);
  });

  it("returns false for tools that were not used", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    expect(hasToolCall(t, "agents")).toBe(false);
    expect(hasToolCall(t, "edit")).toBe(false);
  });
});

describe("getToolCalls", () => {
  it("returns all calls for a specific tool", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    const reads = getToolCalls(t, "read");
    expect(reads.length).toBe(2); // read at start + verify read at end
    expect(reads[0].arguments.path).toBe("calc.js");
  });
});

describe("countToolUsage", () => {
  it("counts correctly", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    expect(countToolUsage(t, "read")).toBe(2);
    expect(countToolUsage(t, "write")).toBe(1);
    expect(countToolUsage(t, "bash")).toBe(1);
    expect(countToolUsage(t, "finish")).toBe(1);
    expect(countToolUsage(t, "agents")).toBe(0);
  });
});

describe("getToolResult", () => {
  it("finds result for a tool call", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    const result = getToolResult(t, "tc_1");
    expect(result).toBeDefined();
    expect(result!.toolName).toBe("read");
    expect(result!.content).toContain("function add");
    expect(result!.isError).toBe(false);
  });

  it("returns undefined for unknown tool call ID", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    expect(getToolResult(t, "tc_nonexistent")).toBeUndefined();
  });
});

describe("hasToolCallWithArgs", () => {
  it("matches exact string arguments", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    expect(hasToolCallWithArgs(t, "read", { path: "calc.js" })).toBe(true);
    expect(hasToolCallWithArgs(t, "read", { path: "other.js" })).toBe(false);
  });

  it("matches regex patterns", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    expect(hasToolCallWithArgs(t, "bash", { command: /npm\s+test/ })).toBe(true);
    expect(hasToolCallWithArgs(t, "bash", { command: /vitest/ })).toBe(false);
  });
});

describe("hasVerificationAfterWrite", () => {
  it("detects read-after-write for the same file", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    // The transcript has: write calc.js, then later read calc.js
    expect(hasVerificationAfterWrite(t, "calc.js")).toBe(true);
  });

  it("returns false if file was never written", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    expect(hasVerificationAfterWrite(t, "other.js")).toBe(false);
  });
});

describe("getFinishCall", () => {
  it("extracts finish call details", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    const finish = getFinishCall(t);
    expect(finish).not.toBeNull();
    expect(finish!.status).toBe("success");
    expect(finish!.summary).toBe("Fixed the add function");
    expect(finish!.deliverables).toHaveLength(1);
    expect(finish!.deliverables![0].path).toBe("calc.js");
  });

  it("returns null if no finish call", () => {
    const lines = [SAMPLE_TRANSCRIPT_LINES[0], SAMPLE_TRANSCRIPT_LINES[1]];
    const t = loadTranscript(writeSampleTranscript(lines))!;
    expect(getFinishCall(t)).toBeNull();
  });
});

describe("countTurns", () => {
  it("counts assistant turns", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    expect(countTurns(t)).toBe(4); // 4 assistant entries
  });
});

describe("totalOps", () => {
  it("counts all tool calls", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    expect(totalOps(t)).toBe(5); // read, write, bash, read, finish
  });
});

describe("summarizeToolCalls", () => {
  it("produces readable summary", () => {
    const t = loadTranscript(writeSampleTranscript())!;
    const summary = summarizeToolCalls(t);
    expect(summary).toContain("read");
    expect(summary).toContain("write");
    expect(summary).toContain("bash");
    expect(summary).toContain("finish");
    expect(summary).toContain("calc.js");
  });
});
