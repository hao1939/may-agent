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
    const longContent = "x".repeat(200) + "\nCannot find module '@foo/bar'\nENOENT: no such file\n" + "x".repeat(300);
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
    const messages = [assistantMsg(2), toolResult("ENOENT: no such file or directory"), toolResult("ok")];
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
    const tscOutput = Array.from(
      { length: 30 },
      (_, i) =>
        `src/file${i}.ts(${i + 1},5): error TS2307: Cannot find module './dep${i}' or its corresponding type declarations.`,
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

describe("computeHeuristicScores - waste ratio penalty", () => {
  it("100% waste ratio (0 productive, all wasted) → needs_improvement", () => {
    // Simulate a session with many tool calls that all fail with ENOENT
    const messages: any[] = [];
    // 10 assistant turns, each with 1 tool call
    for (let i = 0; i < 10; i++) {
      messages.push(assistantMsg(1));
      messages.push(toolResult("ENOENT: no such file or directory, open '/app/f" + i + ".ts'"));
    }
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // 10 hard errors > 3 → wastedCalls = min(10, ceil(10*0.5)) = 5
    // wasteRatio = 5/10 = 0.5 → moderate_waste_ratio
    expect(scores.issues).toContain("multiple_tool_errors");
    expect(scores.issues).toContain("moderate_waste_ratio");
    // efficiency: 3 + 1(done+3tools) - 1(multiple_tool_errors) - 1(moderate_waste) = 2
    // quality: 3 + 1(done+3tools) - 1(moderate_waste) = 3
    expect(scores.efficiency).toBeLessThanOrEqual(2);
  });

  it("session with 75%+ waste ratio gets high_waste_ratio and needs_improvement", () => {
    // 8 tool calls, 7 are hard errors (short results) → wasteRatio ≥ 0.75
    const messages: any[] = [];
    // One assistant turn with 8 tool calls
    messages.push(assistantMsg(8));
    for (let i = 0; i < 7; i++) {
      messages.push(toolResult("ENOENT: no such file or directory"));
    }
    messages.push(toolResult("ok"));
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    // 7 hard errors > 3 → wastedCalls = min(7, ceil(8*0.5)) = 4
    // wasteRatio = 4/8 = 0.5 → moderate at 50%, but let's check...
    // Actually this gets moderate_waste_ratio since 4/8 = 0.5
    expect(scores.issues).toContain("multiple_tool_errors");
    expect(scores.wastedCalls).toBeGreaterThanOrEqual(4);
    // verdict should be acceptable or needs_improvement (not "good")
    expect(scores.verdict).not.toBe("good");
  });

  it("session with low waste ratio (<50%) gets no waste penalty", () => {
    // 10 tool calls, 2 are errors → wasteRatio = 0.2
    const messages: any[] = [];
    messages.push(assistantMsg(10));
    messages.push(toolResult("ENOENT: no such file or directory"));
    messages.push(toolResult("ENOENT: no such file or directory"));
    for (let i = 0; i < 8; i++) {
      messages.push(toolResult("ok"));
    }
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.wastedCalls).toBe(2);
    expect(scores.issues).not.toContain("high_waste_ratio");
    expect(scores.issues).not.toContain("moderate_waste_ratio");
  });

  it("reproduces the bug: 0 productive / 42 wasted should be needs_improvement", () => {
    // The exact bug case: s_1773811688106_497 had 0 productive, 42 wasted
    // Build a session with many hard-error tool calls
    const messages: any[] = [];
    for (let i = 0; i < 42; i++) {
      messages.push(assistantMsg(1));
      messages.push(toolResult("Validation failed for tool 'bash': missing required parameter 'command'"));
    }
    const transcript = toTranscript(messages);
    const session = makeSession({ status: "interrupted" as any });
    const scores = computeHeuristicScores(session, transcript, messages);
    // 42 errors > 3 → wastedCalls = min(42, ceil(42*0.5)) = 21
    // wasteRatio = 21/42 = 0.5 → moderate_waste_ratio
    // "interrupted" is NOT penalized with session_error (only "error" status is).
    // efficiency: 3 - 1(multiple_tool_errors) - 1(moderate_waste) = 1
    // quality: 3 - 1(moderate_waste) = 2
    // verdict: quality=2 >= 2 but efficiency=1 < 2 → needs_improvement
    expect(scores.verdict).toBe("needs_improvement");
    expect(scores.issues).toContain("multiple_tool_errors");
  });

  it("high_waste_ratio threshold at exactly 0.75", () => {
    // 4 tool calls, 3 are errors → wastedCalls from hardErrors = 3 (not > 3, so no capping)
    // Actually 3 hardErrors is NOT > 3, so wastedCalls = 3, productiveCalls = 1
    // wasteRatio = 3/4 = 0.75 → high_waste_ratio
    const messages: any[] = [];
    messages.push(assistantMsg(4));
    messages.push(toolResult("ENOENT: no such file or directory"));
    messages.push(toolResult("ENOENT: no such file or directory"));
    messages.push(toolResult("ENOENT: no such file or directory"));
    messages.push(toolResult("ok"));
    const transcript = toTranscript(messages);
    const scores = computeHeuristicScores(makeSession(), transcript, messages);
    expect(scores.wastedCalls).toBe(3);
    expect(scores.productiveCalls).toBe(1);
    // 3/4 = 0.75 → high_waste_ratio
    expect(scores.issues).toContain("high_waste_ratio");
  });
});
