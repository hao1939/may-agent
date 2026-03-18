import { describe, it, expect } from "vitest";
import { createFinishGuard } from "../src/lib/tools/finish-guard.js";
import type { BeforeToolCallContext } from "@mariozechner/pi-agent-core";

/**
 * Helper to build a minimal BeforeToolCallContext for testing.
 */
function makeCtx(
  finishArgs: Record<string, unknown>,
  messages: BeforeToolCallContext["context"]["messages"] = [],
): BeforeToolCallContext {
  return {
    assistantMessage: {
      role: "assistant",
      content: [{ type: "toolCall" as const, id: "tc_1", name: "finish", arguments: finishArgs }],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      usage: { input: 0, output: 0, cacheRead: 0 },
      stopReason: "toolCall",
      timestamp: Date.now(),
    },
    toolCall: { type: "toolCall" as const, id: "tc_1", name: "finish", arguments: finishArgs },
    args: finishArgs,
    context: {
      systemPrompt: "test",
      messages,
      tools: [],
    },
  };
}

/** Build a non-finish tool call context. */
function makeNonFinishCtx(): BeforeToolCallContext {
  return {
    ...makeCtx({}),
    toolCall: { type: "toolCall" as const, id: "tc_1", name: "read", arguments: { path: "foo" } },
  };
}

/** Build an assistant message containing a tool call. */
function assistantWithToolCall(name: string, args: Record<string, unknown> = {}): BeforeToolCallContext["context"]["messages"][0] {
  return {
    role: "assistant" as const,
    content: [{ type: "toolCall" as const, id: "tc_x", name, arguments: args }],
    api: "anthropic-messages",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    usage: { input: 0, output: 0, cacheRead: 0 },
    stopReason: "toolCall" as const,
    timestamp: Date.now(),
  };
}

describe("finish-guard", () => {
  const guard = createFinishGuard();

  it("allows non-finish tool calls through", async () => {
    const result = await guard(makeNonFinishCtx());
    expect(result).toBeUndefined();
  });

  it("allows finish with non-success status", async () => {
    const result = await guard(makeCtx({ status: "partial", summary: "incomplete" }));
    expect(result).toBeUndefined();
  });

  it("allows finish(success) with no deliverables", async () => {
    const result = await guard(makeCtx({ status: "success", summary: "done" }));
    expect(result).toBeUndefined();
  });

  it("allows finish(success) with empty deliverables array", async () => {
    const result = await guard(makeCtx({ status: "success", summary: "done", deliverables: [] }));
    expect(result).toBeUndefined();
  });

  it("blocks finish(success) with deliverables but no write evidence", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "wrote a file",
        deliverables: [{ path: "src/foo.ts", description: "new file" }],
      },
      [assistantWithToolCall("read", { path: "src/foo.ts" })],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("src/foo.ts");
    expect(result!.reason).toContain("no write, edit");
  });

  it("allows finish(success) with deliverables when write tool was used", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "wrote a file",
        deliverables: [{ path: "src/foo.ts", description: "new file" }],
      },
      [assistantWithToolCall("write", { path: "src/foo.ts", content: "hello" })],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows finish(success) with deliverables when edit tool was used", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "edited a file",
        deliverables: [{ path: "src/foo.ts", description: "updated file" }],
      },
      [assistantWithToolCall("edit", { path: "src/foo.ts", oldText: "a", newText: "b" })],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows finish(success) with deliverables when bash writes files", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "generated output",
        deliverables: [{ path: "output.txt", description: "generated" }],
      },
      [assistantWithToolCall("bash", { command: "echo hello > output.txt" })],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("blocks when bash was used but no write patterns detected", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "read stuff",
        deliverables: [{ path: "src/foo.ts", description: "new file" }],
      },
      [assistantWithToolCall("bash", { command: "cat src/foo.ts" })],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("allows when bash uses git commit", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "committed changes",
        deliverables: [{ path: "src/foo.ts", description: "committed" }],
      },
      [
        assistantWithToolCall("write", { path: "src/foo.ts", content: "x" }),
        assistantWithToolCall("bash", { command: "git commit -am 'feat: add foo'" }),
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("blocks finish(success) with deliverables when transcript is empty", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "magic",
        deliverables: [{ path: "src/foo.ts", description: "appeared from nowhere" }],
      },
      [], // empty transcript
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("allows finish(blocked) with deliverables (non-success)", async () => {
    const ctx = makeCtx({
      status: "blocked",
      summary: "stuck",
      deliverables: [{ path: "src/foo.ts", description: "partial" }],
      blockers: [{ reason: "API down", context: "tried 3 times" }],
    });
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });
});
