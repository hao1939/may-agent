import { describe, it, expect } from "bun:test";
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
  // ──────────────────────────────────────────────────────────────
  // Guard 1: read() tool
  // ──────────────────────────────────────────────────────────────

  it("blocks reading session.jsonl from history", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("read", {
        path: ".state/sessions/history/s_1234567890_42/session.jsonl",
      }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("SESSION_READ");
    expect(result!.reason).toContain("grep");
  });

  it("blocks reading session.jsonl from active sessions", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("read", {
        path: ".state/sessions/s_1234567890_42/session.jsonl",
      }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("blocks with leading ./", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("read", {
        path: "./.state/sessions/history/s_123_1/session.jsonl",
      }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("allows reading meta.json (not session.jsonl)", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("read", {
        path: ".state/sessions/history/s_1234567890_42/meta.json",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("allows reading other .jsonl files", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("read", {
        path: ".state/human-inputs.jsonl",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("allows non-session paths", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("read", {
        path: "agents/coach/workspace/todo.md",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("ignores read calls without a path", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(makeCtx("read", {}));
    expect(result).toBeUndefined();
  });

  it("allows receipts.jsonl (not session.jsonl)", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("read", {
        path: ".state/sessions/history/s_123_1/receipts.jsonl",
      }),
    );
    expect(result).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────
  // Guard 2: bash tool — cat/less/more
  // ──────────────────────────────────────────────────────────────

  it("blocks bash cat of session.jsonl", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "cat .state/sessions/history/s_123_1/session.jsonl",
      }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("SESSION_BASH_CAT");
  });

  it("blocks bash less of session.jsonl", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "less .state/sessions/history/s_123_1/session.jsonl",
      }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("SESSION_BASH_CAT");
  });

  it("blocks cat even with flags", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "cat -n .state/sessions/history/s_123_1/session.jsonl",
      }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // Guard 2: bash tool — unbounded grep
  // ──────────────────────────────────────────────────────────────

  it("blocks unbounded grep of session.jsonl", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep 'pattern' .state/sessions/history/s_123_1/session.jsonl",
      }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("SESSION_BASH_GREP");
  });

  it("blocks unbounded grep with wildcards", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep 'error' .state/sessions/history/*/session.jsonl",
      }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("blocks unbounded rg of session.jsonl", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "rg 'pattern' .state/sessions/history/s_123_1/session.jsonl",
      }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // Guard 2: bash tool — bounded grep (ALLOWED)
  // ──────────────────────────────────────────────────────────────

  it("allows grep piped to head", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep 'pattern' .state/sessions/history/s_123_1/session.jsonl | head -20",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("allows grep piped to tail", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep 'pattern' .state/sessions/history/s_123_1/session.jsonl | tail -5",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("allows grep -c (count only)", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep -c 'pattern' .state/sessions/history/s_123_1/session.jsonl",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("allows grep -l (filenames only)", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep -l 'pattern' .state/sessions/history/*/session.jsonl",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("allows grep -m (max matches)", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep -m 5 'pattern' .state/sessions/history/s_123_1/session.jsonl",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("allows grep --count", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep --count 'pattern' .state/sessions/history/s_123_1/session.jsonl",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("allows grep --files-with-matches", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep --files-with-matches 'pattern' .state/sessions/history/*/session.jsonl",
      }),
    );
    expect(result).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────
  // Guard 2: bash tool — non-session commands (ALLOWED)
  // ──────────────────────────────────────────────────────────────

  it("allows bash commands that don't reference session.jsonl", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep 'pattern' agents/coach/workspace/todo.md",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("allows cat of meta.json via bash", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "cat .state/sessions/history/s_123_1/meta.json",
      }),
    );
    expect(result).toBeUndefined();
  });

  it("ignores bash calls without a command", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(makeCtx("bash", {}));
    expect(result).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────
  // Other tools (ALLOWED — guard only handles read + bash)
  // ──────────────────────────────────────────────────────────────

  it("ignores non-read/non-bash tools", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("write", {
        path: ".state/sessions/history/s_123_1/session.jsonl",
        content: "test",
      }),
    );
    expect(result).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────────────────────

  it("allows grep via shell variable indirection (can't catch this)", async () => {
    // When grep references session.jsonl through a variable ($f), the guard
    // can't detect it. This is an acceptable gap — the guard catches the
    // common cases (direct path references) which cover 95%+ of real usage.
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: `for f in .state/sessions/history/s_1774*/session.jsonl; do grep 'error' "$f"; done`,
      }),
    );
    // The grep doesn't directly reference session.jsonl (uses $f), so it passes
    expect(result).toBeUndefined();
  });

  it("blocks grep with inline glob of session.jsonl (no limiter)", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "grep 'error' .state/sessions/history/s_1774*/session.jsonl",
      }),
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  it("allows jq on session.jsonl (not grep/cat pattern)", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "jq '.role' .state/sessions/history/s_123_1/session.jsonl | head -5",
      }),
    );
    // jq is not cat/grep, so it's not matched by the guard
    expect(result).toBeUndefined();
  });

  it("allows wc on session.jsonl (size check)", async () => {
    const guard = createSessionReadGuard();
    const result = await guard(
      makeCtx("bash", {
        command: "wc -l .state/sessions/history/s_123_1/session.jsonl",
      }),
    );
    expect(result).toBeUndefined();
  });
});
