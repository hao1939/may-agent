import { describe, it, expect } from "bun:test";
import { extractFailureChains, formatFailureChains } from "../evaluation/failure-chain.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

function makeToolCallMsg(id: string, name: string, args: Record<string, unknown>): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id, name, arguments: args }],
  } as any;
}

function makeToolResultMsg(
  toolCallId: string,
  toolName: string,
  text: string,
  isError = false,
): AgentMessage {
  return {
    role: "toolResult",
    toolCallId,
    toolName,
    content: [{ type: "text", text }],
    isError,
  } as any;
}

describe("extractFailureChains", () => {
  it("returns empty array for no messages", () => {
    expect(extractFailureChains([])).toEqual([]);
  });

  it("returns empty array for all successful calls", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "read", { path: "file.ts" }),
      makeToolResultMsg("1", "read", "file contents", false),
      makeToolCallMsg("2", "bash", { command: "echo hi" }),
      makeToolResultMsg("2", "bash", "CWD: /app\nhi", false),
    ];
    expect(extractFailureChains(messages)).toEqual([]);
  });

  it("detects a failure chain from ENOENT read error followed by recovery", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "read", { path: "/wrong/path/file.ts" }),
      makeToolResultMsg("1", "read", "Error reading file: ENOENT no such file", false),
      makeToolCallMsg("2", "bash", { command: "find / -name file.ts" }),
      makeToolResultMsg("2", "bash", "CWD: /app\n/correct/path/file.ts", false),
      makeToolCallMsg("3", "read", { path: "/correct/path/file.ts" }),
      makeToolResultMsg("3", "read", "actual contents", false),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(1);
    expect(chains[0].trigger.tool).toBe("read");
    expect(chains[0].resolution).not.toBeNull();
    expect(chains[0].rootCause).toContain("ENOENT");
  });

  it("detects bash failure with non-zero exit code", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "bash", { command: "cat /nonexistent" }),
      makeToolResultMsg("1", "bash", "CWD: /app\nExit code 1\nNo such file"),
      makeToolCallMsg("2", "bash", { command: "find . -name nonexistent" }),
      makeToolResultMsg("2", "bash", "CWD: /app\n./src/nonexistent", false),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(1);
    expect(chains[0].trigger.tool).toBe("bash");
    expect(chains[0].wastedCalls).toBe(2);
  });

  it("does NOT flag grep exit 1 as failure (expected non-zero)", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "bash", { command: "grep -r 'pattern' src/" }),
      makeToolResultMsg("1", "bash", "CWD: /app\nExit code 1\n"),
      makeToolCallMsg("2", "bash", { command: "echo done" }),
      makeToolResultMsg("2", "bash", "CWD: /app\ndone", false),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(0);
  });

  it("does NOT flag vitest exit 1 as failure (test runner)", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "bash", { command: "npx vitest run" }),
      makeToolResultMsg("1", "bash", "CWD: /app\nExit code 1\n1 test failed"),
      makeToolCallMsg("2", "bash", { command: "echo next" }),
      makeToolResultMsg("2", "bash", "CWD: /app\nnext", false),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(0);
  });

  it("does NOT flag 'which' exit 1 as failure (existence check)", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "bash", { command: "which python3" }),
      makeToolResultMsg("1", "bash", "CWD: /app\nExit code 1\n"),
      makeToolCallMsg("2", "bash", { command: "echo fallback" }),
      makeToolResultMsg("2", "bash", "CWD: /app\nfallback", false),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(0);
  });

  it("does NOT flag git diff exit 1 with diff output", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "bash", { command: "git diff HEAD" }),
      makeToolResultMsg("1", "bash", "CWD: /app\nExit code 1\ndiff --git a/file.ts b/file.ts"),
      makeToolCallMsg("2", "bash", { command: "echo next" }),
      makeToolResultMsg("2", "bash", "CWD: /app\nnext", false),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(0);
  });

  it("flags find with hallucinated path returning empty", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "bash", { command: "find /home/user -name config.ts" }),
      makeToolResultMsg("1", "bash", "CWD: /app\n"),
      makeToolCallMsg("2", "bash", { command: "find . -name config.ts" }),
      makeToolResultMsg("2", "bash", "CWD: /app\n./src/config.ts", false),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(1);
    expect(chains[0].rootCause).toContain("exec failed");
  });

  it("does NOT flag find from relative path returning empty", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "bash", { command: "find . -name nonexistent.ts" }),
      makeToolResultMsg("1", "bash", "CWD: /app\n"),
      makeToolCallMsg("2", "bash", { command: "echo done" }),
      makeToolResultMsg("2", "bash", "CWD: /app\ndone", false),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(0);
  });

  it("handles explicit isError from tool result", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "read", { path: "bad.ts" }),
      makeToolResultMsg("1", "read", "Permission denied", true),
      makeToolCallMsg("2", "bash", { command: "ls ." }),
      makeToolResultMsg("2", "bash", "CWD: /app\nfile1.ts", false),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(1);
  });

  it("unresolved chain when agent moves on", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "read", { path: "/bad/file.ts" }),
      makeToolResultMsg("1", "read", "Error reading file: ENOENT", false),
      makeToolCallMsg("2", "bash", { command: "find . -name file.ts" }),
      makeToolResultMsg("2", "bash", "CWD: /app\nExit code 1\n"),
      // Agent moves on to unrelated task
      makeToolCallMsg("3", "bash", { command: "echo hello" }),
      makeToolResultMsg("3", "bash", "CWD: /app\nhello", false),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBeGreaterThanOrEqual(1);
    // The first chain should be unresolved (agent moved on)
    expect(chains[0].resolution).toBeNull();
  });

  it("does NOT flag diff (non-git) exit 1", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "bash", { command: "diff file1.ts file2.ts" }),
      makeToolResultMsg("1", "bash", "CWD: /app\nExit code 1\n< line1"),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(0);
  });

  it("does NOT flag ls with glob exit 2", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "bash", { command: "ls agents/*/domain.md" }),
      makeToolResultMsg("1", "bash", "CWD: /app\nExit code 2\n"),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(0);
  });

  it("does NOT flag git commit exit 1", () => {
    const messages: AgentMessage[] = [
      makeToolCallMsg("1", "bash", { command: "git commit -m 'test'" }),
      makeToolResultMsg("1", "bash", "CWD: /app\nExit code 1\nnothing to commit"),
    ];
    const chains = extractFailureChains(messages);
    expect(chains.length).toBe(0);
  });
});

describe("formatFailureChains", () => {
  it("returns empty string for no chains", () => {
    expect(formatFailureChains([])).toBe("");
  });

  it("formats chains with trigger, recovery, and resolution", () => {
    const chains = [
      {
        trigger: { tool: "read", args: '{"path":"/bad"}', result: "ENOENT", isError: true },
        recovery: [{ tool: "bash", args: '{"command":"find . -name bad"}', result: "./src/bad", isError: false }],
        resolution: { tool: "read", args: '{"path":"./src/bad"}', result: "contents", isError: false },
        wastedCalls: 2,
        rootCause: "read tool returned ENOENT",
      },
    ];
    const result = formatFailureChains(chains);
    expect(result).toContain("## Failure Chains");
    expect(result).toContain("Chain 1 (2 wasted calls)");
    expect(result).toContain("**Root cause:** read tool returned ENOENT");
    expect(result).toContain("**resolved:**");
    expect(result).toContain("Total wasted calls from failure chains: 2");
  });

  it("shows unresolved when no resolution", () => {
    const chains = [
      {
        trigger: { tool: "read", args: '{"path":"/x"}', result: "ENOENT", isError: true },
        recovery: [],
        resolution: null,
        wastedCalls: 1,
        rootCause: "file not found",
      },
    ];
    const result = formatFailureChains(chains);
    expect(result).toContain("**unresolved**");
  });
});
