/**
 * Tests for verification-depth-guard.ts
 *
 * Validates the guard correctly detects superficial verification patterns
 * and blocks finish(status: "success") appropriately.
 */

import { describe, test, expect } from "vitest";
import { createVerificationDepthGuard } from "./verification-depth-guard.js";
import type { BeforeToolCallContext } from "./compose-guards.js";

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function makeToolCall(name: string, args: Record<string, unknown>): unknown {
  return {
    type: "toolCall",
    id: `call_${Math.random().toString(36).slice(2, 10)}`,
    name,
    arguments: args,
  };
}

function makeContext(toolCalls: Array<{ name: string; args: Record<string, unknown> }>): BeforeToolCallContext {
  const messages = toolCalls.map(tc => ({
    role: "assistant" as const,
    content: [makeToolCall(tc.name, tc.args)],
  }));

  return {
    toolCall: { name: "finish", id: "call_finish" },
    args: { status: "success" },
    context: { messages },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

describe("verification-depth-guard", () => {
  describe("basic behavior", () => {
    test("allows non-finish tool calls through", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx: BeforeToolCallContext = {
        toolCall: { name: "bash", id: "call_1" },
        args: { command: "ls" },
        context: { messages: [] },
      };
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("allows finish(status: 'partial') through", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx: BeforeToolCallContext = {
        toolCall: { name: "finish", id: "call_1" },
        args: { status: "partial" },
        context: { messages: [] },
      };
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("allows finish(status: 'failure') through", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx: BeforeToolCallContext = {
        toolCall: { name: "finish", id: "call_1" },
        args: { status: "failure" },
        context: { messages: [] },
      };
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("allows finish with no writes (analysis session)", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx = makeContext([
        { name: "read", args: { path: "agents/bob/todo.md" } },
        { name: "bash", args: { command: "ls agents/shared/" } },
      ]);
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("does not apply to non-targeted agents", async () => {
      const guard = createVerificationDepthGuard("bob", { agents: "optimizer" });
      const ctx = makeContext([
        { name: "write", args: { path: "test.md", content: "hello" } },
        // No verification — but guard shouldn't apply
      ]);
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });
  });

  describe("T1: git on gitignored paths", () => {
    test("blocks when only verification is git commands on agents/", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx = makeContext([
        { name: "edit", args: { path: "agents/shared/common-sense.md", oldText: "old", newText: "new" } },
        { name: "bash", args: { command: "git diff agents/shared/common-sense.md" } },
        { name: "bash", args: { command: "git status agents/shared/" } },
      ]);
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("T1-git-gitignored");
    });

    test("allows when real verification exists alongside git commands", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx = makeContext([
        { name: "edit", args: { path: "agents/shared/common-sense.md", oldText: "old", newText: "new" } },
        { name: "bash", args: { command: "git diff agents/shared/common-sense.md" } },
        { name: "read", args: { path: "agents/shared/common-sense.md" } }, // real verification
      ]);
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("single git command still triggers T2 (no meaningful post-write verification)", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx = makeContext([
        { name: "edit", args: { path: "agents/shared/common-sense.md", oldText: "old", newText: "new" } },
        { name: "bash", args: { command: "git status agents/shared/" } },
      ]);
      const result = await guard(ctx);
      // Even with one git command, git on agents/ isn't real verification,
      // so T2 fires because there's no post-write verification
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("T2-no-post-write-verification");
    });
  });

  describe("T2: no post-write verification", () => {
    test("blocks when write exists but no verification after", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx = makeContext([
        { name: "read", args: { path: "agents/bob/todo.md" } }, // pre-write read
        { name: "edit", args: { path: "agents/bob/todo.md", oldText: "old", newText: "new" } },
        // No post-write verification
      ]);
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("T2-no-post-write-verification");
    });

    test("allows when read() follows write()", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx = makeContext([
        { name: "write", args: { path: "agents/bob/todo.md", content: "new content" } },
        { name: "read", args: { path: "agents/bob/todo.md" } },
      ]);
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("allows when bash grep follows write()", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx = makeContext([
        { name: "edit", args: { path: "src/utils.ts", oldText: "old", newText: "new" } },
        { name: "bash", args: { command: "grep 'new' src/utils.ts" } },
      ]);
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("allows when test runner follows write()", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx = makeContext([
        { name: "edit", args: { path: "src/pricing.ts", oldText: "old", newText: "new" } },
        { name: "bash", args: { command: "node test-pricing.js" } },
      ]);
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("blocks when only verification is before the write (not after)", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx = makeContext([
        { name: "read", args: { path: "src/pricing.ts" } }, // pre-write read
        { name: "bash", args: { command: "node test-pricing.js" } }, // pre-write test
        { name: "edit", args: { path: "src/pricing.ts", oldText: "old", newText: "new" } },
        // No post-write verification!
      ]);
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });

    test("bash redirect is treated as write, not verification", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx = makeContext([
        { name: "edit", args: { path: "agents/bob/todo.md", oldText: "old", newText: "new" } },
        { name: "bash", args: { command: "echo 'done' >> agents/bob/journal.md" } },
        // The bash redirect is a write, not a verification
      ]);
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });
  });

  describe("warn mode", () => {
    test("warns instead of blocking when block=false", async () => {
      const guard = createVerificationDepthGuard("bob", { block: false });
      const ctx = makeContext([
        { name: "edit", args: { path: "agents/bob/todo.md", oldText: "old", newText: "new" } },
        // No post-write verification
      ]);
      const result = await guard(ctx);
      expect(result).toBeDefined();
      expect(result!.block).toBe(false);
    });
  });

  describe("onBlock callback", () => {
    test("fires onBlock when guard triggers", async () => {
      let captured: { agent: string; session: string; rule: string } | null = null;
      const guard = createVerificationDepthGuard("bob", {
        onBlock: (a, s, r) => { captured = { agent: a, session: s, rule: r }; },
      });
      const ctx = makeContext([
        { name: "write", args: { path: "test.md", content: "hello" } },
      ]);
      await guard(ctx);
      expect(captured).not.toBeNull();
      expect(captured!.agent).toBe("bob");
      expect(captured!.rule).toBe("T2-no-post-write-verification");
    });
  });

  describe("edge cases / fail-open", () => {
    test("handles empty transcript", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx: BeforeToolCallContext = {
        toolCall: { name: "finish", id: "call_1" },
        args: { status: "success" },
        context: { messages: [] },
      };
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("handles malformed message content", async () => {
      const guard = createVerificationDepthGuard("bob");
      const ctx: BeforeToolCallContext = {
        toolCall: { name: "finish", id: "call_1" },
        args: { status: "success" },
        context: {
          messages: [
            { role: "assistant", content: "just a string" },
            { role: "user", content: [makeToolCall("read", { path: "x" })] },
          ],
        },
      };
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });
  });
});
