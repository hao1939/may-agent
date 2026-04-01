import { describe, it, expect } from "vitest";
import { isStuck, extractToolCalls } from "../src/lib/stuck-detector.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

// ── Helpers to build synthetic message histories ───────────────────────

/** Create a minimal AssistantMessage with one toolCall block. */
function assistantToolCall(id: string, name: string, args: Record<string, any>): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id, name, arguments: args }],
    api: "anthropic" as any,
    provider: "anthropic" as any,
    model: "test",
    usage: { input: 0, output: 0, cacheRead: 0 },
    stopReason: "toolCall" as any,
    timestamp: Date.now(),
  } as AgentMessage;
}

/** Create a ToolResultMessage. */
function toolResult(toolCallId: string, toolName: string, text: string, isError = false): AgentMessage {
  return {
    role: "toolResult",
    toolCallId,
    toolName,
    content: [{ type: "text", text }],
    details: undefined,
    isError,
    timestamp: Date.now(),
  } as unknown as AgentMessage;
}

/** Build a sequence of N identical failing tool calls. */
function repeatedFailingCalls(
  toolName: string,
  args: Record<string, any>,
  errorOutput: string,
  count: number,
): AgentMessage[] {
  const messages: AgentMessage[] = [];
  for (let i = 0; i < count; i++) {
    const id = `call_${i}`;
    messages.push(assistantToolCall(id, toolName, args));
    messages.push(toolResult(id, toolName, errorOutput, true));
  }
  return messages;
}

/** Build a sequence where each turn has all failing tool calls. */
function repeatedErrorTurns(count: number): AgentMessage[] {
  const messages: AgentMessage[] = [];
  for (let i = 0; i < count; i++) {
    // Each turn: one assistant message with a toolCall, then a failing result
    const id = `turn_${i}_call`;
    // Use different args each turn (different file paths) to avoid triggering
    // the repetitive-tool-call check — we want to isolate the error-turns check.
    messages.push(assistantToolCall(id, "bash", { command: `failing_cmd_${i}` }));
    messages.push(toolResult(id, "bash", `Error: ENOENT: no such file /missing_${i}`, true));
  }
  return messages;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("stuck-detector", () => {
  describe("extractToolCalls", () => {
    it("extracts tool calls paired with their results", () => {
      const history: AgentMessage[] = [
        assistantToolCall("c1", "read", { path: "foo.ts" }),
        toolResult("c1", "read", "file contents here"),
      ];

      const calls = extractToolCalls(history);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe("read");
      expect(calls[0].args).toEqual({ path: "foo.ts" });
      expect(calls[0].output).toBe("file contents here");
      expect(calls[0].isError).toBe(false);
    });

    it("detects errors via isError flag", () => {
      const history: AgentMessage[] = [
        assistantToolCall("c1", "read", { path: "/no/such/file" }),
        toolResult("c1", "read", "Error: ENOENT: no such file or directory", true),
      ];

      const calls = extractToolCalls(history);
      expect(calls).toHaveLength(1);
      expect(calls[0].isError).toBe(true);
    });

    it("detects errors via isToolError heuristic (error text)", () => {
      const history: AgentMessage[] = [
        assistantToolCall("c1", "bash", { command: "cat /missing" }),
        // isError=false but the output text matches error patterns
        toolResult("c1", "bash", "cat: /missing: No such file or directory", false),
      ];

      const calls = extractToolCalls(history);
      expect(calls).toHaveLength(1);
      expect(calls[0].isError).toBe(true); // isToolError catches the text
    });

    it("handles multiple tool calls in one assistant turn", () => {
      const history: AgentMessage[] = [
        {
          role: "assistant",
          content: [
            { type: "toolCall", id: "c1", name: "read", arguments: { path: "a.ts" } },
            { type: "toolCall", id: "c2", name: "read", arguments: { path: "b.ts" } },
          ],
          api: "anthropic" as any,
          provider: "anthropic" as any,
          model: "test",
          usage: { input: 0, output: 0, cacheRead: 0 },
          stopReason: "toolCall" as any,
          timestamp: Date.now(),
        } as AgentMessage,
        toolResult("c1", "read", "contents of a"),
        toolResult("c2", "read", "contents of b"),
      ];

      const calls = extractToolCalls(history);
      expect(calls).toHaveLength(2);
      expect(calls[0].name).toBe("read");
      expect(calls[1].name).toBe("read");
      expect(calls[0].output).toBe("contents of a");
      expect(calls[1].output).toBe("contents of b");
    });

    it("ignores messages without role (non-standard)", () => {
      const history: AgentMessage[] = [
        {} as any, // garbage
        assistantToolCall("c1", "read", { path: "foo.ts" }),
        toolResult("c1", "read", "ok"),
      ];

      const calls = extractToolCalls(history);
      expect(calls).toHaveLength(1);
    });

    it("returns empty for history with no tool calls", () => {
      const history: AgentMessage[] = [
        { role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() } as unknown as AgentMessage,
        {
          role: "assistant",
          content: [{ type: "text", text: "hi there" }],
          api: "anthropic" as any,
          provider: "anthropic" as any,
          model: "test",
          usage: { input: 0, output: 0, cacheRead: 0 },
          stopReason: "endTurn" as any,
          timestamp: Date.now(),
        } as AgentMessage,
      ];

      const calls = extractToolCalls(history);
      expect(calls).toHaveLength(0);
    });
  });

  describe("isStuck — repetitive tool calls", () => {
    it("detects 3x read(same_file) → same error", () => {
      const history = repeatedFailingCalls(
        "read",
        { path: "/nonexistent/file.ts" },
        "Error: ENOENT: no such file or directory, open '/nonexistent/file.ts'",
        3,
      );

      const result = isStuck(history, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(true);
      expect(result.reason).toContain("read");
      expect(result.reason).toContain("identical arguments");
      expect(result.reason).toContain("3 times");
    });

    it("detects 3x bash(same_cmd) → same error", () => {
      const history = repeatedFailingCalls("bash", { command: "npm test" }, "Command failed with exit code 1", 3);

      const result = isStuck(history, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(true);
      expect(result.reason).toContain("bash");
      expect(result.reason).toContain("identical arguments");
    });

    it("detects 3x edit(same_args) → same error", () => {
      const history = repeatedFailingCalls(
        "edit",
        { path: "foo.ts", oldText: "wrong text", newText: "new text" },
        "Could not find the exact text in foo.ts",
        3,
      );

      const result = isStuck(history, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(true);
      expect(result.reason).toContain("edit");
    });

    it("does NOT trigger for less than limit repetitions", () => {
      const history = repeatedFailingCalls(
        "read",
        { path: "/missing" },
        "Error: ENOENT: no such file or directory",
        2, // Only 2, limit is 3
      );

      const result = isStuck(history, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(false);
    });

    it("does NOT trigger for same tool but different args (low false positive)", () => {
      // Legitimate: reading different chunks of the same file
      const history: AgentMessage[] = [];
      for (let i = 0; i < 5; i++) {
        const id = `call_${i}`;
        history.push(assistantToolCall(id, "read", { path: "big-file.ts", offset: i * 100, limit: 100 }));
        history.push(toolResult(id, "read", `line ${i * 100} content here...`));
      }

      const result = isStuck(history, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(false);
    });

    it("does NOT trigger for same tool + same args but SUCCESS output", () => {
      // Legitimate: running the same test multiple times and it passes
      const history: AgentMessage[] = [];
      for (let i = 0; i < 5; i++) {
        const id = `call_${i}`;
        history.push(assistantToolCall(id, "bash", { command: "bun vitest --run" }));
        history.push(toolResult(id, "bash", "Tests: 50 passed, 50 total"));
      }

      const result = isStuck(history, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(false);
    });

    it("does NOT trigger tool-repetition for different tools even if all fail", () => {
      // 3 different tools failing — should NOT trigger the tool-repetition check.
      // Set errorTurnLimit high to isolate tool-repetition detection only.
      const history: AgentMessage[] = [
        assistantToolCall("c1", "read", { path: "/a" }),
        toolResult("c1", "read", "Error: ENOENT: no such file or directory", true),
        assistantToolCall("c2", "bash", { command: "cat /b" }),
        toolResult("c2", "bash", "cat: /b: No such file or directory", true),
        assistantToolCall("c3", "edit", { path: "c.ts", oldText: "x", newText: "y" }),
        toolResult("c3", "edit", "Could not find the exact text in c.ts", true),
      ];

      const result = isStuck(history, { toolRepeatLimit: 3, errorTurnLimit: 99 });
      expect(result.stuck).toBe(false);
    });

    it("DOES trigger error-turn detection for different tools all failing", () => {
      // 3 different tools failing = 3 consecutive error turns → triggers turn-level check
      const history: AgentMessage[] = [
        assistantToolCall("c1", "read", { path: "/a" }),
        toolResult("c1", "read", "Error: ENOENT: no such file or directory", true),
        assistantToolCall("c2", "bash", { command: "cat /b" }),
        toolResult("c2", "bash", "cat: /b: No such file or directory", true),
        assistantToolCall("c3", "edit", { path: "c.ts", oldText: "x", newText: "y" }),
        toolResult("c3", "edit", "Could not find the exact text in c.ts", true),
      ];

      const result = isStuck(history, { toolRepeatLimit: 3, errorTurnLimit: 3 });
      expect(result.stuck).toBe(true);
      expect(result.reason).toContain("consecutive turns");
    });

    it("detects stuck even with a successful call earlier in history", () => {
      const history: AgentMessage[] = [
        // One successful call first
        assistantToolCall("ok", "read", { path: "exists.ts" }),
        toolResult("ok", "read", "file contents"),
        // Then 3 identical failing calls
        ...repeatedFailingCalls("read", { path: "/missing.ts" }, "Error: ENOENT: no such file or directory", 3),
      ];

      const result = isStuck(history, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(true);
    });

    it("includes last error snippet in reason", () => {
      const errorText =
        "Error: ENOENT: no such file or directory, open '/very/long/path/that/should/be/truncated/in/the/reason/string.ts'";
      const history = repeatedFailingCalls("read", { path: "/bad" }, errorText, 3);

      const result = isStuck(history, { toolRepeatLimit: 3 });
      expect(result.stuck).toBe(true);
      expect(result.reason).toContain("Last error:");
      expect(result.reason.length).toBeLessThan(500); // Shouldn't be unbounded
    });
  });

  describe("isStuck — consecutive error turns", () => {
    it("detects N consecutive all-error turns", () => {
      const history = repeatedErrorTurns(3);

      const result = isStuck(history, { errorTurnLimit: 3 });
      expect(result.stuck).toBe(true);
      expect(result.reason).toContain("3 consecutive turns");
    });

    it("does NOT trigger for fewer than limit error turns", () => {
      const history = repeatedErrorTurns(2);

      const result = isStuck(history, { errorTurnLimit: 3 });
      expect(result.stuck).toBe(false);
    });

    it("resets count when a turn has a successful tool call", () => {
      const history: AgentMessage[] = [
        // 2 error turns
        ...repeatedErrorTurns(2),
        // 1 success turn
        assistantToolCall("ok", "read", { path: "exists.ts" }),
        toolResult("ok", "read", "file contents"),
        // 2 more error turns (not enough to trigger at limit=3)
        ...(() => {
          const msgs: AgentMessage[] = [];
          for (let i = 10; i < 12; i++) {
            const id = `turn_${i}_call`;
            msgs.push(assistantToolCall(id, "bash", { command: `cmd_${i}` }));
            msgs.push(toolResult(id, "bash", `Command failed with exit code 1`, true));
          }
          return msgs;
        })(),
      ];

      const result = isStuck(history, { errorTurnLimit: 3 });
      expect(result.stuck).toBe(false);
    });

    it("triggers when error turns follow a success turn", () => {
      const history: AgentMessage[] = [
        // 1 success turn
        assistantToolCall("ok", "read", { path: "file.ts" }),
        toolResult("ok", "read", "contents"),
        // 4 error turns
        ...repeatedErrorTurns(4),
      ];

      const result = isStuck(history, { errorTurnLimit: 3 });
      expect(result.stuck).toBe(true);
    });

    it("a turn with mixed success/error is NOT counted as error turn", () => {
      const history: AgentMessage[] = [];
      for (let i = 0; i < 5; i++) {
        // Each turn has 2 calls: one success + one error → not all errors
        const msg: AgentMessage = {
          role: "assistant",
          content: [
            { type: "toolCall", id: `t${i}_ok`, name: "read", arguments: { path: `file_${i}.ts` } },
            { type: "toolCall", id: `t${i}_err`, name: "bash", arguments: { command: `bad_${i}` } },
          ],
          api: "anthropic" as any,
          provider: "anthropic" as any,
          model: "test",
          usage: { input: 0, output: 0, cacheRead: 0 },
          stopReason: "toolCall" as any,
          timestamp: Date.now(),
        } as AgentMessage;
        history.push(msg);
        history.push(toolResult(`t${i}_ok`, "read", "file contents"));
        history.push(toolResult(`t${i}_err`, "bash", "Command failed with exit code 1", true));
      }

      const result = isStuck(history, { errorTurnLimit: 3 });
      expect(result.stuck).toBe(false);
    });
  });

  describe("isStuck — default thresholds", () => {
    it("uses TOOL_PIVOT_LIMIT=3 as default toolRepeatLimit", () => {
      const history = repeatedFailingCalls("read", { path: "/missing" }, "Error: ENOENT: no such file or directory", 3);

      // No options → should use defaults
      const result = isStuck(history);
      expect(result.stuck).toBe(true);
    });

    it("uses STUCK_WARNING_THRESHOLD=3 as default errorTurnLimit", () => {
      const history = repeatedErrorTurns(3);
      const result = isStuck(history);
      expect(result.stuck).toBe(true);
    });
  });

  describe("isStuck — edge cases", () => {
    it("handles empty history", () => {
      const result = isStuck([]);
      expect(result.stuck).toBe(false);
    });

    it("handles history with only user/assistant text (no tools)", () => {
      const history: AgentMessage[] = [
        { role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() } as unknown as AgentMessage,
        {
          role: "assistant",
          content: [{ type: "text", text: "hello back" }],
          api: "anthropic" as any,
          provider: "anthropic" as any,
          model: "test",
          usage: { input: 0, output: 0, cacheRead: 0 },
          stopReason: "endTurn" as any,
          timestamp: Date.now(),
        } as AgentMessage,
      ];

      const result = isStuck(history);
      expect(result.stuck).toBe(false);
    });

    it("prioritizes tool-level detection over turn-level", () => {
      // 5 identical failing calls in separate turns — should detect as tool repetition first
      const history = repeatedFailingCalls("read", { path: "/missing" }, "Error: ENOENT: no such file or directory", 5);

      const result = isStuck(history, { toolRepeatLimit: 3, errorTurnLimit: 3 });
      expect(result.stuck).toBe(true);
      // Tool-level check runs first, so reason should mention "identical arguments"
      expect(result.reason).toContain("identical arguments");
    });

    it("handles toolResult with string content", () => {
      const history: AgentMessage[] = [
        assistantToolCall("c1", "read", { path: "f.ts" }),
        {
          role: "toolResult",
          toolCallId: "c1",
          toolName: "read",
          content: "plain string content",
          isError: false,
          timestamp: Date.now(),
        } as unknown as AgentMessage,
      ];

      const calls = extractToolCalls(history);
      expect(calls).toHaveLength(1);
      expect(calls[0].output).toBe("plain string content");
    });

    it("custom thresholds work independently", () => {
      // 2 repeats: not stuck at default limit=3, but stuck at limit=2
      const history = repeatedFailingCalls("bash", { command: "make build" }, "Command failed with exit code 2", 2);

      expect(isStuck(history, { toolRepeatLimit: 2 }).stuck).toBe(true);
      expect(isStuck(history, { toolRepeatLimit: 3 }).stuck).toBe(false);
    });
  });
});
