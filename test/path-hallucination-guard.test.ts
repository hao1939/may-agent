import { describe, it, expect } from "vitest";
import { createPathHallucinationGuard } from "../src/lib/tools/path-hallucination-guard.js";
import type { BeforeToolCallContext } from "../src/lib/tools/compose-guards.js";

/** Minimal BeforeToolCallContext for testing. */
function makeCtx(toolName: string, args: Record<string, unknown>): BeforeToolCallContext {
  return {
    toolCall: { id: "tc-1", name: toolName, arguments: args },
    args,
    context: { systemPrompt: "", messages: [], tools: [] },
  } as unknown as BeforeToolCallContext;
}

describe("path-hallucination-guard", () => {
  // ── bash tool — blocked patterns ───────────────────────

  it("blocks bash with /home/<user> path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("bash", { command: "cat /home/alice/file.txt" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("PATH_HALLUCINATION");
    expect(result!.reason).toContain("/home/<user>");
  });

  it("blocks bash with /Users/<user> path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("bash", { command: "ls /Users/bob/Documents" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("PATH_HALLUCINATION");
    expect(result!.reason).toContain("/Users/<user>");
  });

  it("blocks bash with ~/ path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("bash", { command: "cat ~/config.yml" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("PATH_HALLUCINATION");
    expect(result!.reason).toContain("~/");
  });

  it("blocks bash with /var/tmp/repos/ path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("bash", { command: "cd /var/tmp/repos/myproject && ls" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("PATH_HALLUCINATION");
    expect(result!.reason).toContain("/var/tmp/repos/");
  });

  // ── read tool — blocked patterns ───────────────────────

  it("blocks read with /home/<user> path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("read", { path: "/home/charlie/.bashrc" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("PATH_HALLUCINATION");
  });

  it("blocks read with /Users/<user> path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("read", { path: "/Users/dave/project/src/index.ts" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  // ── edit tool — blocked patterns ───────────────────────

  it("blocks edit with hallucinated path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(
      makeCtx("edit", { path: "/home/user/app/main.ts", oldText: "a", newText: "b" }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("PATH_HALLUCINATION");
  });

  // ── write tool — blocked patterns ──────────────────────

  it("blocks write with hallucinated path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(
      makeCtx("write", { path: "/Users/me/output.txt", content: "hello" }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("PATH_HALLUCINATION");
  });

  // ── allowed paths ─────────────────────────────────────

  it("allows bash with normal command", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("bash", { command: "ls -la /app/src" }));
    expect(result).toBeUndefined();
  });

  it("allows bash with relative path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("bash", { command: "cat src/lib/manager.ts" }));
    expect(result).toBeUndefined();
  });

  it("allows read with relative path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("read", { path: "src/lib/manager.ts" }));
    expect(result).toBeUndefined();
  });

  it("allows read with /app/ path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("read", { path: "/app/src/index.ts" }));
    expect(result).toBeUndefined();
  });

  it("allows edit with relative path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("edit", { path: "src/foo.ts", oldText: "a", newText: "b" }));
    expect(result).toBeUndefined();
  });

  it("allows write with relative path", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("write", { path: "output.txt", content: "hello" }));
    expect(result).toBeUndefined();
  });

  // ── unchecked tools ────────────────────────────────────

  it("allows unknown tools without checking", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("custom_tool", { path: "/home/user/bad" }));
    expect(result).toBeUndefined();
  });

  it("allows agents tool even with bad-looking args", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("agents", { action: "list" }));
    expect(result).toBeUndefined();
  });

  it("allows finish tool", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("finish", { status: "success" }));
    expect(result).toBeUndefined();
  });

  // ── edge cases ─────────────────────────────────────────

  it("allows bash with no command arg (undefined)", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("bash", {}));
    expect(result).toBeUndefined();
  });

  it("allows read with no path arg (undefined)", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("read", {}));
    expect(result).toBeUndefined();
  });

  it("allows bash with non-string command", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("bash", { command: 42 }));
    expect(result).toBeUndefined();
  });

  it("includes coaching message about /app and ls/find", async () => {
    const guard = createPathHallucinationGuard();
    const result = await guard(makeCtx("bash", { command: "cat /home/user/file.txt" }));
    expect(result).toBeDefined();
    expect(result!.reason).toContain("/app");
    expect(result!.reason).toMatch(/ls|find/);
  });

  // ── stateless behavior ─────────────────────────────────

  it("is stateless — same guard instance works for multiple calls", async () => {
    const guard = createPathHallucinationGuard();
    // First call: blocked
    const r1 = await guard(makeCtx("bash", { command: "cat /home/user/x" }));
    expect(r1!.block).toBe(true);
    // Second call: allowed
    const r2 = await guard(makeCtx("bash", { command: "ls /app" }));
    expect(r2).toBeUndefined();
    // Third call: blocked again
    const r3 = await guard(makeCtx("read", { path: "/Users/someone/file.ts" }));
    expect(r3!.block).toBe(true);
  });
});
