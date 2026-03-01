import { describe, it, expect } from "vitest";
import { extractFailureChains, formatFailureChains } from "../src/evaluator.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

/** Helper to build a minimal assistant message with tool calls. */
function assistantWithCalls(...calls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>): AgentMessage {
  return {
    role: "assistant",
    content: calls.map((c) => ({ type: "toolCall" as const, id: c.id, name: c.name, arguments: c.arguments })),
    api: "anthropic",
    provider: "anthropic",
    model: "test",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, total: 0 } },
    stopReason: "toolCall",
    timestamp: Date.now(),
  } as unknown as AgentMessage;
}

/** Helper to build a tool result message. */
function toolResult(toolCallId: string, toolName: string, text: string, isError = false): AgentMessage {
  return {
    role: "toolResult",
    toolCallId,
    toolName,
    content: [{ type: "text", text }],
    isError,
    timestamp: Date.now(),
  } as unknown as AgentMessage;
}

describe("extractFailureChains", () => {
  it("returns empty for a clean session with no errors", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "read", arguments: { path: "src/index.ts" } }),
      toolResult("1", "read", "export const foo = 1;"),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "src/index.ts", content: "export const foo = 2;" } }),
      toolResult("2", "write", "Wrote 22 bytes"),
    ];
    expect(extractFailureChains(messages)).toEqual([]);
  });

  it("detects a read ENOENT → find → read chain", () => {
    const messages: AgentMessage[] = [
      // Agent tries to read at wrong path
      assistantWithCalls({ id: "1", name: "read", arguments: { path: "/home/user/src/manager.ts" } }),
      toolResult("1", "read", "Error reading file: ENOENT: no such file or directory, open '/home/user/src/manager.ts'"),
      // Agent searches for the file
      assistantWithCalls({ id: "2", name: "exec", arguments: { command: 'find / -name "manager.ts" 2>/dev/null | head -5' } }),
      toolResult("2", "exec", "/home/example-user/may-agent/src/manager.ts"),
      // Agent reads at correct path
      assistantWithCalls({ id: "3", name: "read", arguments: { path: "/home/example-user/may-agent/src/manager.ts" } }),
      toolResult("3", "read", "import { readFileSync } from 'node:fs';"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("read");
    expect(chains[0].trigger.isError).toBe(true);
    expect(chains[0].recovery).toHaveLength(1);
    expect(chains[0].recovery[0].tool).toBe("exec");
    expect(chains[0].resolution).not.toBeNull();
    expect(chains[0].resolution!.tool).toBe("read");
    expect(chains[0].wastedCalls).toBe(2); // trigger + find
    expect(chains[0].rootCause).toContain("ENOENT");
    expect(chains[0].rootCause).toContain("no path hint");
  });

  it("detects multiple ENOENT reads followed by bulk find recovery", () => {
    const messages: AgentMessage[] = [
      // Three parallel reads all fail
      assistantWithCalls(
        { id: "1", name: "read", arguments: { path: "/home/user/run/may.ts" } },
        { id: "2", name: "read", arguments: { path: "/home/user/src/tools.ts" } },
        { id: "3", name: "read", arguments: { path: "/home/user/agents/coder/domain.md" } },
      ),
      toolResult("1", "read", "Error reading file: ENOENT: no such file or directory, open '/home/user/run/may.ts'"),
      toolResult("2", "read", "Error reading file: ENOENT: no such file or directory, open '/home/user/src/tools.ts'"),
      toolResult("3", "read", "Error reading file: ENOENT: no such file or directory, open '/home/user/agents/coder/domain.md'"),
      // Agent searches
      assistantWithCalls(
        { id: "4", name: "exec", arguments: { command: 'find / -name "may.ts" -path "*/run/*"' } },
        { id: "5", name: "exec", arguments: { command: 'find / -name "tools.ts" -path "*/src/*"' } },
      ),
      toolResult("4", "exec", "Exit code null\n"),
      toolResult("5", "exec", "Exit code null\n"),
      // Broader search
      assistantWithCalls({ id: "6", name: "exec", arguments: { command: 'find / -maxdepth 4 -name "package.json"' } }),
      toolResult("6", "exec", "CWD: /home/example-user/may-agent\n/home/example-user/may-agent/package.json"),
      // Now reads succeed
      assistantWithCalls({ id: "7", name: "read", arguments: { path: "/home/example-user/may-agent/run/may.ts" } }),
      toolResult("7", "read", "import { createInterface } from 'readline';"),
    ];

    const chains = extractFailureChains(messages);
    // Should detect at least the first chain (read ENOENT → find → find → find → resolved read)
    expect(chains.length).toBeGreaterThanOrEqual(1);
    expect(chains[0].trigger.tool).toBe("read");
    expect(chains[0].rootCause).toContain("ENOENT");
  });

  it("detects an exec failure chain", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "exec", arguments: { command: "python3 analyze.py" } }),
      toolResult("1", "exec", "Exit code 127\n/bin/sh: python3: not found"),
      assistantWithCalls({ id: "2", name: "exec", arguments: { command: "which python3" } }),
      toolResult("2", "exec", "Exit code 1\n"),
      // Agent gives up and moves on
      assistantWithCalls({ id: "3", name: "write", arguments: { path: "output.txt", content: "done" } }),
      toolResult("3", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("exec");
    expect(chains[0].resolution).toBeNull();
    expect(chains[0].rootCause).toContain("exec failed");
  });

  it("detects find commands that return empty as errors", () => {
    const messages: AgentMessage[] = [
      // Agent blindly searches from wrong prefix
      assistantWithCalls({ id: "1", name: "exec", arguments: { command: 'find /home/user -type f -name "*.test.ts"' } }),
      toolResult("1", "exec", "CWD: /home/example-user/may-agent\n(no output)"),
      // Broader search
      assistantWithCalls({ id: "2", name: "exec", arguments: { command: 'find /home -type f -name "*.test.ts" 2>/dev/null | head -30' } }),
      toolResult("2", "exec", "/home/example-user/.npm/_npx/something/node_modules/test.ts"),
      // Agent finally uses the correct path
      assistantWithCalls({ id: "3", name: "exec", arguments: { command: "ls /home/example-user/may-agent/test/" } }),
      toolResult("3", "exec", "create-tool.test.ts\nedge-cases.test.ts"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains.length).toBeGreaterThanOrEqual(1);
    expect(chains[0].rootCause).toContain("blind filesystem search");
    expect(chains[0].rootCause).toContain("guessing paths");
  });

  it("does not flag find commands that return results as errors", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "exec", arguments: { command: 'find . -name "*.ts" | head -5' } }),
      toolResult("1", "exec", "./src/index.ts\n./src/manager.ts"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("handles a chain with no recovery attempts", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "read", arguments: { path: "/nonexistent/file.ts" } }),
      toolResult("1", "read", "Error reading file: ENOENT: no such file or directory"),
      // Agent immediately does something unrelated
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "output.txt", content: "hello" } }),
      toolResult("2", "write", "Wrote 5 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].recovery).toHaveLength(0);
    expect(chains[0].resolution).toBeNull();
    expect(chains[0].wastedCalls).toBe(1); // just the trigger
  });

  it("handles isError flag from tool result", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "exec", arguments: { command: "bad-command" } }),
      toolResult("1", "exec", "Command not found", true),
      assistantWithCalls({ id: "2", name: "exec", arguments: { command: "which bad-command" } }),
      toolResult("2", "exec", "", true),
      assistantWithCalls({ id: "3", name: "read", arguments: { path: "src/index.ts" } }),
      toolResult("3", "read", "export const foo = 1;"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty for a session with only user/assistant text", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() } as unknown as AgentMessage,
      {
        role: "assistant",
        content: [{ type: "text", text: "hi there" }],
        api: "anthropic", provider: "anthropic", model: "test",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, total: 0 } },
        stopReason: "end", timestamp: Date.now(),
      } as unknown as AgentMessage,
    ];
    expect(extractFailureChains(messages)).toEqual([]);
  });
});

describe("formatFailureChains", () => {
  it("returns empty string for no chains", () => {
    expect(formatFailureChains([])).toBe("");
  });

  it("formats a chain with trigger, recovery, and resolution", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "read", arguments: { path: "/wrong/path.ts" } }),
      toolResult("1", "read", "Error reading file: ENOENT: no such file or directory, open '/wrong/path.ts'"),
      assistantWithCalls({ id: "2", name: "exec", arguments: { command: "find . -name path.ts" } }),
      toolResult("2", "exec", "./src/path.ts"),
      assistantWithCalls({ id: "3", name: "read", arguments: { path: "./src/path.ts" } }),
      toolResult("3", "read", "export const x = 1;"),
    ];

    const chains = extractFailureChains(messages);
    const formatted = formatFailureChains(chains);

    expect(formatted).toContain("Failure Chains");
    expect(formatted).toContain("root cause");
    expect(formatted).toContain("ENOENT");
    expect(formatted).toContain("wasted call");
    expect(formatted).toContain("address the **root cause**");
  });

  it("includes guidance about fixing triggers not symptoms", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "read", arguments: { path: "/bad/file.ts" } }),
      toolResult("1", "read", "Error reading file: ENOENT: no such file or directory"),
      assistantWithCalls({ id: "2", name: "exec", arguments: { command: "pwd" } }),
      toolResult("2", "exec", "/home/example-user/project"),
      assistantWithCalls({ id: "3", name: "read", arguments: { path: "/home/example-user/project/file.ts" } }),
      toolResult("3", "read", "content"),
    ];

    const chains = extractFailureChains(messages);
    const formatted = formatFailureChains(chains);

    expect(formatted).toContain("read tool returned ENOENT");
    expect(formatted).toContain("no path hint");
    expect(formatted).toContain("fix is in the read tool");
  });
});
