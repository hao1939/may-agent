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

/** Build an assistant message containing text content. */
function assistantWithText(text: string): BeforeToolCallContext["context"]["messages"][0] {
  return {
    role: "assistant" as const,
    content: [{ type: "text" as const, text }],
    api: "anthropic-messages",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    usage: { input: 0, output: 0, cacheRead: 0 },
    stopReason: "endTurn" as const,
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

  it("allows finish(success) with no deliverables and non-action summary", async () => {
    const result = await guard(makeCtx({ status: "success", summary: "Analyzed logs and found no issues" }));
    expect(result).toBeUndefined();
  });

  it("allows finish(success) with empty deliverables array and non-action summary", async () => {
    const result = await guard(makeCtx({ status: "success", summary: "No new work — early exit per cost guard.", deliverables: [] }));
    expect(result).toBeUndefined();
  });

  // === Ghost Deliverable Guard (FM-3.1 preventive) Tests ===

  it("blocks finish(success) with 'Fixed bug' summary but no file changes", async () => {
    const ctx = makeCtx(
      { status: "success", summary: "Fixed the authentication bug in login handler" },
      [assistantWithToolCall("read", { path: "src/auth.ts" })],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("FM-3.1 Ghost Deliverable");
    expect(result!.reason).toContain("Fixed the authentication bug");
  });

  it("blocks finish(success) with 'Implemented' summary but no file changes", async () => {
    const ctx = makeCtx(
      { status: "success", summary: "Implemented the new caching layer" },
      [assistantWithToolCall("read", { path: "src/cache.ts" })],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("FM-3.1 Ghost Deliverable");
  });

  it("blocks finish(success) with 'Refactored' summary but no file changes", async () => {
    const ctx = makeCtx(
      { status: "success", summary: "Refactored the database module for clarity" },
      [],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("FM-3.1 Ghost Deliverable");
  });

  it("allows 'Fixed' summary when write evidence exists", async () => {
    const ctx = makeCtx(
      { status: "success", summary: "Fixed the authentication bug" },
      [
        assistantWithToolCall("edit", { path: "src/auth.ts", oldText: "a", newText: "b" }),
        assistantWithToolCall("read", { path: "src/auth.ts" }),
      ],
    );
    // No deliverables listed — but has write evidence, ghost guard doesn't fire
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows 'Updated' summary when bash write evidence exists", async () => {
    const ctx = makeCtx(
      { status: "success", summary: "Updated the config file" },
      [
        assistantWithToolCall("bash", { command: "echo 'new config' > config.json" }),
        assistantWithToolCall("bash", { command: "cat config.json" }),
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows 'Verified everything works' phrasing without file changes", async () => {
    const ctx = makeCtx(
      { status: "success", summary: "Verified the existing behavior is correct, no changes needed" },
      [assistantWithToolCall("read", { path: "src/auth.ts" })],
    );
    // "Verified" is NOT in the ghost keyword list — this should pass
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("blocks 'Deleted old module' summary but no file changes", async () => {
    const ctx = makeCtx(
      { status: "success", summary: "Deleted the deprecated logging module" },
      [assistantWithToolCall("read", { path: "src/old-logger.ts" })],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("FM-3.1 Ghost Deliverable");
  });

  it("blocks 'Added new feature' summary with no deliverables and no writes", async () => {
    const ctx = makeCtx(
      { status: "success", summary: "Added retry logic to the API client" },
      [],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("does not block ghost guard when deliverables ARE listed (falls through to Gate 1)", async () => {
    // If deliverables are listed, the ghost guard should not fire — Gate 1 handles it
    const ctx = makeCtx(
      {
        status: "success",
        summary: "Fixed the bug",
        deliverables: [{ path: "src/foo.ts", description: "fixed" }],
      },
      [assistantWithToolCall("read", { path: "src/foo.ts" })],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    // Should be Gate 1 (write evidence), not Gate 0 (ghost)
    expect(result!.reason).not.toContain("Ghost Deliverable");
    expect(result!.reason).toContain("no write, edit");
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

  it("allows finish(success) with deliverables when write tool was used and verified", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "wrote a file",
        deliverables: [{ path: "src/foo.ts", description: "new file" }],
      },
      [
        assistantWithToolCall("write", { path: "src/foo.ts", content: "hello" }),
        assistantWithToolCall("read", { path: "src/foo.ts" }),
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows finish(success) with deliverables when edit tool was used and verified", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "edited a file",
        deliverables: [{ path: "src/foo.ts", description: "updated file" }],
      },
      [
        assistantWithToolCall("edit", { path: "src/foo.ts", oldText: "a", newText: "b" }),
        assistantWithToolCall("read", { path: "src/foo.ts" }),
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows finish(success) with deliverables when bash writes files and verified", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "generated output",
        deliverables: [{ path: "output.txt", description: "generated" }],
      },
      [
        assistantWithToolCall("bash", { command: "echo hello > output.txt" }),
        assistantWithToolCall("bash", { command: "cat output.txt" }),
      ],
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

  it("allows when bash uses git commit with verification", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "committed changes",
        deliverables: [{ path: "src/foo.ts", description: "committed" }],
      },
      [
        assistantWithToolCall("write", { path: "src/foo.ts", content: "x" }),
        assistantWithToolCall("bash", { command: "git commit -am 'feat: add foo'" }),
        assistantWithToolCall("bash", { command: "git diff HEAD~1 --stat" }),
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

  // === FM-3.3 Verification Guard Tests ===

  it("blocks finish(success) when write exists but no verification after it", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "wrote a file",
        deliverables: [{ path: "src/foo.ts", description: "new file" }],
      },
      [assistantWithToolCall("write", { path: "src/foo.ts", content: "hello" })],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("FM-3.3");
    expect(result!.reason).toContain("no verification AFTER");
  });

  it("blocks finish(success) when edit exists but no verification after it", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "edited a file",
        deliverables: [{ path: "src/foo.ts", description: "updated file" }],
      },
      [assistantWithToolCall("edit", { path: "src/foo.ts", oldText: "a", newText: "b" })],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("FM-3.3");
  });

  it("blocks when verification exists BEFORE but not AFTER last write", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "wrote two files",
        deliverables: [{ path: "src/foo.ts", description: "new file" }],
      },
      [
        assistantWithToolCall("write", { path: "src/foo.ts", content: "v1" }),
        assistantWithToolCall("read", { path: "src/foo.ts" }),  // verification for first write
        assistantWithToolCall("write", { path: "src/foo.ts", content: "v2" }),  // second write — no verification after
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("FM-3.3");
  });

  it("allows when verification exists after the LAST write in multi-write sequence", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "wrote two files",
        deliverables: [{ path: "src/foo.ts", description: "new file" }],
      },
      [
        assistantWithToolCall("write", { path: "src/foo.ts", content: "v1" }),
        assistantWithToolCall("write", { path: "src/foo.ts", content: "v2" }),
        assistantWithToolCall("read", { path: "src/foo.ts" }),  // verification after last write
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows bash test commands as verification after write", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "wrote and tested",
        deliverables: [{ path: "src/foo.ts", description: "new file" }],
      },
      [
        assistantWithToolCall("write", { path: "src/foo.ts", content: "hello" }),
        assistantWithToolCall("bash", { command: "vitest --run test/foo.test.ts" }),
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows tsc as verification after edit", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "edited and type-checked",
        deliverables: [{ path: "src/foo.ts", description: "updated" }],
      },
      [
        assistantWithToolCall("edit", { path: "src/foo.ts", oldText: "a", newText: "b" }),
        assistantWithToolCall("bash", { command: "tsc --noEmit" }),
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows ls -la as verification after write", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "wrote and checked",
        deliverables: [{ path: "output.txt", description: "new file" }],
      },
      [
        assistantWithToolCall("write", { path: "output.txt", content: "data" }),
        assistantWithToolCall("bash", { command: "ls -la output.txt && wc -l output.txt" }),
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("blocks when bash after write is not a verification command", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "wrote stuff",
        deliverables: [{ path: "src/foo.ts", description: "new file" }],
      },
      [
        assistantWithToolCall("write", { path: "src/foo.ts", content: "hello" }),
        assistantWithToolCall("bash", { command: "echo done" }),
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("FM-3.3");
  });

  it("allows bash redirect write + cat verification", async () => {
    const ctx = makeCtx(
      {
        status: "success",
        summary: "generated output",
        deliverables: [{ path: "output.txt", description: "generated" }],
      },
      [
        assistantWithToolCall("bash", { command: "echo hello > output.txt" }),
        assistantWithToolCall("bash", { command: "cat output.txt" }),
      ],
    );
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("does not require verification for finish(partial) with deliverables", async () => {
    const ctx = makeCtx({
      status: "partial",
      summary: "partial work",
      deliverables: [{ path: "src/foo.ts", description: "partial" }],
      next_steps: "finish the work",
    });
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  // === Gate 3b: Transcript Contradiction Guard Tests ===

  describe("Gate 3b — Transcript Contradiction", () => {
    it("blocks finish(success) when transcript says 'file is missing'", async () => {
      const ctx = makeCtx(
        { status: "success", summary: "Analyzed the project and reported findings" },
        [
          assistantWithText("I checked the directory and etl-output.json file is missing from the expected location."),
        ],
      );
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("Transcript Contradiction");
    });

    it("blocks finish(success) when transcript says 'missing file'", async () => {
      const ctx = makeCtx(
        { status: "success", summary: "Completed analysis successfully" },
        [
          assistantWithText("There is a missing file that the pipeline depends on."),
        ],
      );
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("Transcript Contradiction");
    });

    it("blocks finish(success) when transcript says 'cannot proceed without'", async () => {
      const ctx = makeCtx(
        { status: "success", summary: "Investigated the issue thoroughly" },
        [
          assistantWithText("We cannot proceed without the database credentials file."),
        ],
      );
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("Transcript Contradiction");
    });

    it("blocks finish(success) when transcript says 'no such file'", async () => {
      const ctx = makeCtx(
        { status: "success", summary: "Reviewed all project dependencies" },
        [
          assistantWithText("The error indicates no such file or directory for config.yaml."),
        ],
      );
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("Transcript Contradiction");
    });

    it("blocks finish(success) when transcript says 'required X is missing'", async () => {
      const ctx = makeCtx(
        { status: "success", summary: "Examined the build pipeline" },
        [
          assistantWithText("The required input data is missing from the staging directory."),
        ],
      );
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("Transcript Contradiction");
    });

    it("allows finish(success) when transcript has no blocker language", async () => {
      const ctx = makeCtx(
        { status: "success", summary: "Analyzed the project and reported findings" },
        [
          assistantWithText("I read the configuration file and it looks correct. All dependencies are present."),
        ],
      );
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    it("allows finish(blocked) even when transcript has blocker language", async () => {
      const ctx = makeCtx(
        { status: "blocked", summary: "Missing prerequisite", blockers: [{ reason: "file missing", context: "etl-output.json" }] },
        [
          assistantWithText("The required file is missing from the directory."),
        ],
      );
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    it("allows finish(partial) even when transcript has blocker language", async () => {
      const ctx = makeCtx(
        { status: "partial", summary: "Found missing dependency", next_steps: "Wait for file" },
        [
          assistantWithText("The etl-output.json file is missing."),
        ],
      );
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    it("handles mixed content blocks (text + toolCall)", async () => {
      const ctx = makeCtx(
        { status: "success", summary: "Completed the analysis" },
        [
          {
            role: "assistant" as const,
            content: [
              { type: "text" as const, text: "Let me check... the file is missing from the directory." },
              { type: "toolCall" as const, id: "tc_x", name: "bash", arguments: { command: "ls -la" } },
            ],
            api: "anthropic-messages" as const,
            provider: "anthropic" as const,
            model: "claude-sonnet-4-20250514",
            usage: { input: 0, output: 0, cacheRead: 0 },
            stopReason: "toolCall" as const,
            timestamp: Date.now(),
          },
        ],
      );
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("Transcript Contradiction");
    });

    it("does not false-positive on normal 'missing' usage unrelated to files", async () => {
      const ctx = makeCtx(
        { status: "success", summary: "Reviewed the codebase" },
        [
          assistantWithText("The function is missing a return type annotation, which I added."),
        ],
      );
      const result = await guard(ctx);
      // "missing a return type" doesn't match the patterns (no "missing file/dependency/prerequisite")
      expect(result).toBeUndefined();
    });
  });
});
