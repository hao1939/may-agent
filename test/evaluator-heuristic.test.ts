import { describe, it, expect } from "vitest";
import { computeHeuristicScores } from "../src/lib/evaluator.js";
import type { PersistedSession } from "../src/lib/persistence.js";

// Minimal session for testing
function makeSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    id: "s_test_123",
    agent: "test-agent",
    status: "done",
    startedAt: Date.now() - 60000,
    ...overrides,
  } as PersistedSession;
}

// Build a toolResult message matching the JSONL format
function toolResult(text: string): any {
  return {
    role: "toolResult",
    toolCallId: "tc_" + Math.random().toString(36).slice(2),
    toolName: "read",
    content: [{ type: "text", text }],
  };
}

function assistantMsg(toolCalls: number = 1): any {
  const content = [];
  for (let i = 0; i < toolCalls; i++) {
    content.push({ type: "toolCall", name: "read", id: "tc_" + i, input: {} });
  }
  return { role: "assistant", content };
}

// Build a transcript string from messages
function toTranscript(messages: any[]): string {
  return messages.map((m) => JSON.stringify(m)).join("\n");
}

describe("computeHeuristicScores - hard error counting", () => {
  it("counts actual ENOENT errors in short toolResult messages", () => {
    const messages = [
      assistantMsg(2),
      toolResult("Error reading file: ENOENT: no such file or directory, open '/app/missing.ts'"),
      toolResult("file contents here"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.wastedCalls).toBe(1);
    expect(scores.productiveCalls).toBe(1);
  });

  it("does NOT count error strings inside long file content (>500 chars)", () => {
    // Simulate reading an error log or TSC output that contains "Cannot find module"
    const longContent =
      "x".repeat(200) +
      "\nCannot find module '@foo/bar'\nENOENT: no such file\n" +
      "x".repeat(300);
    const messages = [
      assistantMsg(3),
      toolResult(longContent), // long read result — analyzing error logs
      toolResult("ok"),
      toolResult("ok"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // Should NOT count the error strings in the long content
    expect(scores.wastedCalls).toBe(0);
    expect(scores.productiveCalls).toBe(3);
  });

  it("counts multiple short error results correctly", () => {
    const messages = [
      assistantMsg(5),
      toolResult("Error reading file: ENOENT: no such file or directory, open '/app/a.ts'"),
      toolResult("Error reading file: ENOENT: no such file or directory, open '/app/b.ts'"),
      toolResult("Cannot find module './missing'"),
      toolResult("P53 Violation: blocked"),
      toolResult("success"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // 4 hard errors > 3, triggers efficiency penalty and capping
    expect(scores.wastedCalls).toBe(3); // min(4, ceil(5*0.5)) = min(4,3) = 3
    expect(scores.issues).toContain("multiple_tool_errors");
  });

  it("falls back to transcript matching when no messages provided", () => {
    // Legacy behavior: regex on full transcript
    const messages = [
      assistantMsg(2),
      toolResult("ENOENT: no such file or directory"),
      toolResult("ok"),
    ];
    const transcript = toTranscript(messages);
    // Pass undefined messages — should fall back to transcript matching
    const scores = computeHeuristicScores(makeSession(), transcript);
    expect(scores.wastedCalls).toBe(1);
  });

  it("handles string content in toolResult (not just array)", () => {
    const messages = [
      assistantMsg(1),
      {
        role: "toolResult",
        toolCallId: "tc_1",
        toolName: "read",
        content: "ENOENT: no such file or directory",
      },
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.wastedCalls).toBe(1);
  });

  it("real-world scenario: agent reading TSC output with 'Cannot find module' is NOT penalized", () => {
    // TSC output is typically long with many lines
    const tscOutput = Array.from({ length: 30 }, (_, i) =>
      `src/file${i}.ts(${i + 1},5): error TS2307: Cannot find module './dep${i}' or its corresponding type declarations.`
    ).join("\n");
    // tscOutput is > 500 chars
    expect(tscOutput.length).toBeGreaterThan(500);

    const messages = [
      assistantMsg(3),
      toolResult(tscOutput), // reading TSC output
      toolResult("file contents ok"),
      toolResult("another ok result"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // The "Cannot find module" strings should NOT be counted
    expect(scores.wastedCalls).toBe(0);
    expect(scores.productiveCalls).toBe(3);
  });

  it("Validation failed for tool is counted in short results", () => {
    const messages = [
      assistantMsg(2),
      toolResult("Validation failed for tool 'bash': missing required parameter 'command'"),
      toolResult("ok"),
    ];
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.wastedCalls).toBe(1);
  });
});
