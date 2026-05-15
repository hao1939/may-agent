import { describe, it, expect, vi } from "bun:test";
import {
  createCompactionTransform,
  trimAccumulatedSummary,
  extractKeyFacts,
  mergeKeyFacts,
  formatKeyFacts,
  extractOriginalTask,
} from "../src/lib/compaction.js";
import type { CompactionInfo, KeyFacts } from "../src/lib/compaction.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";

// ── Helpers ────────────────────────────────────────────────────────────

function fakeModel(contextWindow: number): Model<any> {
  return {
    provider: "test",
    id: "test-model",
    api: "openai-chat" as any,
    contextWindow,
    maxTokens: 4096,
  } as Model<any>;
}

function userMsg(text: string, ts = Date.now()): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: ts,
  };
}

function assistantMsg(text: string, ts = Date.now()): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-chat",
    provider: "test",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: ts,
  } as AgentMessage;
}

let _tcCounter = 0;
function toolCallMsg(name: string, args: Record<string, any>, ts = Date.now()): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id: `tc_${++_tcCounter}`, name, arguments: args }],
    api: "openai-chat",
    provider: "test",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "toolUse",
    timestamp: ts,
  } as AgentMessage;
}

function toolResultMsg(name: string, text: string, ts = Date.now()): AgentMessage {
  return {
    role: "toolResult",
    toolCallId: `tc_${_tcCounter}`,
    toolName: name,
    content: [{ type: "text", text }],
    isError: false,
    timestamp: ts,
  } as AgentMessage;
}

function errorToolResultMsg(name: string, text: string, ts = Date.now()): AgentMessage {
  return {
    role: "toolResult",
    toolCallId: `tc_${_tcCounter}`,
    toolName: name,
    content: [{ type: "text", text }],
    isError: true,
    timestamp: ts,
  } as AgentMessage;
}

/** Generate a long string of approximately `tokens` estimated tokens (4 chars each). */
function longText(tokens: number): string {
  return "x".repeat(tokens * 3);
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("createCompactionTransform", () => {
  it("returns messages unchanged when under threshold", async () => {
    const model = fakeModel(10000);
    const transform = createCompactionTransform(model, { threshold: 0.7 });

    // Short conversation — well under 7000 token threshold
    const messages = [userMsg("Hello"), assistantMsg("Hi there")];

    const result = await transform(messages);
    expect(result).toBe(messages); // same reference, not modified
  });

  it("compacts messages when over threshold", async () => {
    // 1000 token context window, threshold 0.5 = triggers at 500 tokens
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.5, keepRatio: 0.3 });

    const messages = [
      userMsg(longText(200)), // old
      assistantMsg(longText(100)), // old
      userMsg(longText(100)), // recent
      assistantMsg(longText(150)), // recent
    ];

    const result = await transform(messages);
    expect(result.length).toBeLessThan(messages.length);
    // First message should be the compacted summary
    expect(result[0].role).toBe("user");
    const text = (result[0].content as any[])[0].text;
    expect(text).toContain("COMPACTED CONTEXT");
  });

  it("calls onCompact callback with info", async () => {
    // Use a larger context window so compaction savings exceed the summary +
    // original task overhead. 5000 tokens, threshold 0.5 = trigger at 2500.
    const model = fakeModel(5000);
    const onCompact = vi.fn();
    const transform = createCompactionTransform(model, {
      threshold: 0.5,
      keepRatio: 0.3,
      onCompact,
    });

    const messages = [
      userMsg(longText(800)), // old — large enough that summary is much smaller
      assistantMsg(longText(800)), // old
      userMsg(longText(400)), // recent
      assistantMsg(longText(500)), // recent
    ];

    await transform(messages);
    expect(onCompact).toHaveBeenCalledTimes(1);
    const info: CompactionInfo = onCompact.mock.calls[0][0];
    expect(info.compactionCount).toBe(1);
    expect(info.messagesCompacted).toBeGreaterThan(0);
    expect(info.messagesKept).toBeGreaterThan(0);
    expect(info.tokensAfter).toBeLessThan(info.tokensBefore);
  });

  it("preserves the most recent messages intact", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.5, keepRatio: 0.3 });

    const recentUser = userMsg("What is the status?");
    const recentAssistant = assistantMsg("Here is the status report.");

    const messages = [userMsg(longText(200)), assistantMsg(longText(200)), recentUser, recentAssistant];

    const result = await transform(messages);
    // Recent messages should be preserved at the end
    expect(result[result.length - 1]).toBe(recentAssistant);
    expect(result[result.length - 2]).toBe(recentUser);
  });

  it("accumulates summaries across multiple compactions", async () => {
    const model = fakeModel(1000);
    const onCompact = vi.fn();
    const transform = createCompactionTransform(model, {
      threshold: 0.3,
      keepRatio: 0.15,
      onCompact,
    });

    // First round
    const messages1 = [
      userMsg(longText(100)),
      assistantMsg(longText(100)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result1 = await transform(messages1);
    expect(onCompact).toHaveBeenCalledTimes(1);

    // Simulate more conversation: take result1 and add more messages
    const messages2 = [...result1, userMsg(longText(100)), assistantMsg(longText(100))];

    const result2 = await transform(messages2);
    expect(onCompact).toHaveBeenCalledTimes(2);

    // The summary should contain "(compacted)" marker from accumulation
    const summaryText = (result2[0].content as any[])[0].text;
    expect(summaryText).toContain("compacted");
  });

  it("does not split in the middle of tool call / tool result pair", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.4, keepRatio: 0.2 });

    const messages = [
      userMsg(longText(100)),
      assistantMsg(longText(50)),
      toolCallMsg("exec", { command: "ls" }),
      toolResultMsg("exec", longText(50)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    // The result should not start with a toolResult (orphaned)
    for (let i = 1; i < result.length; i++) {
      const msg = result[i];
      if (msg.role === "toolResult") {
        // There must be a preceding assistant message with a tool call
        const prev = result[i - 1];
        expect(prev.role).toBe("assistant");
      }
    }
  });

  it("handles empty messages array", async () => {
    const model = fakeModel(10000);
    const transform = createCompactionTransform(model);
    const result = await transform([]);
    expect(result).toEqual([]);
  });

  it("handles single message", async () => {
    const model = fakeModel(100); // tiny window
    const transform = createCompactionTransform(model, { threshold: 0.01 });

    // Even if this exceeds the threshold, splitAt must be > 1 to compact
    const messages = [userMsg(longText(200))];
    const result = await transform(messages);
    // Should return unchanged — can't compact just 1 message
    expect(result).toEqual(messages);
  });

  it("includes tool call names in summary", async () => {
    const model = fakeModel(500);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const messages = [
      userMsg("Run the tests " + longText(30)),
      toolCallMsg("exec", { command: "npm test" }),
      toolResultMsg("exec", "All tests passed " + longText(30)),
      assistantMsg("Tests passed! " + longText(30)),
      userMsg(longText(50)),
      assistantMsg(longText(50)),
    ];

    const result = await transform(messages);
    expect(result.length).toBeLessThan(messages.length);
    const summaryText = (result[0].content as any[])[0].text;
    expect(summaryText).toContain("COMPACTED CONTEXT");
    expect(summaryText).toContain("exec");
  });

  it("includes tool error status in summary", async () => {
    const model = fakeModel(500);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const messages = [
      userMsg("Read the file " + longText(30)),
      toolCallMsg("read", { path: "/foo.ts" }),
      errorToolResultMsg("read", "ENOENT: no such file " + longText(30)),
      assistantMsg("File not found " + longText(30)),
      userMsg(longText(50)),
      assistantMsg(longText(50)),
    ];

    const result = await transform(messages);
    expect(result.length).toBeLessThan(messages.length);
    const summaryText = (result[0].content as any[])[0].text;
    expect(summaryText).toContain("COMPACTED CONTEXT");
    expect(summaryText).toContain("ERROR");
  });

  it("default threshold is 0.6", async () => {
    const model = fakeModel(10000);
    const onCompact = vi.fn();
    const transform = createCompactionTransform(model, { onCompact });

    // 5000 tokens in 4 messages — under 60% of 10000
    const messages = [
      userMsg(longText(1250)),
      assistantMsg(longText(1250)),
      userMsg(longText(1250)),
      assistantMsg(longText(1250)),
    ];

    await transform(messages);
    expect(onCompact).not.toHaveBeenCalled();

    // 8000 tokens in 4 messages — over 60% of 10000
    const messages2 = [
      userMsg(longText(2000)),
      assistantMsg(longText(2000)),
      userMsg(longText(2000)),
      assistantMsg(longText(2000)),
    ];

    await transform(messages2);
    expect(onCompact).toHaveBeenCalledTimes(1);
  });

  it("does not modify the original messages array", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const messages = [
      userMsg(longText(200)),
      assistantMsg(longText(200)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];
    const originalLength = messages.length;

    await transform(messages);
    expect(messages.length).toBe(originalLength);
  });

  it("compaction count increments across calls", async () => {
    const model = fakeModel(500);
    const onCompact = vi.fn();
    const transform = createCompactionTransform(model, {
      threshold: 0.3,
      keepRatio: 0.1,
      onCompact,
    });

    const makeMessages = () => [
      userMsg(longText(100)),
      assistantMsg(longText(100)),
      userMsg(longText(50)),
      assistantMsg(longText(50)),
    ];

    await transform(makeMessages());
    await transform(makeMessages());
    await transform(makeMessages());

    expect(onCompact).toHaveBeenCalledTimes(3);
    expect(onCompact.mock.calls[0][0].compactionCount).toBe(1);
    expect(onCompact.mock.calls[1][0].compactionCount).toBe(2);
    expect(onCompact.mock.calls[2][0].compactionCount).toBe(3);
  });

  it("works with string content in user messages", async () => {
    const model = fakeModel(500);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    // pi-ai allows string content for user messages
    const messages: AgentMessage[] = [
      { role: "user", content: longText(100), timestamp: Date.now() } as any,
      assistantMsg(longText(100)),
      userMsg(longText(50)),
      assistantMsg(longText(50)),
    ];

    const result = await transform(messages);
    expect(result.length).toBeLessThan(messages.length);
    expect((result[0].content as any[])[0].text).toContain("COMPACTED CONTEXT");
  });

  // ── Last reasoning preservation tests ────────────────────────────────

  it("preserves last substantial assistant reasoning in summary", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const reasoning =
      "The test failure is caused by using toBe for object comparison. " +
      "The assertion should use toEqual instead, because toBe checks reference equality " +
      "while toEqual performs deep structural comparison. I will update the test file.";

    const messages = [
      userMsg("Fix the failing test " + longText(50)),
      assistantMsg(reasoning + " " + longText(50)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;
    expect(summaryText).toContain("[Last reasoning before compaction]");
    // The full reasoning should be preserved, not truncated to 200 chars
    expect(summaryText).toContain("deep structural comparison");
    expect(summaryText).toContain("toBe for object comparison");
  });

  it("picks the LAST substantial reasoning when multiple exist", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const earlyReasoning =
      "First I need to read the config file to understand the setup. " +
      "This will help me determine the correct approach for fixing the integration issue.";
    const laterReasoning =
      "After reading the config, I see the problem is in the database " +
      "connection string. The host is wrong — it should be localhost not 127.0.0.1 for IPv6.";

    const messages = [
      userMsg("Fix the DB connection " + longText(30)),
      assistantMsg(earlyReasoning + " " + longText(30)),
      userMsg("Here is more context " + longText(30)),
      assistantMsg(laterReasoning + " " + longText(30)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;
    // Should have the LATER reasoning, not the early one
    expect(summaryText).toContain("database connection string");
    expect(summaryText).toContain("localhost not 127.0.0.1");
  });

  it("does not include reasoning section when no substantial text exists", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const messages = [
      userMsg(longText(200)),
      assistantMsg("OK"), // too short to be substantial (< 100 chars)
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;
    expect(summaryText).not.toContain("[Last reasoning before compaction]");
  });

  it("truncates very long reasoning blocks with a marker", async () => {
    const model = fakeModel(2000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    // Reasoning block that exceeds the 2000-char cap
    const longReasoning = "A".repeat(3000);

    const messages = [
      userMsg(longText(200)),
      assistantMsg(longReasoning + " " + longText(50)),
      userMsg(longText(200)),
      assistantMsg(longText(200)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;
    expect(summaryText).toContain("[Last reasoning before compaction]");
    expect(summaryText).toContain("_(reasoning truncated)_");
    // Should not contain the full 3000-char string
    expect(summaryText).not.toContain("A".repeat(3000));
  });

  it("reasoning is preserved alongside structural tool call log", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const reasoning =
      "The ENOENT error on config.json means the file was moved. " +
      "Based on the find output, it's now at src/config/config.json. I'll update the import path.";

    const messages = [
      userMsg("Fix the missing config " + longText(20)),
      toolCallMsg("read", { path: "config.json" }),
      toolResultMsg("read", "ENOENT: no such file"),
      assistantMsg(reasoning + " " + longText(20)),
      toolCallMsg("read", { path: "src/config/config.json" }),
      toolResultMsg("read", "{ port: 3000 }" + longText(20)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;
    // Should have BOTH the structural log AND the reasoning
    expect(summaryText).toContain("[read]"); // structural tool result
    expect(summaryText).toContain("[Last reasoning before compaction]");
    expect(summaryText).toContain("file was moved");
    expect(summaryText).toContain("src/config/config.json");
  });

  // ── Error tool results get longer previews ─────────────────────────

  it("gives error tool results longer previews than success results", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    // Create an error message that's 250 chars long — longer than old 150 limit but under 300
    const errorText = "E".repeat(250);
    // Create a success message that's 250 chars long — should be truncated at 200
    const successText = "S".repeat(250);

    const messages = [
      userMsg("test " + longText(20)),
      toolCallMsg("exec", { command: "test" }),
      errorToolResultMsg("exec", errorText),
      assistantMsg("error " + longText(20)),
      toolCallMsg("exec", { command: "test2" }),
      toolResultMsg("exec", successText),
      assistantMsg("success " + longText(20)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;

    // Error result: 250 chars < 300 limit → full text preserved
    expect(summaryText).toContain("E".repeat(250));
    // Success result: 250 chars > 200 limit → truncated
    expect(summaryText).not.toContain("S".repeat(250));
    expect(summaryText).toContain("S".repeat(200));
  });

  // ── Key facts extraction ─────────────────────────────────────────────

  it("extracts key facts about files read and written", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const messages = [
      userMsg("Fix the bug " + longText(20)),
      toolCallMsg("read", { path: "src/tools.ts" }),
      toolResultMsg("read", "file content " + longText(30)),
      assistantMsg("I see the issue " + longText(20)),
      toolCallMsg("write", { path: "src/tools.ts", content: "fixed" }),
      toolResultMsg("write", "Wrote 5 bytes"),
      assistantMsg("Fixed! " + longText(20)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;
    expect(summaryText).toContain("Key facts");
    expect(summaryText).toContain("Files read: src/tools.ts");
    expect(summaryText).toContain("Files written: src/tools.ts");
  });

  it("extracts exec commands with outcomes in key facts", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const messages = [
      userMsg("Run the tests " + longText(20)),
      toolCallMsg("exec", { command: "bun test" }),
      toolResultMsg("exec", "All tests passed " + longText(30)),
      assistantMsg("Tests passed! " + longText(20)),
      toolCallMsg("exec", { command: "npx tsc --noEmit" }),
      errorToolResultMsg("exec", "Error: type mismatch " + longText(10)),
      assistantMsg("Compile error " + longText(20)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;
    expect(summaryText).toContain("Key facts");
    expect(summaryText).toContain("Exec commands run:");
    expect(summaryText).toContain("[ok] bun test");
    expect(summaryText).toContain("[FAILED] npx tsc --noEmit");
  });

  it("merges exec commands across compaction rounds", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    // Round 1: run bun test
    const messages1 = [
      userMsg("Run tests " + longText(20)),
      toolCallMsg("exec", { command: "bun test" }),
      toolResultMsg("exec", "passed " + longText(30)),
      assistantMsg("ok " + longText(20)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result1 = await transform(messages1);

    // Round 2: run tsc (add to result1)
    const messages2 = [
      ...result1,
      toolCallMsg("exec", { command: "npx tsc --noEmit" }),
      toolResultMsg("exec", "no errors " + longText(30)),
      assistantMsg("compiled " + longText(20)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result2 = await transform(messages2);
    const summaryText = (result2[0].content as any[])[0].text;

    // Both commands should appear in key facts
    expect(summaryText).toContain("bun test");
    expect(summaryText).toContain("npx tsc --noEmit");
  });

  // ── Original task preservation ───────────────────────────────────────

  it("preserves full original task in compacted context", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const task =
      "Implement the FrobnicatorService class with methods for encoding, " +
      "decoding, and validating frobnicated data streams. The service should handle " +
      "both synchronous and asynchronous pipelines. Include proper error handling " +
      "and unit tests for all edge cases.";

    const messages = [
      userMsg(task + " " + longText(50)),
      assistantMsg("I'll start by reading the codebase. " + longText(50)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;

    // The full task should be preserved, not just truncated to 200 chars
    expect(summaryText).toContain("[Original task]");
    expect(summaryText).toContain("FrobnicatorService");
    expect(summaryText).toContain("synchronous and asynchronous pipelines");
    expect(summaryText).toContain("unit tests for all edge cases");
  });

  it("truncates very long original tasks with ellipsis", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    // Task longer than ORIGINAL_TASK_MAX_LENGTH (500 chars)
    const longTask = "Implement feature: " + "A".repeat(600);

    const messages = [
      userMsg(longTask),
      assistantMsg(longText(100)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;

    expect(summaryText).toContain("[Original task]");
    // Should be truncated at 500 chars
    expect(summaryText).not.toContain("A".repeat(600));
    expect(summaryText).toContain("A".repeat(481)); // 500 - "Implement feature: ".length
    expect(summaryText).toContain("…");
  });

  it("preserves original task across multiple compaction rounds", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.15 });

    const task = "Fix the authentication middleware to properly validate JWT tokens";

    // Round 1
    const messages1 = [
      userMsg(task + " " + longText(50)),
      assistantMsg(longText(100)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result1 = await transform(messages1);
    const text1 = (result1[0].content as any[])[0].text;
    expect(text1).toContain("[Original task]");
    expect(text1).toContain("JWT tokens");

    // Round 2: original first message is gone, but task should persist
    const messages2 = [
      ...result1,
      userMsg(longText(100)),
      assistantMsg(longText(100)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result2 = await transform(messages2);
    const text2 = (result2[0].content as any[])[0].text;
    expect(text2).toContain("[Original task]");
    expect(text2).toContain("JWT tokens");
  });

  it("does not include original task block when first message is empty", async () => {
    const model = fakeModel(1000);
    const transform = createCompactionTransform(model, { threshold: 0.3, keepRatio: 0.1 });

    const messages = [
      userMsg(""), // empty task
      assistantMsg(longText(200)),
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

    const result = await transform(messages);
    const summaryText = (result[0].content as any[])[0].text;
    expect(summaryText).not.toContain("[Original task]");
  });

  // ── Summary trimming via createCompactionTransform ───────────────────

  it("caps accumulated summary to prevent unbounded growth", async () => {
    // In production, the min budget is 8000 chars.
    // We test that after many compaction rounds, the summary doesn't grow forever
    // by checking it stays under a reasonable bound.
    const model = fakeModel(1000);
    const onCompact = vi.fn();
    const transform = createCompactionTransform(model, {
      threshold: 0.3,
      keepRatio: 0.15,
      onCompact,
    });

    // Run many compaction rounds
    let lastResult: AgentMessage[] = [];
    for (let round = 0; round < 10; round++) {
      const messages = [
        ...(lastResult.length > 0 ? lastResult : []),
        userMsg(longText(100)),
        assistantMsg(longText(100)),
        userMsg(longText(100)),
        assistantMsg(longText(100)),
      ];
      lastResult = await transform(messages);
    }

    // Should have compacted multiple times
    expect(onCompact.mock.calls.length).toBeGreaterThan(3);

    // The summary message should exist and not be unbounded
    // With 10 rounds of compaction, without trimming the summary
    // would grow linearly. The MIN_SUMMARY_BUDGET_CHARS cap (8000)
    // ensures it stays bounded.
    const summaryText = (lastResult[0].content as any[])[0].text;
    expect(summaryText).toContain("COMPACTED CONTEXT");
    // Summary should be bounded — 8000 chars min budget + original task block + overhead
    expect(summaryText.length).toBeLessThan(12000);
  });
});

// ── extractOriginalTask unit tests ─────────────────────────────────────

describe("extractOriginalTask", () => {
  it("extracts text from first user message with array content", () => {
    const messages: AgentMessage[] = [userMsg("Implement the new feature"), assistantMsg("Sure thing")];
    expect(extractOriginalTask(messages)).toBe("Implement the new feature");
  });

  it("extracts text from first user message with string content", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "Fix the bug", timestamp: Date.now() } as any,
      assistantMsg("OK"),
    ];
    expect(extractOriginalTask(messages)).toBe("Fix the bug");
  });

  it("returns null when first user message is empty", () => {
    const messages: AgentMessage[] = [userMsg(""), assistantMsg("OK")];
    expect(extractOriginalTask(messages)).toBeNull();
  });

  it("returns null when no user messages exist", () => {
    const messages: AgentMessage[] = [assistantMsg("Hello")];
    expect(extractOriginalTask(messages)).toBeNull();
  });

  it("returns null for empty messages array", () => {
    expect(extractOriginalTask([])).toBeNull();
  });

  it("returns first user message even if there are later user messages", () => {
    const messages: AgentMessage[] = [
      userMsg("First task"),
      assistantMsg("Working on it"),
      userMsg("Actually do something else"),
      assistantMsg("OK"),
    ];
    expect(extractOriginalTask(messages)).toBe("First task");
  });

  it("joins multiple text blocks in a single user message", () => {
    const messages: AgentMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Part 1." },
          { type: "text", text: "Part 2." },
        ],
        timestamp: Date.now(),
      },
      assistantMsg("OK"),
    ];
    expect(extractOriginalTask(messages as any)).toBe("Part 1. Part 2.");
  });
});

// ── extractKeyFacts unit tests ─────────────────────────────────────────

describe("extractKeyFacts", () => {
  it("extracts files read and written", () => {
    const messages: AgentMessage[] = [
      toolCallMsg("read", { path: "src/a.ts" }),
      toolResultMsg("read", "contents"),
      toolCallMsg("write", { path: "src/b.ts", content: "new" }),
      toolResultMsg("write", "Wrote 3 bytes"),
    ];

    const facts = extractKeyFacts(messages);
    expect(facts.filesRead.has("src/a.ts")).toBe(true);
    expect(facts.filesWritten.has("src/b.ts")).toBe(true);
  });

  it("extracts exec commands with success status", () => {
    const messages: AgentMessage[] = [
      toolCallMsg("exec", { command: "npm test" }),
      toolResultMsg("exec", "All tests passed"),
    ];

    const facts = extractKeyFacts(messages);
    expect(facts.execCommands).toHaveLength(1);
    expect(facts.execCommands[0].command).toBe("npm test");
    expect(facts.execCommands[0].failed).toBe(false);
  });

  it("extracts exec commands with failure status", () => {
    const messages: AgentMessage[] = [
      toolCallMsg("exec", { command: "npx tsc --noEmit" }),
      errorToolResultMsg("exec", "Error: type mismatch"),
    ];

    const facts = extractKeyFacts(messages);
    expect(facts.execCommands).toHaveLength(1);
    expect(facts.execCommands[0].command).toBe("npx tsc --noEmit");
    expect(facts.execCommands[0].failed).toBe(true);
  });

  it("handles multiple exec commands", () => {
    const messages: AgentMessage[] = [
      toolCallMsg("exec", { command: "ls" }),
      toolResultMsg("exec", "file1 file2"),
      toolCallMsg("exec", { command: "cat file1" }),
      toolResultMsg("exec", "contents"),
      toolCallMsg("exec", { command: "npm test" }),
      errorToolResultMsg("exec", "FAIL"),
    ];

    const facts = extractKeyFacts(messages);
    expect(facts.execCommands).toHaveLength(3);
    expect(facts.execCommands[0]).toEqual({ command: "ls", failed: false });
    expect(facts.execCommands[1]).toEqual({ command: "cat file1", failed: false });
    expect(facts.execCommands[2]).toEqual({ command: "npm test", failed: true });
  });

  it("returns empty facts for messages with no tool calls", () => {
    const messages: AgentMessage[] = [userMsg("hello"), assistantMsg("hi")];

    const facts = extractKeyFacts(messages);
    expect(facts.filesRead.size).toBe(0);
    expect(facts.filesWritten.size).toBe(0);
    expect(facts.filesEdited.size).toBe(0);
    expect(facts.agentCalls).toHaveLength(0);
    expect(facts.execCommands).toHaveLength(0);
  });

  it("extracts files edited via edit() calls", () => {
    const messages: AgentMessage[] = [
      toolCallMsg("edit", { path: "src/a.ts", oldText: "foo", newText: "bar" }),
      toolResultMsg("edit", "Edit applied"),
    ];

    const facts = extractKeyFacts(messages);
    expect(facts.filesEdited.has("src/a.ts")).toBe(true);
    expect(facts.filesWritten.has("src/a.ts")).toBe(false);
  });

  it("extracts agent calls", () => {
    const messages: AgentMessage[] = [
      toolCallMsg("agents", { action: "call", agent: "coder", task: "Fix the bug in parser.ts" }),
      toolResultMsg("agents", "Task completed"),
    ];

    const facts = extractKeyFacts(messages);
    expect(facts.agentCalls).toHaveLength(1);
    expect(facts.agentCalls[0].agent).toBe("coder");
    expect(facts.agentCalls[0].task).toBe("Fix the bug in parser.ts");
  });

  it("ignores non-call agent actions", () => {
    const messages: AgentMessage[] = [
      toolCallMsg("agents", { action: "list" }),
      toolResultMsg("agents", "agents list"),
      toolCallMsg("agents", { action: "fork", agent: "bob", task: "research" }),
      toolResultMsg("agents", "forked"),
    ];

    const facts = extractKeyFacts(messages);
    expect(facts.agentCalls).toHaveLength(0);
  });
});

// ── mergeKeyFacts unit tests ───────────────────────────────────────────

describe("mergeKeyFacts", () => {
  it("unions file sets from both rounds", () => {
    const a: KeyFacts = {
      filesRead: new Set(["a.ts"]),
      filesWritten: new Set(["b.ts"]),
      execCommands: [],
    };
    const b: KeyFacts = {
      filesRead: new Set(["c.ts"]),
      filesWritten: new Set(["d.ts"]),
      execCommands: [],
    };

    const merged = mergeKeyFacts(a, b);
    expect(merged.filesRead).toEqual(new Set(["a.ts", "c.ts"]));
    expect(merged.filesWritten).toEqual(new Set(["b.ts", "d.ts"]));
  });

  it("deduplicates exec commands by command string, keeping latest outcome", () => {
    const a: KeyFacts = {
      filesRead: new Set(),
      filesWritten: new Set(),
      execCommands: [{ command: "npm test", failed: true }],
    };
    const b: KeyFacts = {
      filesRead: new Set(),
      filesWritten: new Set(),
      execCommands: [{ command: "npm test", failed: false }],
    };

    const merged = mergeKeyFacts(a, b);
    expect(merged.execCommands).toHaveLength(1);
    expect(merged.execCommands[0]).toEqual({ command: "npm test", failed: false });
  });

  it("caps exec commands at 15, dropping oldest", () => {
    const a: KeyFacts = {
      filesRead: new Set(),
      filesWritten: new Set(),
      execCommands: Array.from({ length: 10 }, (_, i) => ({
        command: `cmd_a_${i}`,
        failed: false,
      })),
    };
    const b: KeyFacts = {
      filesRead: new Set(),
      filesWritten: new Set(),
      execCommands: Array.from({ length: 10 }, (_, i) => ({
        command: `cmd_b_${i}`,
        failed: false,
      })),
    };

    const merged = mergeKeyFacts(a, b);
    expect(merged.execCommands.length).toBeLessThanOrEqual(15);
    // Should keep the newest commands (from b)
    expect(merged.execCommands.some((c) => c.command === "cmd_b_9")).toBe(true);
  });
});

// ── formatKeyFacts unit tests ──────────────────────────────────────────

describe("formatKeyFacts", () => {
  it("formats files and exec commands", () => {
    const facts: KeyFacts = {
      filesRead: new Set(["a.ts", "b.ts"]),
      filesWritten: new Set(["c.ts"]),
      execCommands: [
        { command: "npm test", failed: false },
        { command: "npx tsc", failed: true },
      ],
    };

    const lines = formatKeyFacts(facts);
    expect(lines).toContain("Files read: a.ts, b.ts");
    expect(lines).toContain("Files written: c.ts");
    expect(lines).toContain("Exec commands run:");
    expect(lines).toContain("  [ok] npm test");
    expect(lines).toContain("  [FAILED] npx tsc");
  });

  it("truncates long commands", () => {
    const longCmd = "A".repeat(200);
    const facts: KeyFacts = {
      filesRead: new Set(),
      filesWritten: new Set(),
      execCommands: [{ command: longCmd, failed: false }],
    };

    const lines = formatKeyFacts(facts);
    const cmdLine = lines.find((l) => l.includes("[ok]"))!;
    expect(cmdLine.length).toBeLessThan(200);
    expect(cmdLine).toContain("…");
  });

  it("returns empty array for empty facts", () => {
    const facts: KeyFacts = {
      filesRead: new Set(),
      filesWritten: new Set(),
      execCommands: [],
    };
    expect(formatKeyFacts(facts)).toEqual([]);
  });
});

// ── trimAccumulatedSummary unit tests ──────────────────────────────────

describe("trimAccumulatedSummary", () => {
  it("returns summary unchanged when under budget", () => {
    const summary = "short summary";
    expect(trimAccumulatedSummary(summary, 1000)).toBe(summary);
  });

  it("trims oldest sections first when over budget", () => {
    const section1 = "Section 1: " + "A".repeat(100);
    const section2 = "Section 2: " + "B".repeat(100);
    const section3 = "Section 3: " + "C".repeat(100);
    const summary = [section1, section2, section3].join("\n\n--- (compacted) ---\n\n");

    // Budget that fits 2 sections but not 3
    const budget = section2.length + section3.length + 100; // separator + trim notice
    const result = trimAccumulatedSummary(summary, budget);

    // Should NOT contain section 1 (oldest)
    expect(result).not.toContain("Section 1");
    // Should contain section 3 (newest)
    expect(result).toContain("Section 3");
    // Should contain trim notice
    expect(result).toContain("earlier compaction rounds trimmed");
  });

  it("handles single section that exceeds budget", () => {
    const summary = "A".repeat(500);
    const result = trimAccumulatedSummary(summary, 200);
    expect(result.length).toBeLessThanOrEqual(250); // 200 + trim marker
    expect(result).toContain("_(earlier context trimmed)_");
  });

  it("preserves newest section when only one fits", () => {
    const section1 = "Old: " + "A".repeat(200);
    const section2 = "New: " + "B".repeat(200);
    const summary = [section1, section2].join("\n\n--- (compacted) ---\n\n");

    // Budget that fits only 1 section
    const budget = 300;
    const result = trimAccumulatedSummary(summary, budget);

    // Should contain the NEWER section
    expect(result).toContain("New:");
    expect(result).toContain("earlier compaction rounds trimmed");
  });
});
