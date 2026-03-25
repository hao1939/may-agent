import { describe, it, expect } from "vitest";
import { createPathAssumptionGuard } from "../src/lib/tools/path-assumption-guard.js";
import type { BeforeToolCallContext } from "../src/lib/tools/compose-guards.js";

function makeCtx(toolName: string, args: Record<string, unknown>): BeforeToolCallContext {
  return {
    toolCall: { name: toolName, id: "test-1" },
    args,
    context: { messages: [] },
  };
}

describe("path-assumption-guard", () => {
  const guard = createPathAssumptionGuard();

  // ── BLOCK: invalid paths ──

  it("blocks bash with /Users/ path", async () => {
    const result = await guard(makeCtx("bash", { command: "cd /Users/jk/aijudge && ls" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("PATH_ASSUMPTION");
    expect(result!.reason).toContain("/Users/");
  });

  it("blocks bash with /home/user path", async () => {
    const result = await guard(makeCtx("bash", { command: "cd /home/user && npm test" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("/home/");
  });

  it("blocks bash with ~/path", async () => {
    const result = await guard(makeCtx("bash", { command: "cat ~/Documents/notes.txt" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("~/");
  });

  it("blocks bash with /root/ path", async () => {
    const result = await guard(makeCtx("bash", { command: "ls /root/.config/" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("blocks read with /Users/ path", async () => {
    const result = await guard(makeCtx("read", { path: "/Users/jk/aijudge/src/index.ts" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("PATH_ASSUMPTION");
    // Should suggest corrected path
    expect(result!.reason).toContain("src/index.ts");
  });

  it("blocks edit with /home/user path", async () => {
    const result = await guard(makeCtx("edit", {
      path: "/home/user/project/config.json",
      oldText: "old",
      newText: "new",
    }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("blocks write with /home/user path", async () => {
    const result = await guard(makeCtx("write", {
      path: "/home/user/output.txt",
      content: "hello",
    }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  // ── ALLOW: valid paths ──

  it("allows bash with relative path", async () => {
    const result = await guard(makeCtx("bash", { command: "ls src/lib/" }));
    expect(result).toBeUndefined();
  });

  it("allows bash with /app/ path", async () => {
    const result = await guard(makeCtx("bash", { command: "cd /app && ls" }));
    expect(result).toBeUndefined();
  });

  it("allows bash with system path (/usr/bin)", async () => {
    const result = await guard(makeCtx("bash", { command: "which node" }));
    expect(result).toBeUndefined();
  });

  it("allows bash with /tmp/ path", async () => {
    const result = await guard(makeCtx("bash", { command: "cat /tmp/output.log" }));
    expect(result).toBeUndefined();
  });

  it("allows read with relative path", async () => {
    const result = await guard(makeCtx("read", { path: "src/lib/tools/bash.ts" }));
    expect(result).toBeUndefined();
  });

  it("allows read with /app/ absolute path", async () => {
    const result = await guard(makeCtx("read", { path: "/app/src/lib/tools/bash.ts" }));
    expect(result).toBeUndefined();
  });

  it("allows edit with relative path", async () => {
    const result = await guard(makeCtx("edit", {
      path: "agents/optimizer/workspace/todo.md",
      oldText: "old",
      newText: "new",
    }));
    expect(result).toBeUndefined();
  });

  it("allows write with relative path", async () => {
    const result = await guard(makeCtx("write", {
      path: "agents/optimizer/workspace/output.md",
      content: "data",
    }));
    expect(result).toBeUndefined();
  });

  // ── ALLOW: non-guarded tools ──

  it("allows non-guarded tools (agents)", async () => {
    const result = await guard(makeCtx("agents", { action: "list" }));
    expect(result).toBeUndefined();
  });

  it("allows non-guarded tools (finish)", async () => {
    const result = await guard(makeCtx("finish", { status: "success", summary: "done" }));
    expect(result).toBeUndefined();
  });

  // ── Edge cases ──

  it("allows bash with missing command", async () => {
    // Empty-args guard handles this, not path guard
    const result = await guard(makeCtx("bash", {}));
    expect(result).toBeUndefined();
  });

  it("allows read with missing path", async () => {
    const result = await guard(makeCtx("read", {}));
    expect(result).toBeUndefined();
  });

  it("suggests corrected path for /Users/user/project/deep/path.ts", async () => {
    const result = await guard(makeCtx("read", { path: "/Users/alice/myproject/deep/path.ts" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    // Should suggest the relative portion after /Users/alice/myproject/
    expect(result!.reason).toContain("deep/path.ts");
  });

  it("suggests corrected path for /home/user/src/app.js", async () => {
    const result = await guard(makeCtx("read", { path: "/home/user/src/app.js" }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("src/app.js");
  });
});
