/**
 * Tests for completeness-guard.ts — createCompletenessGuard()
 *
 * Covers:
 * - Only blocks optimizer agent by default
 * - Only signals finish(status: "success")
 * - Detects write() evidence for DELIVERABLES_CHECKLIST
 * - Detects edit() evidence for DELIVERABLES_CHECKLIST
 * - Detects bash() write evidence for DELIVERABLES_CHECKLIST
 * - Ignores bash() read-only references
 * - Fail-open on errors
 * - Configurable: block vs warn, filename, agent list, callback
 */

import { describe, it, expect, vi } from "bun:test";
import { createCompletenessGuard } from "../src/lib/tools/completeness-guard.js";
import type { BeforeToolCallContext } from "../src/lib/tools/compose-guards.js";

// ─── Test Helpers ───────────────────────────────────────────────────

function makeCtx(
  toolName: string,
  args: Record<string, unknown>,
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [],
): BeforeToolCallContext {
  const messages: BeforeToolCallContext["context"]["messages"] = [];

  // Build transcript messages from toolCalls
  for (const tc of toolCalls) {
    messages.push({
      role: "assistant",
      content: [
        {
          type: "toolCall",
          name: tc.name,
          id: `tc_${Math.random().toString(36).slice(2)}`,
          arguments: tc.arguments,
        },
      ],
    });
    // Add a tool result message (realistic transcript)
    messages.push({
      role: "tool",
      content: "ok",
    });
  }

  return {
    toolCall: { name: toolName, id: "tc_finish_1" },
    args,
    context: { messages },
  };
}

function finishSuccess(
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [],
): BeforeToolCallContext {
  return makeCtx(
    "finish",
    { status: "success", summary: "Completed all deliverables" },
    toolCalls,
  );
}

// ─── Agent Targeting ────────────────────────────────────────────────

describe("createCompletenessGuard — agent targeting", () => {
  it("signals optimizer by default", async () => {
    const guard = createCompletenessGuard("optimizer");
    const result = await guard(finishSuccess());
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
    expect(result!.reason).toContain("COMPLETENESS");
  });

  it("does NOT block non-optimizer agents by default", async () => {
    const guard = createCompletenessGuard("coach");
    const result = await guard(finishSuccess());
    expect(result).toBeUndefined();
  });

  it("does NOT block scout by default", async () => {
    const guard = createCompletenessGuard("scout");
    const result = await guard(finishSuccess());
    expect(result).toBeUndefined();
  });

  it("respects custom agent list (string)", async () => {
    const guard = createCompletenessGuard("coach", { agents: "coach" });
    const result = await guard(finishSuccess());
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
  });

  it("respects custom agent list (array)", async () => {
    const guard = createCompletenessGuard("coach", { agents: ["coach", "coder"] });
    const result = await guard(finishSuccess());
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
  });

  it("custom agent list excludes non-listed agents", async () => {
    const guard = createCompletenessGuard("optimizer", { agents: ["coach", "coder"] });
    const result = await guard(finishSuccess());
    expect(result).toBeUndefined();
  });
});

// ─── Finish Status Filtering ────────────────────────────────────────

describe("createCompletenessGuard — finish status filtering", () => {
  it("only signals finish(status: success)", async () => {
    const guard = createCompletenessGuard("optimizer");
    const result = await guard(finishSuccess());
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
  });

  it("does NOT block finish(status: partial)", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = makeCtx("finish", { status: "partial", summary: "Some work done" });
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("does NOT block finish(status: failure)", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = makeCtx("finish", { status: "failure", summary: "Failed" });
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("does NOT block finish(status: blocked)", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = makeCtx("finish", { status: "blocked", summary: "Blocked" });
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("does NOT intercept non-finish tools", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = makeCtx("read", { path: "foo.md" });
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("does NOT intercept bash calls", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = makeCtx("bash", { command: "ls" });
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });
});

// ─── Checklist Detection: write() ───────────────────────────────────

describe("createCompletenessGuard — write() detection", () => {
  it("allows finish when write(DELIVERABLES_CHECKLIST.md) in transcript", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "write", arguments: { path: "DELIVERABLES_CHECKLIST.md", content: "# Checklist\n- item 1" } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows finish when write() path contains DELIVERABLES_CHECKLIST in subdirectory", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "write", arguments: { path: "workspace/DELIVERABLES_CHECKLIST.md", content: "checklist" } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("does NOT allow write to unrelated file", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "write", arguments: { path: "agents/optimizer/config.md", content: "config" } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
  });
});

// ─── Checklist Detection: edit() ────────────────────────────────────

describe("createCompletenessGuard — edit() detection", () => {
  it("allows finish when edit(DELIVERABLES_CHECKLIST.md) in transcript", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "edit", arguments: { path: "DELIVERABLES_CHECKLIST.md", oldText: "old", newText: "new" } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });
});

// ─── Checklist Detection: bash() ────────────────────────────────────

describe("createCompletenessGuard — bash() detection", () => {
  it("allows finish when bash writes to DELIVERABLES_CHECKLIST via redirect", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "bash", arguments: { command: 'echo "# Checklist" > DELIVERABLES_CHECKLIST.md' } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows finish when bash writes via tee to DELIVERABLES_CHECKLIST", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "bash", arguments: { command: 'echo "data" | tee DELIVERABLES_CHECKLIST.md' } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("allows finish when bash writes via cat redirect", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "bash", arguments: { command: 'cat > DELIVERABLES_CHECKLIST.md << EOF\nstuff\nEOF' } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("does NOT allow bash that only reads DELIVERABLES_CHECKLIST", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "bash", arguments: { command: "cat DELIVERABLES_CHECKLIST.md" } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
  });

  it("does NOT allow bash that greps DELIVERABLES_CHECKLIST", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "bash", arguments: { command: "grep -l DELIVERABLES_CHECKLIST *.md" } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
  });
});

// ─── Configurable Options ───────────────────────────────────────────

describe("createCompletenessGuard — configuration", () => {
  it("block: false returns warning instead of block", async () => {
    const guard = createCompletenessGuard("optimizer", { block: false });
    const result = await guard(finishSuccess());
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
    expect(result!.reason).toContain("COMPLETENESS");
  });

  it("custom checklistFileName", async () => {
    const guard = createCompletenessGuard("optimizer", { checklistFileName: "MY_CHECKLIST" });
    // Without checklist — blocks
    const result = await guard(finishSuccess());
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
    expect(result!.reason).toContain("MY_CHECKLIST");

    // With custom checklist — allows
    const ctx = finishSuccess([
      { name: "write", arguments: { path: "MY_CHECKLIST.md", content: "done" } },
    ]);
    const result2 = await guard(ctx);
    expect(result2).toBeUndefined();
  });

  it("onBlock callback is invoked", async () => {
    const onBlock = vi.fn();
    const guard = createCompletenessGuard("optimizer", { onBlock });
    await guard(finishSuccess());
    expect(onBlock).toHaveBeenCalledWith("optimizer", "tc_finish_1");
  });

  it("onBlock callback error does not break the guard", async () => {
    const onBlock = vi.fn(() => { throw new Error("callback boom"); });
    const guard = createCompletenessGuard("optimizer", { onBlock });
    const result = await guard(finishSuccess());
    // Guard still blocks despite callback error
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
    expect(onBlock).toHaveBeenCalled();
  });
});

// ─── Fail-Open Behavior ────────────────────────────────────────────

describe("createCompletenessGuard — fail-open", () => {
  it("allows through if messages are malformed", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx: BeforeToolCallContext = {
      toolCall: { name: "finish", id: "tc_1" },
      args: { status: "success", summary: "done" },
      context: {
        messages: [
          { role: "assistant", content: null as any }, // malformed
          { role: "assistant", content: "just a string" as any }, // not an array
        ],
      },
    };
    // Should not throw — fail-open
    const result = await guard(ctx);
    // Will block because no checklist found (malformed messages don't contain evidence)
    // But the point is it doesn't throw
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────

describe("createCompletenessGuard — edge cases", () => {
  it("allows when checklist is among many tool calls", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "read", arguments: { path: "workspace/brief.md" } },
      { name: "bash", arguments: { command: "ls -la" } },
      { name: "write", arguments: { path: "agents/optimizer/config.md", content: "timeout: 600" } },
      { name: "write", arguments: { path: "DELIVERABLES_CHECKLIST.md", content: "# Checklist" } },
      { name: "edit", arguments: { path: "agents/shared/philosophy.md", oldText: "old", newText: "new" } },
      { name: "read", arguments: { path: "DELIVERABLES_CHECKLIST.md" } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("signals when many tool calls but no checklist", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = finishSuccess([
      { name: "read", arguments: { path: "workspace/brief.md" } },
      { name: "write", arguments: { path: "agents/optimizer/config.md", content: "config" } },
      { name: "write", arguments: { path: "agents/optimizer/skills/batch.md", content: "skill" } },
      { name: "edit", arguments: { path: "agents/shared/philosophy.md", oldText: "old", newText: "new" } },
      { name: "read", arguments: { path: "agents/optimizer/LESSONS.md" } },
    ]);
    const result = await guard(ctx);
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
  });

  it("message contains helpful instructions", async () => {
    const guard = createCompletenessGuard("optimizer");
    const result = await guard(finishSuccess());
    expect(result!.reason).toContain("Lists every deliverable");
    expect(result!.reason).toContain("DONE / NOT DONE / BLOCKED");
    expect(result!.reason).toContain("write(");
  });

  it("handles finish with no status gracefully", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = makeCtx("finish", { summary: "done" });
    // No status → not "success" → not guarded
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });

  it("handles empty args gracefully", async () => {
    const guard = createCompletenessGuard("optimizer");
    const ctx = makeCtx("finish", {});
    const result = await guard(ctx);
    expect(result).toBeUndefined();
  });
});
