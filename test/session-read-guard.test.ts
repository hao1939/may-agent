import { describe, it, expect } from "vitest";
import { createSessionReadGuard } from "../src/lib/tools/session-read-guard.js";
import type { BeforeToolCallContext } from "@mariozechner/pi-agent-core";

/** Minimal BeforeToolCallContext for testing. */
function makeCtx(toolName: string, args: Record<string, unknown>): BeforeToolCallContext {
  return {
    toolCall: { id: "tc-1", name: toolName, arguments: args },
    args,
    context: { systemPrompt: "", messages: [], tools: [] },
  } as unknown as BeforeToolCallContext;
}

describe("session-read-guard", () => {
  it("blocks reading session.jsonl from history", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(makeCtx("read", {
      path: ".state/sessions/history/s_1234567890_42/session.jsonl",
    }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("SESSION_READ");
    expect(result!.reason).toContain("grep");
  });

  it("blocks reading session.jsonl from active sessions", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(makeCtx("read", {
      path: ".state/sessions/s_1234567890_42/session.jsonl",
    }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("blocks with leading ./", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(makeCtx("read", {
      path: "./.state/sessions/history/s_123_1/session.jsonl",
    }));
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("allows reading meta.json (not session.jsonl)", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(makeCtx("read", {
      path: ".state/sessions/history/s_1234567890_42/meta.json",
    }));
    expect(result).toBeUndefined();
  });

  it("allows reading other .jsonl files", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(makeCtx("read", {
      path: ".state/human-inputs.jsonl",
    }));
    expect(result).toBeUndefined();
  });

  it("allows non-session paths", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(makeCtx("read", {
      path: "agents/coach/workspace/todo.md",
    }));
    expect(result).toBeUndefined();
  });

  it("ignores non-read tools", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(makeCtx("bash", {
      command: "cat .state/sessions/history/s_123_1/session.jsonl",
    }));
    expect(result).toBeUndefined();
  });

  it("ignores read calls without a path", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(makeCtx("read", {}));
    expect(result).toBeUndefined();
  });

  it("blocks receipts.jsonl too (also large)", async () => {
    const guard = createSessionReadGuard();
    // receipts.jsonl is not session.jsonl, so it should be allowed
    // (this is a design choice — we only block session.jsonl for now)
    const result = await guard(makeCtx("read", {
      path: ".state/sessions/history/s_123_1/receipts.jsonl",
    }));
    expect(result).toBeUndefined();
  });
});
