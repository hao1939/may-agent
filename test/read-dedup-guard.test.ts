import { describe, it, expect } from "bun:test";
import { createReadDedupGuard, READ_WARN_THRESHOLD, READ_BLOCK_THRESHOLD } from "../src/lib/tools/read-dedup-guard.js";
import type { BeforeToolCallContext } from "@mariozechner/pi-agent-core";

/** Minimal BeforeToolCallContext for testing. */
function makeCtx(toolName: string, args: Record<string, unknown>): BeforeToolCallContext {
  return {
    toolCall: { id: "tc-1", name: toolName, arguments: args },
    args,
    context: { systemPrompt: "", messages: [], tools: [] },
  } as unknown as BeforeToolCallContext;
}

describe("read-dedup-guard", () => {
  it("allows first reads without warning", async () => {
    const guard = createReadDedupGuard();
    for (let i = 0; i < READ_WARN_THRESHOLD; i++) {
      const result = await guard(makeCtx("read", { path: "foo.md" }));
      expect(result).toBeUndefined();
    }
  });

  it("warns after WARN_THRESHOLD reads", async () => {
    const guard = createReadDedupGuard();
    // Exhaust threshold
    for (let i = 0; i < READ_WARN_THRESHOLD; i++) {
      await guard(makeCtx("read", { path: "signals.md" }));
    }
    // Next read should warn
    const result = await guard(makeCtx("read", { path: "signals.md" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
    expect(result!.reason).toContain("READ_DEDUP");
    expect(result!.reason).toContain("signals.md");
  });

  it("blocks after BLOCK_THRESHOLD reads", async () => {
    const guard = createReadDedupGuard();
    // Exhaust all allowed reads (warn + block thresholds)
    for (let i = 0; i < READ_BLOCK_THRESHOLD; i++) {
      await guard(makeCtx("read", { path: "signals.md" }));
    }
    // Next read should be blocked
    const result = await guard(makeCtx("read", { path: "signals.md" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("READ_DEDUP");
    expect(result!.reason).toContain("blocked");
  });

  it("tracks different paths independently", async () => {
    const guard = createReadDedupGuard();
    // Read file A up to threshold
    for (let i = 0; i < READ_BLOCK_THRESHOLD; i++) {
      await guard(makeCtx("read", { path: "a.md" }));
    }
    // File A should be blocked
    const resultA = await guard(makeCtx("read", { path: "a.md" }));
    expect(resultA!.block).toBe(true);

    // File B should still be allowed
    const resultB = await guard(makeCtx("read", { path: "b.md" }));
    expect(resultB).toBeUndefined();
  });

  it("normalizes paths — ./foo and foo are the same", async () => {
    const guard = createReadDedupGuard();
    // Mix path formats
    await guard(makeCtx("read", { path: "./signals.md" }));
    await guard(makeCtx("read", { path: "signals.md" }));
    await guard(makeCtx("read", { path: "./signals.md" }));
    // 4th read should warn
    const result = await guard(makeCtx("read", { path: "signals.md" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(false);
  });

  it("ignores non-read tools", async () => {
    const guard = createReadDedupGuard();
    const result = await guard(makeCtx("write", { path: "foo.md", content: "x" }));
    expect(result).toBeUndefined();
  });

  it("ignores read calls without a path", async () => {
    const guard = createReadDedupGuard();
    const result = await guard(makeCtx("read", {}));
    expect(result).toBeUndefined();
  });

  it("each guard instance is independent (per-session isolation)", async () => {
    const guard1 = createReadDedupGuard();
    const guard2 = createReadDedupGuard();
    // Exhaust guard1
    for (let i = 0; i < READ_BLOCK_THRESHOLD; i++) {
      await guard1(makeCtx("read", { path: "shared.md" }));
    }
    expect((await guard1(makeCtx("read", { path: "shared.md" })))!.block).toBe(true);
    // guard2 should be fresh
    expect(await guard2(makeCtx("read", { path: "shared.md" }))).toBeUndefined();
  });
});
