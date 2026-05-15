import { describe, it, expect } from "bun:test";
import { createEmptyArgsGuard } from "../src/lib/tools/empty-args-guard.js";
import type { BeforeToolCallContext } from "@mariozechner/pi-agent-core";

/** Minimal BeforeToolCallContext for testing. */
function makeCtx(toolName: string, args: Record<string, unknown>): BeforeToolCallContext {
  return {
    toolCall: { id: "tc-1", name: toolName, arguments: args },
    args,
    context: { systemPrompt: "", messages: [], tools: [] },
  } as unknown as BeforeToolCallContext;
}

describe("empty-args-guard", () => {
  // ── read tool ──────────────────────────────────────────

  it("allows read with path", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("read", { path: "foo.md" }));
    expect(result).toBeUndefined();
  });

  it("blocks read with no args", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("read", {}));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("EMPTY_ARGS");
    expect(result!.reason).toContain("path");
  });

  it("blocks read with empty path", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("read", { path: "" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("path");
  });

  it("blocks read with null path", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("read", { path: null }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  // ── bash tool ──────────────────────────────────────────

  it("allows bash with command", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("bash", { command: "ls -la" }));
    expect(result).toBeUndefined();
  });

  it("blocks bash with no args", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("bash", {}));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("EMPTY_ARGS");
    expect(result!.reason).toContain("command");
  });

  it("blocks bash with empty command", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("bash", { command: "" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  // ── edit tool ──────────────────────────────────────────

  it("allows edit with all required params", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("edit", { path: "f.ts", oldText: "a", newText: "b" }));
    expect(result).toBeUndefined();
  });

  it("blocks edit with missing oldText", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("edit", { path: "f.ts", newText: "b" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("oldText");
  });

  it("allows edit with empty newText (deletion is valid)", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("edit", { path: "f.ts", oldText: "a", newText: "" }));
    // Empty newText is intentionally allowed — it means "delete this text"
    expect(result).toBeUndefined();
  });

  // ── write tool ─────────────────────────────────────────

  it("allows write with path and content", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("write", { path: "f.md", content: "hello" }));
    expect(result).toBeUndefined();
  });

  it("blocks write with missing content", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("write", { path: "f.md" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("content");
  });

  // ── unknown tools ──────────────────────────────────────

  it("allows unknown tools without checking", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("custom_tool", {}));
    expect(result).toBeUndefined();
  });

  it("allows agents tool (not in required list)", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("agents", { action: "list" }));
    expect(result).toBeUndefined();
  });

  // ── multiple missing params ────────────────────────────

  it("reports all missing params for edit with no args", async () => {
    const guard = createEmptyArgsGuard();
    const result = await guard(makeCtx("edit", {}));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("path");
    expect(result!.reason).toContain("oldText");
    // newText is not required (empty string = deletion)
  });

  // ── stateless behavior ─────────────────────────────────

  it("is stateless - same guard instance works for multiple calls", async () => {
    const guard = createEmptyArgsGuard();
    // First call: blocked
    const r1 = await guard(makeCtx("read", {}));
    expect(r1!.block).toBe(true);
    // Second call: allowed
    const r2 = await guard(makeCtx("read", { path: "foo.md" }));
    expect(r2).toBeUndefined();
    // Third call: blocked again
    const r3 = await guard(makeCtx("bash", {}));
    expect(r3!.block).toBe(true);
  });
});
