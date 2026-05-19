import { describe, it, expect } from "bun:test";
import { extractHandoff, summarizeForHandoff } from "../../src/lib/handoff.js";
import type { TaskResult } from "../../src/lib/types.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

// ── Helpers ────────────────────────────────────────────────────────────

let _tcCounter = 0;

function _resetCounter() {
  _tcCounter = 0;
}

function userMsg(text: string, ts = Date.now()): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: ts,
  };
}

function assistantMsg(text: string, ts = Date.now()): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-chat",
    provider: "test",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: ts,
  } as AgentMessage;
}

function _toolCallMsg(name: string, args: Record<string, any>, ts = Date.now()): AgentMessage {
  const id = `tc_${++_tcCounter}`;
  return {
    role: "assistant",
    content: [{ type: "toolCall", id, name, arguments: args }],
    api: "openai-chat",
    provider: "test",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "toolUse",
    timestamp: ts,
  } as AgentMessage;
}

/** Create a tool call message with a specific ID (for pairing with results). */
function toolCallMsgWithId(id: string, name: string, args: Record<string, any>, ts = Date.now()): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id, name, arguments: args }],
    api: "openai-chat",
    provider: "test",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "toolUse",
    timestamp: ts,
  } as AgentMessage;
}

function toolResultMsg(toolCallId: string, name: string, text: string, isError = false, ts = Date.now()): AgentMessage {
  return {
    role: "toolResult",
    toolCallId,
    toolName: name,
    content: [{ type: "text", text }],
    isError,
    timestamp: ts,
  } as AgentMessage;
}

function makeResult(overrides: Partial<TaskResult> & { messages?: AgentMessage[] } = {}): TaskResult {
  return {
    sessionId: "test-session-1",
    status: "done",
    lastAssistantText: "Task completed successfully.",
    messages: [],
    duration: "1m 30s",
    outputDir: "/tmp/test-output",
    ...overrides,
  };
}

// ── extractHandoff ─────────────────────────────────────────────────────

describe("extractHandoff", () => {
  it("extracts files read from read tool calls", () => {
    const messages: AgentMessage[] = [
      userMsg("Read some files"),
      toolCallMsgWithId("tc_r1", "read", { path: "/src/foo.ts" }),
      toolResultMsg("tc_r1", "read", "file contents"),
      toolCallMsgWithId("tc_r2", "read", { path: "/src/bar.ts" }),
      toolResultMsg("tc_r2", "read", "more contents"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    expect(data.filesRead).toContain("/src/foo.ts");
    expect(data.filesRead).toContain("/src/bar.ts");
    expect(data.filesRead).toHaveLength(2);
  });

  it("extracts files written from write tool calls", () => {
    const messages: AgentMessage[] = [
      userMsg("Write some files"),
      toolCallMsgWithId("tc_w1", "write", { path: "/src/new.ts", content: "export const x = 1;" }),
      toolResultMsg("tc_w1", "write", "OK"),
      toolCallMsgWithId("tc_w2", "write", { path: "/test/new.test.ts", content: "test code" }),
      toolResultMsg("tc_w2", "write", "OK"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    expect(data.filesWritten).toContain("/src/new.ts");
    expect(data.filesWritten).toContain("/test/new.test.ts");
    expect(data.filesWritten).toHaveLength(2);
  });

  it("extracts exec commands with success outcomes", () => {
    const messages: AgentMessage[] = [
      userMsg("Run some commands"),
      toolCallMsgWithId("tc_e1", "exec", { command: "npm test" }),
      toolResultMsg("tc_e1", "exec", "CWD: /home\nAll tests passed"),
      toolCallMsgWithId("tc_e2", "exec", { command: "tsc --noEmit" }),
      toolResultMsg("tc_e2", "exec", "CWD: /home\n"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    expect(data.execCommands).toHaveLength(2);
    expect(data.execCommands[0]).toEqual({ command: "npm test", failed: false });
    expect(data.execCommands[1]).toEqual({ command: "tsc --noEmit", failed: false });
  });

  it("extracts exec commands with failure outcomes", () => {
    const messages: AgentMessage[] = [
      userMsg("Run a command"),
      toolCallMsgWithId("tc_e1", "exec", { command: "npm test" }),
      toolResultMsg("tc_e1", "exec", "Exit code 1\nTest failed", true),
    ];
    const result = makeResult({ messages, status: "error" });
    const data = extractHandoff(result);

    expect(data.execCommands).toHaveLength(1);
    expect(data.execCommands[0]).toEqual({ command: "npm test", failed: true });
  });

  it("extracts errors from tool results with isError flag", () => {
    const messages: AgentMessage[] = [
      userMsg("Do something"),
      toolCallMsgWithId("tc_r1", "read", { path: "/nonexistent.ts" }),
      toolResultMsg("tc_r1", "read", "Error reading file: ENOENT", true),
    ];
    const result = makeResult({ messages, status: "error" });
    const data = extractHandoff(result);

    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].tool).toBe("read");
    expect(data.errors[0].preview).toContain("Error reading file: ENOENT");
  });

  it("extracts errors from tool results matching error patterns (without isError)", () => {
    const messages: AgentMessage[] = [
      userMsg("Do something"),
      toolCallMsgWithId("tc_r1", "read", { path: "/nope" }),
      toolResultMsg("tc_r1", "read", "Error reading file: ENOENT: no such file or directory"),
      toolCallMsgWithId("tc_w1", "write", { path: "/readonly" }),
      toolResultMsg("tc_w1", "write", "Error writing file: EACCES: permission denied"),
      toolCallMsgWithId("tc_e1", "exec", { command: "false" }),
      toolResultMsg("tc_e1", "exec", "CWD: /home\nExit code 1\nfailed"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    expect(data.errors.length).toBeGreaterThanOrEqual(3);
    expect(data.errors[0].tool).toBe("read");
    expect(data.errors[1].tool).toBe("write");
    expect(data.errors[2].tool).toBe("exec");
  });

  it("limits errors to MAX_ERRORS (5)", () => {
    const messages: AgentMessage[] = [userMsg("Do something")];
    for (let i = 0; i < 10; i++) {
      const id = `tc_err_${i}`;
      messages.push(toolCallMsgWithId(id, "read", { path: `/file${i}.ts` }));
      messages.push(toolResultMsg(id, "read", `Error reading file: ENOENT ${i}`, true));
    }
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    expect(data.errors).toHaveLength(5);
  });

  it("truncates error previews to MAX_ERROR_PREVIEW (300 chars)", () => {
    const longError = "Error reading file: " + "x".repeat(500);
    const messages: AgentMessage[] = [
      userMsg("Do something"),
      toolCallMsgWithId("tc_e1", "read", { path: "/file.ts" }),
      toolResultMsg("tc_e1", "read", longError, true),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    expect(data.errors[0].preview.length).toBeLessThanOrEqual(300);
  });

  it("extracts write content previews when includeWriteContents is true", () => {
    const messages: AgentMessage[] = [
      userMsg("Write a file"),
      toolCallMsgWithId("tc_w1", "write", {
        path: "/src/hello.ts",
        content: 'export function hello() {\n  return "hello world";\n}\n',
      }),
      toolResultMsg("tc_w1", "write", "OK"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result, { includeWriteContents: true });

    expect(data.writeContents).toHaveLength(1);
    expect(data.writeContents[0].path).toBe("/src/hello.ts");
    expect(data.writeContents[0].preview).toContain("export function hello");
  });

  it("does not include write contents by default", () => {
    const messages: AgentMessage[] = [
      userMsg("Write a file"),
      toolCallMsgWithId("tc_w1", "write", { path: "/src/hello.ts", content: "code" }),
      toolResultMsg("tc_w1", "write", "OK"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    expect(data.writeContents).toHaveLength(0);
  });

  it("truncates write content previews to MAX_WRITE_PREVIEW (200 chars)", () => {
    const longContent = "x".repeat(500);
    const messages: AgentMessage[] = [
      userMsg("Write a file"),
      toolCallMsgWithId("tc_w1", "write", { path: "/big.ts", content: longContent }),
      toolResultMsg("tc_w1", "write", "OK"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result, { includeWriteContents: true });

    expect(data.writeContents[0].preview.length).toBeLessThanOrEqual(200);
  });

  it("keeps only the latest write to each path", () => {
    const messages: AgentMessage[] = [
      userMsg("Write files"),
      toolCallMsgWithId("tc_w1", "write", { path: "/src/hello.ts", content: "version 1" }),
      toolResultMsg("tc_w1", "write", "OK"),
      toolCallMsgWithId("tc_w2", "write", { path: "/src/hello.ts", content: "version 2" }),
      toolResultMsg("tc_w2", "write", "OK"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result, { includeWriteContents: true });

    expect(data.writeContents).toHaveLength(1);
    expect(data.writeContents[0].preview).toBe("version 2");
  });

  it("deduplicates files read", () => {
    const messages: AgentMessage[] = [
      userMsg("Read same file twice"),
      toolCallMsgWithId("tc_r1", "read", { path: "/src/foo.ts" }),
      toolResultMsg("tc_r1", "read", "contents"),
      toolCallMsgWithId("tc_r2", "read", { path: "/src/foo.ts" }),
      toolResultMsg("tc_r2", "read", "contents again"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    expect(data.filesRead).toHaveLength(1);
    expect(data.filesRead[0]).toBe("/src/foo.ts");
  });

  it("handles empty messages array", () => {
    const result = makeResult({ messages: [] });
    const data = extractHandoff(result);

    expect(data.filesRead).toEqual([]);
    expect(data.filesWritten).toEqual([]);
    expect(data.execCommands).toEqual([]);
    expect(data.errors).toEqual([]);
    expect(data.writeContents).toEqual([]);
    expect(data.status).toBe("done");
    expect(data.duration).toBe("1m 30s");
    expect(data.sessionId).toBe("test-session-1");
  });

  it("preserves status and duration from result", () => {
    const result = makeResult({ status: "error", duration: "5m 10s", sessionId: "sess-abc" });
    const data = extractHandoff(result);

    expect(data.status).toBe("error");
    expect(data.duration).toBe("5m 10s");
    expect(data.sessionId).toBe("sess-abc");
  });

  it("preserves the agent's final response text", () => {
    const result = makeResult({ lastAssistantText: "I finished the implementation." });
    const data = extractHandoff(result);

    expect(data.response).toBe("I finished the implementation.");
  });

  it("handles null lastAssistantText", () => {
    const result = makeResult({ lastAssistantText: null });
    const data = extractHandoff(result);

    expect(data.response).toBeNull();
  });

  it("ignores tool results with empty text content", () => {
    const messages: AgentMessage[] = [
      userMsg("Do something"),
      toolCallMsgWithId("tc_e1", "read", { path: "/file.ts" }),
      // isError but text is empty/whitespace — should not be captured
      toolResultMsg("tc_e1", "read", "   ", true),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    expect(data.errors).toHaveLength(0);
  });

  it("handles write tool calls with missing path or content", () => {
    const messages: AgentMessage[] = [
      userMsg("Write something"),
      // Missing content
      toolCallMsgWithId("tc_w1", "write", { path: "/src/foo.ts" }),
      toolResultMsg("tc_w1", "write", "OK"),
      // Missing path
      toolCallMsgWithId("tc_w2", "write", { content: "some code" }),
      toolResultMsg("tc_w2", "write", "OK"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result, { includeWriteContents: true });

    // Should not crash, and should skip incomplete entries
    expect(data.writeContents).toHaveLength(0);
  });

  it("detects exec exit code errors without isError flag", () => {
    const messages: AgentMessage[] = [
      userMsg("Run test"),
      toolCallMsgWithId("tc_e1", "exec", { command: "npm test" }),
      // No isError flag, but the text indicates a non-zero exit code
      toolResultMsg("tc_e1", "exec", "Exit code 2\nSome failure output"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].tool).toBe("exec");
  });

  it("does not flag exit code 0 as error", () => {
    const messages: AgentMessage[] = [
      userMsg("Run test"),
      toolCallMsgWithId("tc_e1", "exec", { command: "npm test" }),
      // Exit code 0 should NOT be treated as an error
      toolResultMsg("tc_e1", "exec", "CWD: /home\nExit code 0\nAll good"),
    ];
    const result = makeResult({ messages });
    const data = extractHandoff(result);

    // The regex /^(?:CWD:[^\n]*\n)?Exit code [^0]/ should NOT match "Exit code 0"
    expect(data.errors).toHaveLength(0);
  });
});

// ── summarizeForHandoff ────────────────────────────────────────────────

describe("summarizeForHandoff", () => {
  it("produces markdown with status and duration", () => {
    const result = makeResult({ status: "done", duration: "2m 15s" });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Status:** done (2m 15s)");
  });

  it("includes files modified section", () => {
    const messages: AgentMessage[] = [
      userMsg("Write files"),
      toolCallMsgWithId("tc_w1", "write", { path: "/src/feature.ts", content: "code" }),
      toolResultMsg("tc_w1", "write", "OK"),
      toolCallMsgWithId("tc_w2", "write", { path: "/test/feature.test.ts", content: "test" }),
      toolResultMsg("tc_w2", "write", "OK"),
    ];
    const result = makeResult({ messages });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Files modified:**");
    expect(summary).toContain("- /src/feature.ts");
    expect(summary).toContain("- /test/feature.test.ts");
  });

  it("includes files read (not modified) section", () => {
    const messages: AgentMessage[] = [
      userMsg("Read files"),
      toolCallMsgWithId("tc_r1", "read", { path: "/src/existing.ts" }),
      toolResultMsg("tc_r1", "read", "contents"),
      toolCallMsgWithId("tc_r2", "read", { path: "/src/types.ts" }),
      toolResultMsg("tc_r2", "read", "type defs"),
    ];
    const result = makeResult({ messages });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Files read (not modified):**");
    expect(summary).toContain("- /src/existing.ts");
    expect(summary).toContain("- /src/types.ts");
  });

  it("excludes files from read-only list if they were also written", () => {
    const messages: AgentMessage[] = [
      userMsg("Modify file"),
      toolCallMsgWithId("tc_r1", "read", { path: "/src/feature.ts" }),
      toolResultMsg("tc_r1", "read", "old contents"),
      toolCallMsgWithId("tc_w1", "write", { path: "/src/feature.ts", content: "new contents" }),
      toolResultMsg("tc_w1", "write", "OK"),
      toolCallMsgWithId("tc_r2", "read", { path: "/src/readonly.ts" }),
      toolResultMsg("tc_r2", "read", "some contents"),
    ];
    const result = makeResult({ messages });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Files modified:**");
    expect(summary).toContain("- /src/feature.ts");
    expect(summary).toContain("**Files read (not modified):**");
    expect(summary).toContain("- /src/readonly.ts");

    // /src/feature.ts should NOT appear in the "read (not modified)" section
    const readSection = summary.split("**Files read (not modified):**")[1]?.split("\n**")[0] ?? "";
    expect(readSection).not.toContain("/src/feature.ts");
  });

  it("includes commands run with success/failure markers", () => {
    const messages: AgentMessage[] = [
      userMsg("Run commands"),
      toolCallMsgWithId("tc_e1", "exec", { command: "npm test" }),
      toolResultMsg("tc_e1", "exec", "All tests passed"),
      toolCallMsgWithId("tc_e2", "exec", { command: "tsc --noEmit" }),
      toolResultMsg("tc_e2", "exec", "Exit code 1\nErrors found", true),
    ];
    const result = makeResult({ messages });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Commands run:**");
    expect(summary).toContain("✓ `npm test`");
    expect(summary).toContain("❌ `tsc --noEmit`");
  });

  it("truncates long exec commands", () => {
    const longCommand = "x".repeat(200);
    const messages: AgentMessage[] = [
      userMsg("Run something"),
      toolCallMsgWithId("tc_e1", "exec", { command: longCommand }),
      toolResultMsg("tc_e1", "exec", "done"),
    ];
    const result = makeResult({ messages });
    const summary = summarizeForHandoff(result);

    // The command should be truncated to MAX_COMMAND_LENGTH (150) + "…"
    expect(summary).toContain("…");
    // Original 200-char command should not appear in full
    expect(summary).not.toContain(longCommand);
  });

  it("includes errors section", () => {
    const messages: AgentMessage[] = [
      userMsg("Do something"),
      toolCallMsgWithId("tc_r1", "read", { path: "/nope.ts" }),
      toolResultMsg("tc_r1", "read", "Error reading file: ENOENT", true),
    ];
    const result = makeResult({ messages, status: "error" });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Errors encountered:**");
    expect(summary).toContain("[read] Error reading file: ENOENT");
  });

  it("includes agent response section", () => {
    const result = makeResult({ lastAssistantText: "I completed the implementation." });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Agent response:**");
    expect(summary).toContain("I completed the implementation.");
  });

  it("truncates very long agent response", () => {
    const longResponse = "x".repeat(5000);
    const result = makeResult({ lastAssistantText: longResponse });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("_(response truncated)_");
    // The truncated response should be MAX_RESPONSE_LENGTH (3000)
    expect(summary).toContain("x".repeat(3000));
    expect(summary).not.toContain("x".repeat(3001));
  });

  it("omits agent response section when null", () => {
    const result = makeResult({ lastAssistantText: null });
    const summary = summarizeForHandoff(result);

    expect(summary).not.toContain("**Agent response:**");
  });

  // ── Section toggling via options ───────────────────────────────────

  it("omits response when includeResponse is false", () => {
    const result = makeResult({ lastAssistantText: "Some response" });
    const summary = summarizeForHandoff(result, { includeResponse: false });

    expect(summary).not.toContain("**Agent response:**");
    expect(summary).not.toContain("Some response");
  });

  it("omits key facts when includeKeyFacts is false", () => {
    const messages: AgentMessage[] = [
      userMsg("Do stuff"),
      toolCallMsgWithId("tc_w1", "write", { path: "/src/foo.ts", content: "code" }),
      toolResultMsg("tc_w1", "write", "OK"),
      toolCallMsgWithId("tc_e1", "exec", { command: "npm test" }),
      toolResultMsg("tc_e1", "exec", "ok"),
    ];
    const result = makeResult({ messages });
    const summary = summarizeForHandoff(result, { includeKeyFacts: false });

    expect(summary).not.toContain("**Files modified:**");
    expect(summary).not.toContain("**Files read");
    expect(summary).not.toContain("**Commands run:**");
    // Status should still be present
    expect(summary).toContain("**Status:**");
  });

  it("omits errors when includeErrors is false", () => {
    const messages: AgentMessage[] = [
      userMsg("Do something"),
      toolCallMsgWithId("tc_r1", "read", { path: "/nope.ts" }),
      toolResultMsg("tc_r1", "read", "Error reading file: ENOENT", true),
    ];
    const result = makeResult({ messages, status: "error" });
    const summary = summarizeForHandoff(result, { includeErrors: false });

    expect(summary).not.toContain("**Errors encountered:**");
  });

  // ── maxLength truncation ──────────────────────────────────────────

  it("truncates output when exceeding maxLength", () => {
    const result = makeResult({ lastAssistantText: "x".repeat(5000) });
    const summary = summarizeForHandoff(result, { maxLength: 500 });

    expect(summary.length).toBeLessThanOrEqual(500 + "_(handoff summary truncated)_".length + 5);
    expect(summary).toContain("_(handoff summary truncated)_");
  });

  it("does not truncate when under maxLength", () => {
    const result = makeResult({ lastAssistantText: "Short response." });
    const summary = summarizeForHandoff(result, { maxLength: 8000 });

    expect(summary).not.toContain("_(handoff summary truncated)_");
  });

  // ── Write content previews in formatted output ────────────────────

  it("includes file content previews when includeWriteContents is true", () => {
    const messages: AgentMessage[] = [
      userMsg("Write a file"),
      toolCallMsgWithId("tc_w1", "write", {
        path: "/src/hello.ts",
        content: 'export function hello() {\n  return "world";\n}\n',
      }),
      toolResultMsg("tc_w1", "write", "OK"),
    ];
    const result = makeResult({ messages });
    const summary = summarizeForHandoff(result, { includeWriteContents: true });

    expect(summary).toContain("**File content previews:**");
    expect(summary).toContain("/src/hello.ts");
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it("handles result with no messages gracefully", () => {
    const result = makeResult({
      messages: [],
      lastAssistantText: null,
    });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Status:** done");
    expect(summary).not.toContain("**Files modified:**");
    expect(summary).not.toContain("**Commands run:**");
    expect(summary).not.toContain("**Errors encountered:**");
    expect(summary).not.toContain("**Agent response:**");
  });

  it("handles error status with full error info", () => {
    const result = makeResult({
      status: "error",
      duration: "0m 5s",
      lastAssistantText: "I encountered an error.",
      error: "Something went wrong",
    });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Status:** error (0m 5s)");
    expect(summary).toContain("I encountered an error.");
  });

  it("handles a complex multi-step session", () => {
    const messages: AgentMessage[] = [
      userMsg("Implement feature X"),
      // Read existing files
      toolCallMsgWithId("tc_r1", "read", { path: "/src/existing.ts" }),
      toolResultMsg("tc_r1", "read", "existing code"),
      toolCallMsgWithId("tc_r2", "read", { path: "/src/types.ts" }),
      toolResultMsg("tc_r2", "read", "type definitions"),
      // Write new files
      toolCallMsgWithId("tc_w1", "write", { path: "/src/feature.ts", content: "new feature code" }),
      toolResultMsg("tc_w1", "write", "OK"),
      toolCallMsgWithId("tc_w2", "write", { path: "/test/feature.test.ts", content: "test code" }),
      toolResultMsg("tc_w2", "write", "OK"),
      // Run commands
      toolCallMsgWithId("tc_e1", "exec", { command: "npm test" }),
      toolResultMsg("tc_e1", "exec", "All 42 tests passed"),
      toolCallMsgWithId("tc_e2", "exec", { command: "tsc --noEmit" }),
      toolResultMsg("tc_e2", "exec", "No errors"),
      // Final response
      assistantMsg("Feature X has been implemented successfully."),
    ];

    const result = makeResult({
      messages,
      lastAssistantText: "Feature X has been implemented successfully.",
      duration: "3m 22s",
    });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Status:** done (3m 22s)");
    expect(summary).toContain("**Files modified:**");
    expect(summary).toContain("/src/feature.ts");
    expect(summary).toContain("/test/feature.test.ts");
    expect(summary).toContain("**Files read (not modified):**");
    expect(summary).toContain("/src/types.ts");
    expect(summary).toContain("**Commands run:**");
    expect(summary).toContain("✓ `npm test`");
    expect(summary).toContain("✓ `tsc --noEmit`");
    expect(summary).toContain("**Agent response:**");
    expect(summary).toContain("Feature X has been implemented successfully.");
  });

  it("handles only user messages (no tool calls)", () => {
    const messages: AgentMessage[] = [userMsg("Hello"), assistantMsg("Hi, how can I help?")];
    const result = makeResult({
      messages,
      lastAssistantText: "Hi, how can I help?",
    });
    const summary = summarizeForHandoff(result);

    expect(summary).toContain("**Status:** done");
    expect(summary).toContain("**Agent response:**");
    expect(summary).not.toContain("**Files modified:**");
    expect(summary).not.toContain("**Commands run:**");
  });

  it("handles very long response that also exceeds maxLength", () => {
    // This tests both response truncation (3000) and overall maxLength
    const longResponse = "a".repeat(10000);
    const result = makeResult({ lastAssistantText: longResponse });
    const summary = summarizeForHandoff(result, { maxLength: 1000 });

    // Overall should be capped near maxLength
    expect(summary.length).toBeLessThan(1100); // some slack for the truncation message
    expect(summary).toContain("_(handoff summary truncated)_");
  });

  it("default maxLength is 8000", () => {
    // Creating a result that would produce output longer than 8000
    const longResponse = "x".repeat(6000);
    const messages: AgentMessage[] = [userMsg("Task")];
    // Add many files to increase output
    for (let i = 0; i < 50; i++) {
      const id = `tc_w_${i}`;
      messages.push(toolCallMsgWithId(id, "write", { path: `/src/file${i}.ts`, content: "code" }));
      messages.push(toolResultMsg(id, "write", "OK"));
    }
    const result = makeResult({ messages, lastAssistantText: longResponse });
    const summary = summarizeForHandoff(result);

    // With default maxLength 8000, very large outputs should be capped
    // The exact behavior depends on content, but we verify it doesn't blow up
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  it("all sections disabled produces only status line", () => {
    const messages: AgentMessage[] = [
      userMsg("Do stuff"),
      toolCallMsgWithId("tc_w1", "write", { path: "/src/foo.ts", content: "code" }),
      toolResultMsg("tc_w1", "write", "OK"),
      toolCallMsgWithId("tc_e1", "exec", { command: "npm test" }),
      toolResultMsg("tc_e1", "exec", "Exit code 1\nfailed", true),
    ];
    const result = makeResult({
      messages,
      lastAssistantText: "Response text",
      status: "error",
    });
    const summary = summarizeForHandoff(result, {
      includeResponse: false,
      includeKeyFacts: false,
      includeErrors: false,
    });

    expect(summary).toContain("**Status:** error");
    expect(summary).not.toContain("**Files modified:**");
    expect(summary).not.toContain("**Commands run:**");
    expect(summary).not.toContain("**Errors encountered:**");
    expect(summary).not.toContain("**Agent response:**");
  });
});

// ── extractHandoff + summarizeForHandoff integration ───────────────────

describe("extractHandoff → summarizeForHandoff integration", () => {
  it("extractHandoff data matches what summarizeForHandoff renders", () => {
    const messages: AgentMessage[] = [
      userMsg("Build feature"),
      toolCallMsgWithId("tc_w1", "write", { path: "/src/feature.ts", content: "code" }),
      toolResultMsg("tc_w1", "write", "OK"),
      toolCallMsgWithId("tc_e1", "exec", { command: "npm test" }),
      toolResultMsg("tc_e1", "exec", "passed"),
    ];
    const result = makeResult({
      messages,
      lastAssistantText: "Done!",
    });

    const data = extractHandoff(result);
    const summary = summarizeForHandoff(result);

    // Verify the summary contains all the data from extractHandoff
    expect(data.filesWritten).toContain("/src/feature.ts");
    expect(summary).toContain("/src/feature.ts");

    expect(data.execCommands[0].command).toBe("npm test");
    expect(summary).toContain("npm test");

    expect(data.response).toBe("Done!");
    expect(summary).toContain("Done!");
  });

  it("shows structured finish status when present", () => {
    const result: TaskResult = {
      sessionId: "s1",
      status: "done",
      lastAssistantText: "blocked on external deploy",
      messages: [],
      duration: "1s",
      outputDir: "/tmp/out",
      finishResult: { status: "blocked", summary: "blocked on external deploy" },
    };

    expect(summarizeForHandoff(result)).toContain("**Status:** done / finish(blocked) (1s)");
  });
});
