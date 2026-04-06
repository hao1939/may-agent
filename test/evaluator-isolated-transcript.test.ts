import { describe, it, expect } from "vitest";
import { formatIsolatedTranscript } from "../src/lib/evaluator.js";

// ── Helpers ─────────────────────────────────────────────────────────

function userMsg(text: string): any {
  return { role: "user", content: text };
}

function assistantText(text: string): any {
  return { role: "assistant", content: [{ type: "text", text }] };
}

function assistantToolCall(name: string, args: Record<string, unknown> = {}): any {
  return {
    role: "assistant",
    content: [
      { type: "text", text: "Let me do this..." },
      { type: "toolCall", name, id: "tc_1", arguments: args },
    ],
  };
}

function assistantThinking(thinking: string, toolName: string, args: Record<string, unknown> = {}): any {
  return {
    role: "assistant",
    content: [
      { type: "thinking", thinking },
      { type: "toolCall", name: toolName, id: "tc_1", arguments: args },
    ],
  };
}

function toolResult(name: string, text: string): any {
  return {
    role: "toolResult",
    toolCallId: "tc_1",
    toolName: name,
    content: [{ type: "text", text }],
  };
}

function finishCall(params: Record<string, unknown>): any {
  return {
    role: "assistant",
    content: [
      { type: "text", text: "All done! Let me summarize my work." },
      { type: "toolCall", name: "finish", id: "tc_finish", arguments: params },
    ],
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("formatIsolatedTranscript (EXP-039)", () => {
  it("includes the first user message as task_specification", () => {
    const messages = [
      userMsg("Fix the rate limiter bug"),
      assistantText("I'll look into this"),
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("## task_specification");
    expect(result).toContain("Fix the rate limiter bug");
  });

  it("excludes subsequent user messages", () => {
    const messages = [
      userMsg("Fix the rate limiter bug"),
      assistantText("I need more context"),
      userMsg("Here is the additional context: the bug is in line 42"),
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("Fix the rate limiter bug");
    expect(result).not.toContain("additional context");
    expect(result).not.toContain("line 42");
  });

  it("strips assistant text blocks (agent reasoning)", () => {
    const messages = [
      userMsg("Fix the bug"),
      assistantText("Let me think about this carefully. The issue seems to be in the parser."),
      assistantToolCall("bash", { command: "npm test" }),
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).not.toContain("think about this carefully");
    expect(result).not.toContain("parser");
    expect(result).toContain("## tool_call: bash");
    expect(result).toContain("npm test");
  });

  it("strips thinking blocks", () => {
    const messages = [
      userMsg("Fix the bug"),
      assistantThinking("I should check the tests first", "bash", { command: "npm test" }),
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).not.toContain("check the tests first");
    expect(result).toContain("## tool_call: bash");
  });

  it("keeps tool calls with arguments", () => {
    const messages = [
      userMsg("Review the code"),
      assistantToolCall("read", { path: "src/lib/parser.ts" }),
      toolResult("read", "function parse() { return 42; }"),
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("## tool_call: read");
    expect(result).toContain("parser.ts");
    expect(result).toContain("## tool_result: read");
    expect(result).toContain("function parse()");
  });

  it("keeps tool results (objective outputs)", () => {
    const messages = [
      userMsg("Run tests"),
      assistantToolCall("bash", { command: "npm test" }),
      toolResult("bash", "5 passed, 1 failed\nFAILED: test_rate_limit"),
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("5 passed, 1 failed");
    expect(result).toContain("FAILED: test_rate_limit");
  });

  it("truncates long tool results at 2000 chars", () => {
    const longText = "x".repeat(3000);
    const messages = [
      userMsg("Read file"),
      assistantToolCall("read", { path: "big.ts" }),
      toolResult("read", longText),
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("[truncated from 3000 chars]");
    // Should have at most 2000 x's
    const xCount = (result.match(/x/g) || []).length;
    expect(xCount).toBe(2000);
  });

  it("strips finish() self-narrative arguments but keeps status", () => {
    const messages = [
      userMsg("Implement the feature"),
      assistantToolCall("bash", { command: "npm test" }),
      toolResult("bash", "All tests pass"),
      finishCall({
        status: "success",
        summary: "I successfully implemented the feature with comprehensive tests",
        deliverables: [{ path: "src/feature.ts", description: "New feature implementation" }],
        verification_evidence: ["Step 5: bash test exit code 0"],
      }),
    ];
    const result = formatIsolatedTranscript(messages);
    // Status is kept (objective fact)
    expect(result).toContain("## tool_call: finish");
    expect(result).toContain('"status":"success"');
    // Self-narrative is stripped
    expect(result).not.toContain("successfully implemented");
    expect(result).not.toContain("comprehensive tests");
    expect(result).not.toContain("New feature implementation");
    expect(result).not.toContain("Step 5");
    expect(result).not.toContain("verification_evidence");
    expect(result).not.toContain("deliverables");
  });

  it("keeps finish(blocked) status and has_blockers flag", () => {
    const messages = [
      userMsg("Deploy the service"),
      finishCall({
        status: "blocked",
        summary: "Cannot deploy because credentials are missing",
        blockers: [{ reason: "No AWS creds", context: "Checked env vars" }],
      }),
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain('"status":"blocked"');
    expect(result).toContain('"has_blockers":true');
    expect(result).not.toContain("credentials are missing");
    expect(result).not.toContain("AWS creds");
  });

  it("handles a realistic multi-turn session correctly", () => {
    const messages = [
      userMsg("Review rate-limiter.ts.after for bugs"),
      assistantText("I'll start by reading the spec and the code files."),
      assistantToolCall("read", { path: "SPEC.md" }),
      toolResult("read", "# Rate Limiter Spec\nmaxRequests: 100\nwindowMs: 60000"),
      assistantText("Now let me read the code after changes."),
      assistantToolCall("read", { path: "rate-limiter.ts.after" }),
      toolResult("read", "const TIER_LIMITS = { free: 100, pro: 1000 };\nfunction checkRate(ip, tier) { ... }"),
      assistantText("I notice the tier lookup doesn't handle invalid tiers. Let me run the tests."),
      assistantToolCall("bash", { command: "node rate-limiter.test.ts" }),
      toolResult("bash", "5 passed, 1 failed\nFAILED: invalid tier defaults to free"),
      assistantText("The test confirms the bug. Let me write my review."),
      finishCall({
        status: "success",
        summary: "Found 2 bugs: invalid tier handling and allowlist trim issue",
        deliverables: [{ path: "review-verdict.md", description: "QA review with findings" }],
        verification_evidence: ["Step 8: bash showed test failure for invalid tier"],
      }),
    ];
    const result = formatIsolatedTranscript(messages);

    // Task specification present
    expect(result).toContain("Review rate-limiter.ts.after for bugs");

    // Tool calls present
    expect(result).toContain("## tool_call: read");
    expect(result).toContain("## tool_call: bash");

    // Tool results present
    expect(result).toContain("Rate Limiter Spec");
    expect(result).toContain("5 passed, 1 failed");

    // Agent reasoning stripped
    expect(result).not.toContain("I'll start by reading");
    expect(result).not.toContain("I notice the tier lookup");
    expect(result).not.toContain("The test confirms");

    // Agent self-narrative in finish stripped
    expect(result).not.toContain("Found 2 bugs");
    expect(result).not.toContain("allowlist trim issue");
    expect(result).not.toContain("review-verdict.md");
  });

  it("handles empty messages array", () => {
    const result = formatIsolatedTranscript([]);
    expect(result).toBe("");
  });

  it("handles messages without role (non-standard)", () => {
    const messages = [
      { type: "metadata", timestamp: 123 } as any,
      userMsg("Do something"),
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("Do something");
  });

  it("handles user message with array content", () => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "First part of the task" },
          { type: "text", text: "Second part with details" },
        ],
      },
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).toContain("First part of the task");
    expect(result).toContain("Second part with details");
  });

  it("strips reasoning text mixed with tool calls in same assistant message", () => {
    const messages = [
      userMsg("Fix bug"),
      {
        role: "assistant",
        content: [
          { type: "text", text: "This looks like a null pointer issue." },
          { type: "toolCall", name: "edit", id: "tc_1", arguments: { path: "src/fix.ts", oldText: "x", newText: "y" } },
          { type: "text", text: "Now let me verify the fix worked." },
          { type: "toolCall", name: "bash", id: "tc_2", arguments: { command: "npm test" } },
        ],
      },
    ];
    const result = formatIsolatedTranscript(messages);
    expect(result).not.toContain("null pointer");
    expect(result).not.toContain("verify the fix");
    expect(result).toContain("## tool_call: edit");
    expect(result).toContain("## tool_call: bash");
  });
});
