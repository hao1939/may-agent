import { describe, it, expect } from "vitest";
import { isStuck, extractToolCalls } from "../src/lib/stuck-detector.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

// ── Test Helpers ───────────────────────────────────────────────────────

/** Create a minimal assistant message with tool calls. */
function assistantMsg(toolCalls: { id: string; name: string; args: any }[]): any {
  return {
    role: "assistant" as const,
    content: [
      { type: "text" as const, text: "Let me try..." },
      ...toolCalls.map((tc) => ({
        type: "toolCall" as const,
        id: tc.id,
        name: tc.name,
        arguments: tc.args,
      })),
    ],
    timestamp: Date.now(),
    api: "anthropic",
    provider: "anthropic",
    model: "test",
    usage: { inputTokens: 0, outputTokens: 0 },
    stopReason: "toolUse" as const,
  };
}

/** Create a toolResult message. */
function toolResultMsg(
  toolCallId: string,
  toolName: string,
  output: string,
  isError = false,
): any {
  return {
    role: "toolResult" as const,
    toolCallId,
    toolName,
    content: [{ type: "text" as const, text: output }],
    isError,
    timestamp: Date.now(),
  };
}

/** Create a user message. */
function userMsg(text: string): any {
  return {
    role: "user" as const,
    content: text,
    timestamp: Date.now(),
  };
}

// ── extractToolCalls ───────────────────────────────────────────────────

describe("extractToolCalls", () => {
  it("extracts tool calls from assistant + toolResult message pairs", () => {
    const messages: AgentMessage[] = [
      userMsg("hello"),
      assistantMsg([{ id: "tc1", name: "read", args: { path: "foo.ts" } }]),
      toolResultMsg("tc1", "read", "file contents here"),
    ];
    const calls = extractToolCalls(messages);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("read");
    expect(calls[0].args).toEqual({ path: "foo.ts" });
    expect(calls[0].output).toBe("file contents here");
    expect(calls[0].isError).toBe(false);
  });

  it("detects errors from isError flag", () => {
    const messages: AgentMessage[] = [
      assistantMsg([{ id: "tc1", name: "read", args: { path: "missing.ts" } }]),
      toolResultMsg("tc1", "read", "Error: ENOENT: no such file or directory", true),
    ];
    const calls = extractToolCalls(messages);
    expect(calls).toHaveLength(1);
    expect(calls[0].isError).toBe(true);
  });

  it("detects errors from output text patterns", () => {
    const messages: AgentMessage[] = [
      assistantMsg([{ id: "tc1", name: "bash", args: { command: "cat bad" } }]),
      toolResultMsg("tc1", "bash", "cat: bad: No such file or directory\nexit code 1"),
    ];
    const calls = extractToolCalls(messages);
    expect(calls).toHaveLength(1);
    expect(calls[0].isError).toBe(true);
  });

  it("handles multiple tool calls in one assistant message", () => {
    const messages: AgentMessage[] = [
      assistantMsg([
        { id: "tc1", name: "read", args: { path: "a.ts" } },
        { id: "tc2", name: "read", args: { path: "b.ts" } },
      ]),
      toolResultMsg("tc1", "read", "contents a"),
      toolResultMsg("tc2", "read", "contents b"),
    ];
    const calls = extractToolCalls(messages);
    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe("read");
    expect(calls[1].name).toBe("read");
    expect(calls[0].isError).toBe(false);
    expect(calls[1].isError).toBe(false);
  });

  it("skips messages without role", () => {
    const messages = [
      { type: "custom", data: "something" } as any,
      assistantMsg([{ id: "tc1", name: "read", args: { path: "x" } }]),
      toolResultMsg("tc1", "read", "ok"),
    ];
    const calls = extractToolCalls(messages);
    expect(calls).toHaveLength(1);
  });
});

// ── isStuck: Repetitive tool calls ────────────────────────────────────

describe("isStuck", () => {
  describe("repetitive tool call detection", () => {
    it("detects 3x read(same_file) with same error", () => {
      const messages: AgentMessage[] = [];
      for (let i = 0; i < 3; i++) {
        messages.push(
          assistantMsg([{ id: `tc${i}`, name: "read", args: { path: "/nonexistent.ts" } }]),
          toolResultMsg(`tc${i}`, "read", "Error: ENOENT: no such file or directory, open '/nonexistent.ts'", true),
        );
      }
      const result = isStuck(messages, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(true);
      expect(result.reason).toContain("Repeated read");
      expect(result.reason).toContain("identical arguments");
      expect(result.reason).toContain("3 times");
    });

    it("detects 3x bash(same_cmd) with same error", () => {
      const messages: AgentMessage[] = [];
      for (let i = 0; i < 3; i++) {
        messages.push(
          assistantMsg([{ id: `tc${i}`, name: "bash", args: { command: "npm test" } }]),
          toolResultMsg(`tc${i}`, "bash", "FAIL src/index.test.ts\nexit code 1", true),
        );
      }
      const result = isStuck(messages, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(true);
      expect(result.reason).toContain("Repeated bash");
    });

    it("does NOT flag different arguments as stuck", () => {
      const messages: AgentMessage[] = [
        assistantMsg([{ id: "tc0", name: "read", args: { path: "a.ts" } }]),
        toolResultMsg("tc0", "read", "Error: ENOENT: no such file or directory", true),
        assistantMsg([{ id: "tc1", name: "read", args: { path: "b.ts" } }]),
        toolResultMsg("tc1", "read", "Error: ENOENT: no such file or directory", true),
        assistantMsg([{ id: "tc2", name: "read", args: { path: "c.ts" } }]),
        toolResultMsg("tc2", "read", "Error: ENOENT: no such file or directory", true),
      ];
      // High errorTurnLimit to isolate repetitive-tool check only
      const result = isStuck(messages, { toolRepeatLimit: 3, errorTurnLimit: 99 });
      expect(result.stuck).toBe(false);
    });

    it("does NOT flag iterative reads with offset/limit as stuck", () => {
      // Legitimate iterative work: reading chunks of a file
      const messages: AgentMessage[] = [
        assistantMsg([{ id: "tc0", name: "read", args: { path: "big.ts", offset: 1, limit: 100 } }]),
        toolResultMsg("tc0", "read", "line 1\nline 2\n..."),
        assistantMsg([{ id: "tc1", name: "read", args: { path: "big.ts", offset: 101, limit: 100 } }]),
        toolResultMsg("tc1", "read", "line 101\nline 102\n..."),
        assistantMsg([{ id: "tc2", name: "read", args: { path: "big.ts", offset: 201, limit: 100 } }]),
        toolResultMsg("tc2", "read", "line 201\nline 202\n..."),
      ];
      const result = isStuck(messages, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(false);
    });

    it("does NOT flag successful tool calls as stuck", () => {
      const messages: AgentMessage[] = [];
      for (let i = 0; i < 5; i++) {
        messages.push(
          assistantMsg([{ id: `tc${i}`, name: "read", args: { path: "same.ts" } }]),
          toolResultMsg(`tc${i}`, "read", "contents of same.ts"),
        );
      }
      const result = isStuck(messages, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(false);
    });

    it("does NOT flag mixed tool names as stuck", () => {
      const messages: AgentMessage[] = [
        assistantMsg([{ id: "tc0", name: "read", args: { path: "x" } }]),
        toolResultMsg("tc0", "read", "Error: ENOENT: no such file or directory", true),
        assistantMsg([{ id: "tc1", name: "bash", args: { command: "cat x" } }]),
        toolResultMsg("tc1", "bash", "cat: x: No such file or directory\nexit code 1", true),
        assistantMsg([{ id: "tc2", name: "read", args: { path: "x" } }]),
        toolResultMsg("tc2", "read", "Error: ENOENT: no such file or directory", true),
      ];
      // High errorTurnLimit to isolate repetitive-tool check only
      const result = isStuck(messages, { toolRepeatLimit: 3, errorTurnLimit: 99 });
      expect(result.stuck).toBe(false);
    });

    it("respects custom toolRepeatLimit", () => {
      const messages: AgentMessage[] = [];
      for (let i = 0; i < 5; i++) {
        messages.push(
          assistantMsg([{ id: `tc${i}`, name: "read", args: { path: "/bad" } }]),
          toolResultMsg(`tc${i}`, "read", "Error: ENOENT: no such file or directory", true),
        );
      }
      // With limit=5, should detect (repetitive tool check)
      expect(isStuck(messages, { toolRepeatLimit: 5, errorTurnLimit: 99 }).stuck).toBe(true);
      // With limit=6, should NOT detect (only 5 repeats)
      expect(isStuck(messages, { toolRepeatLimit: 6, errorTurnLimit: 99 }).stuck).toBe(false);
    });
  });

  describe("consecutive error turn detection", () => {
    it("detects 3 consecutive turns where every tool call errored", () => {
      const messages: AgentMessage[] = [];
      // Use different tool args each turn to avoid triggering the repetitive-tool-call check
      for (let i = 0; i < 3; i++) {
        messages.push(
          assistantMsg([
            { id: `tc${i}a`, name: "bash", args: { command: `cmd_${i}` } },
            { id: `tc${i}b`, name: "read", args: { path: `file_${i}.ts` } },
          ]),
          toolResultMsg(`tc${i}a`, "bash", `command not found\nexit code 127`, true),
          toolResultMsg(`tc${i}b`, "read", "Error: ENOENT: no such file or directory", true),
        );
      }
      const result = isStuck(messages, { errorTurnLimit: 3, toolRepeatLimit: 99 });
      expect(result.stuck).toBe(true);
      expect(result.reason).toContain("3 consecutive turns");
    });

    it("resets count when a turn has a success", () => {
      const messages: AgentMessage[] = [
        // Turn 1: error
        assistantMsg([{ id: "tc0", name: "bash", args: { command: "bad1" } }]),
        toolResultMsg("tc0", "bash", "command not found\nexit code 127", true),
        // Turn 2: error
        assistantMsg([{ id: "tc1", name: "bash", args: { command: "bad2" } }]),
        toolResultMsg("tc1", "bash", "command not found\nexit code 127", true),
        // Turn 3: SUCCESS (resets counter)
        assistantMsg([{ id: "tc2", name: "read", args: { path: "good.ts" } }]),
        toolResultMsg("tc2", "read", "file contents here"),
        // Turn 4: error
        assistantMsg([{ id: "tc3", name: "bash", args: { command: "bad3" } }]),
        toolResultMsg("tc3", "bash", "command not found\nexit code 127", true),
        // Turn 5: error
        assistantMsg([{ id: "tc4", name: "bash", args: { command: "bad4" } }]),
        toolResultMsg("tc4", "bash", "command not found\nexit code 127", true),
      ];
      // Only 2 consecutive errors at the end (after the success), not 4
      const result = isStuck(messages, { errorTurnLimit: 3, toolRepeatLimit: 99 });
      expect(result.stuck).toBe(false);
    });

    it("does NOT flag turns with mixed success/error as error turns", () => {
      const messages: AgentMessage[] = [];
      for (let i = 0; i < 5; i++) {
        messages.push(
          assistantMsg([
            { id: `tc${i}a`, name: "bash", args: { command: `fail_${i}` } },
            { id: `tc${i}b`, name: "read", args: { path: "good.ts" } },
          ]),
          toolResultMsg(`tc${i}a`, "bash", `exit code 1`, true),
          toolResultMsg(`tc${i}b`, "read", "file contents"), // success
        );
      }
      const result = isStuck(messages, { errorTurnLimit: 3, toolRepeatLimit: 99 });
      expect(result.stuck).toBe(false);
    });

    it("respects custom errorTurnLimit", () => {
      const messages: AgentMessage[] = [];
      for (let i = 0; i < 5; i++) {
        messages.push(
          assistantMsg([{ id: `tc${i}`, name: "bash", args: { command: `bad_${i}` } }]),
          toolResultMsg(`tc${i}`, "bash", `exit code 1`, true),
        );
      }
      expect(isStuck(messages, { errorTurnLimit: 5, toolRepeatLimit: 99 }).stuck).toBe(true);
      expect(isStuck(messages, { errorTurnLimit: 6, toolRepeatLimit: 99 }).stuck).toBe(false);
    });
  });

  describe("false positive prevention", () => {
    it("does NOT flag read(chunk1), read(chunk2), read(chunk3) as stuck", () => {
      const messages: AgentMessage[] = [
        assistantMsg([{ id: "tc0", name: "read", args: { path: "big.ts", offset: 0, limit: 50 } }]),
        toolResultMsg("tc0", "read", "first 50 lines..."),
        assistantMsg([{ id: "tc1", name: "read", args: { path: "big.ts", offset: 50, limit: 50 } }]),
        toolResultMsg("tc1", "read", "next 50 lines..."),
        assistantMsg([{ id: "tc2", name: "read", args: { path: "big.ts", offset: 100, limit: 50 } }]),
        toolResultMsg("tc2", "read", "more lines..."),
      ];
      const result = isStuck(messages);
      expect(result.stuck).toBe(false);
    });

    it("does NOT flag legitimate edit→read→edit→read cycles as stuck", () => {
      const messages: AgentMessage[] = [
        assistantMsg([{ id: "tc0", name: "edit", args: { path: "a.ts", oldText: "x", newText: "y" } }]),
        toolResultMsg("tc0", "edit", "✅ Edit applied"),
        assistantMsg([{ id: "tc1", name: "read", args: { path: "a.ts" } }]),
        toolResultMsg("tc1", "read", "file with y"),
        assistantMsg([{ id: "tc2", name: "edit", args: { path: "a.ts", oldText: "y", newText: "z" } }]),
        toolResultMsg("tc2", "edit", "✅ Edit applied"),
        assistantMsg([{ id: "tc3", name: "read", args: { path: "a.ts" } }]),
        toolResultMsg("tc3", "read", "file with z"),
      ];
      const result = isStuck(messages);
      expect(result.stuck).toBe(false);
    });

    it("does NOT flag empty message histories as stuck", () => {
      const result = isStuck([]);
      expect(result.stuck).toBe(false);
    });

    it("does NOT flag user-only messages as stuck", () => {
      const result = isStuck([userMsg("hello"), userMsg("world")]);
      expect(result.stuck).toBe(false);
    });

    it("does NOT flag assistant messages without tool calls as stuck", () => {
      const textOnlyAssistant: any = {
        role: "assistant",
        content: [{ type: "text", text: "I'm thinking..." }],
        timestamp: Date.now(),
        api: "anthropic",
        provider: "anthropic",
        model: "test",
        usage: { inputTokens: 0, outputTokens: 0 },
        stopReason: "stop",
      };
      const result = isStuck([textOnlyAssistant, textOnlyAssistant, textOnlyAssistant]);
      expect(result.stuck).toBe(false);
    });
  });

  describe("intervention message format", () => {
    it("includes the tool name in the reason", () => {
      const messages: AgentMessage[] = [];
      for (let i = 0; i < 3; i++) {
        messages.push(
          assistantMsg([{ id: `tc${i}`, name: "read", args: { path: "/gone" } }]),
          toolResultMsg(`tc${i}`, "read", "Error: ENOENT: no such file or directory", true),
        );
      }
      const result = isStuck(messages, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(true);
      expect(result.reason).toMatch(/read/);
      expect(result.reason).toMatch(/identical arguments/);
    });

    it("includes the last error in the reason (truncated)", () => {
      const longError = "A".repeat(300);
      const messages: AgentMessage[] = [];
      for (let i = 0; i < 3; i++) {
        messages.push(
          assistantMsg([{ id: `tc${i}`, name: "bash", args: { command: "fail" } }]),
          toolResultMsg(`tc${i}`, "bash", longError + "\nexit code 1", true),
        );
      }
      const result = isStuck(messages, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(true);
      // Reason should truncate the error to 200 chars
      expect(result.reason.length).toBeLessThan(400);
    });
  });
});
