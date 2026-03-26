/**
 * Tests for harness-level guards: BinaryGuard, WorkVerifyGuard, ToolSyntaxGuard.
 */
import { describe, it, expect } from "vitest";
import { createBinaryGuard } from "../src/lib/guards/binary-guard.js";
import { createWorkVerifyGuard } from "../src/lib/guards/work-verify-guard.js";
import { createToolSyntaxGuard } from "../src/lib/guards/tool-syntax-guard.js";

function makeCtx(toolName: string, args: Record<string, unknown>, messages: any[] = []) {
  return {
    toolCall: { name: toolName, id: "test-id" },
    args,
    context: { messages },
  };
}

describe("BinaryGuard", () => {
  const guard = createBinaryGuard();

  it("blocks read on .bin files", async () => {
    const result = await guard(makeCtx("read", { path: "data/binary.bin" }));
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("BINARY_FILE");
  });

  it("blocks edit on .exe files", async () => {
    const result = await guard(makeCtx("edit", { path: "app.exe", oldText: "x", newText: "y" }));
    expect(result?.block).toBe(true);
  });

  it("allows read on .ts files", async () => {
    const result = await guard(makeCtx("read", { path: "src/index.ts" }));
    expect(result).toBeUndefined();
  });

  it("allows read on .md files", async () => {
    const result = await guard(makeCtx("read", { path: "README.md" }));
    expect(result).toBeUndefined();
  });

  it("ignores non-read/edit tools", async () => {
    const result = await guard(makeCtx("bash", { command: "cat binary.bin" }));
    expect(result).toBeUndefined();
  });

  it("blocks read on .png files", async () => {
    const result = await guard(makeCtx("read", { path: "image.png" }));
    expect(result?.block).toBe(true);
  });
});

describe("WorkVerifyGuard", () => {
  const guard = createWorkVerifyGuard();

  function assistantMsg(toolCalls: string[]) {
    return {
      role: "assistant",
      content: toolCalls.map((name) => ({ type: "toolCall", name, id: `call-${name}` })),
    };
  }

  function toolResultMsg(name: string) {
    return {
      role: "tool",
      content: [{ type: "toolResult", toolCallId: `call-${name}`, result: "ok" }],
    };
  }

  it("allows finish when no edits were made", async () => {
    const messages = [
      assistantMsg(["read"]),
      toolResultMsg("read"),
      assistantMsg(["bash"]),
      toolResultMsg("bash"),
    ];
    const result = await guard(makeCtx("finish", {}, messages));
    expect(result).toBeUndefined();
  });

  it("blocks finish when edit happened but no bash after", async () => {
    const messages = [
      assistantMsg(["read"]),
      toolResultMsg("read"),
      assistantMsg(["edit"]),
      toolResultMsg("edit"),
    ];
    const result = await guard(makeCtx("finish", {}, messages));
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("WORK_VERIFY");
  });

  it("allows finish when bash happened after edit", async () => {
    const messages = [
      assistantMsg(["edit"]),
      toolResultMsg("edit"),
      assistantMsg(["bash"]),
      toolResultMsg("bash"),
    ];
    const result = await guard(makeCtx("finish", {}, messages));
    expect(result).toBeUndefined();
  });

  it("blocks finish when write happened but no bash after", async () => {
    const messages = [
      assistantMsg(["bash"]),
      toolResultMsg("bash"),
      assistantMsg(["write"]),
      toolResultMsg("write"),
    ];
    const result = await guard(makeCtx("finish", {}, messages));
    expect(result?.block).toBe(true);
  });

  it("ignores non-finish tools", async () => {
    const result = await guard(makeCtx("bash", { command: "ls" }));
    expect(result).toBeUndefined();
  });
});

describe("ToolSyntaxGuard", () => {
  const guard = createToolSyntaxGuard();

  it("blocks bare cat command", async () => {
    const result = await guard(makeCtx("bash", { command: "cat file.txt" }));
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("TOOL_SYNTAX");
  });

  it("blocks bare head command", async () => {
    const result = await guard(makeCtx("bash", { command: "head -20 file.txt" }));
    expect(result?.block).toBe(true);
  });

  it("blocks vim command", async () => {
    const result = await guard(makeCtx("bash", { command: "vim config.json" }));
    expect(result?.block).toBe(true);
  });

  it("allows cat in a pipe", async () => {
    const result = await guard(makeCtx("bash", { command: "cat file.txt | grep pattern" }));
    expect(result).toBeUndefined();
  });

  it("allows cat with redirect", async () => {
    const result = await guard(makeCtx("bash", { command: "cat > output.txt" }));
    expect(result).toBeUndefined();
  });

  it("allows non-cat bash commands", async () => {
    const result = await guard(makeCtx("bash", { command: "ls -la src/" }));
    expect(result).toBeUndefined();
  });

  it("ignores non-bash tools", async () => {
    const result = await guard(makeCtx("read", { path: "file.txt" }));
    expect(result).toBeUndefined();
  });

  it("allows grep (not blocked)", async () => {
    const result = await guard(makeCtx("bash", { command: "grep -r TODO src/" }));
    expect(result).toBeUndefined();
  });

  it("does not match partial command names like 'catalog'", async () => {
    const result = await guard(makeCtx("bash", { command: "catalog items" }));
    expect(result).toBeUndefined();
  });
});
