import { describe, it, expect, vi } from "vitest";
import { createCompactionTransform } from "../src/compaction.js";
import type { CompactionInfo } from "../src/compaction.js";
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
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "stop",
    timestamp: ts,
  } as AgentMessage;
}

function toolCallMsg(name: string, args: Record<string, any>, ts = Date.now()): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id: `tc_${Date.now()}`, name, arguments: args }],
    api: "openai-chat",
    provider: "test",
    model: "test-model",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "toolUse",
    timestamp: ts,
  } as AgentMessage;
}

function toolResultMsg(name: string, text: string, ts = Date.now()): AgentMessage {
  return {
    role: "toolResult",
    toolCallId: `tc_${Date.now()}`,
    toolName: name,
    content: [{ type: "text", text }],
    isError: false,
    timestamp: ts,
  } as AgentMessage;
}

/** Generate a long string of approximately `tokens` estimated tokens (4 chars each). */
function longText(tokens: number): string {
  return "x".repeat(tokens * 4);
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("createCompactionTransform", () => {
  it("returns messages unchanged when under threshold", async () => {
    const model = fakeModel(10000);
    const transform = createCompactionTransform(model, { threshold: 0.7 });

    // Short conversation — well under 7000 token threshold
    const messages = [
      userMsg("Hello"),
      assistantMsg("Hi there"),
    ];

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
    const model = fakeModel(1000);
    const onCompact = vi.fn();
    const transform = createCompactionTransform(model, {
      threshold: 0.5,
      keepRatio: 0.3,
      onCompact,
    });

    const messages = [
      userMsg(longText(200)),
      assistantMsg(longText(100)),
      userMsg(longText(100)),
      assistantMsg(longText(150)),
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

    const messages = [
      userMsg(longText(200)),
      assistantMsg(longText(200)),
      recentUser,
      recentAssistant,
    ];

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
    const messages2 = [
      ...result1,
      userMsg(longText(100)),
      assistantMsg(longText(100)),
    ];

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

    const errorResult: AgentMessage = {
      role: "toolResult",
      toolCallId: "tc_1",
      toolName: "read",
      content: [{ type: "text", text: "ENOENT: no such file " + longText(30) }],
      isError: true,
      timestamp: Date.now(),
    } as AgentMessage;

    const messages = [
      userMsg("Read the file " + longText(30)),
      toolCallMsg("read", { path: "/foo.ts" }),
      errorResult,
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

  it("default threshold is 0.7", async () => {
    const model = fakeModel(10000);
    const onCompact = vi.fn();
    const transform = createCompactionTransform(model, { onCompact });

    // 6000 tokens in 4 messages — under 70% of 10000
    const messages = [
      userMsg(longText(1500)),
      assistantMsg(longText(1500)),
      userMsg(longText(1500)),
      assistantMsg(longText(1500)),
    ];

    await transform(messages);
    expect(onCompact).not.toHaveBeenCalled();

    // 8000 tokens in 4 messages — over 70% of 10000
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
});
