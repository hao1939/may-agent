import { describe, it, expect } from "vitest";
import { extractFailureChains, formatFailureChains } from "../src/lib/evaluator.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

/** Helper to build a minimal assistant message with tool calls. */
function assistantWithCalls(
  ...calls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
): AgentMessage {
  return {
    role: "assistant",
    content: calls.map((c) => ({ type: "toolCall" as const, id: c.id, name: c.name, arguments: c.arguments })),
    api: "anthropic",
    provider: "anthropic",
    model: "test",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, total: 0 },
    },
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
      assistantWithCalls({
        id: "2",
        name: "write",
        arguments: { path: "src/index.ts", content: "export const foo = 2;" },
      }),
      toolResult("2", "write", "Wrote 22 bytes"),
    ];
    expect(extractFailureChains(messages)).toEqual([]);
  });

  it("detects a read ENOENT → find → read chain", () => {
    const messages: AgentMessage[] = [
      // Agent tries to read at wrong path
      assistantWithCalls({ id: "1", name: "read", arguments: { path: "/home/user/src/manager.ts" } }),
      toolResult(
        "1",
        "read",
        "Error reading file: ENOENT: no such file or directory, open '/home/user/src/manager.ts'",
      ),
      // Agent searches for the file
      assistantWithCalls({
        id: "2",
        name: "bash",
        arguments: { command: 'find / -name "manager.ts" 2>/dev/null | head -5' },
      }),
      toolResult("2", "bash", "/home/hao/may-agent/src/manager.ts"),
      // Agent reads at correct path
      assistantWithCalls({ id: "3", name: "read", arguments: { path: "/home/hao/may-agent/src/manager.ts" } }),
      toolResult("3", "read", "import { readFileSync } from 'node:fs';"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("read");
    expect(chains[0].trigger.isError).toBe(true);
    expect(chains[0].recovery).toHaveLength(1);
    expect(chains[0].recovery[0].tool).toBe("bash");
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
      toolResult(
        "3",
        "read",
        "Error reading file: ENOENT: no such file or directory, open '/home/user/agents/coder/domain.md'",
      ),
      // Agent searches
      assistantWithCalls(
        { id: "4", name: "bash", arguments: { command: 'find / -name "may.ts" -path "*/run/*"' } },
        { id: "5", name: "bash", arguments: { command: 'find / -name "tools.ts" -path "*/src/*"' } },
      ),
      toolResult("4", "bash", "Exit code null\n"),
      toolResult("5", "bash", "Exit code null\n"),
      // Broader search
      assistantWithCalls({ id: "6", name: "bash", arguments: { command: 'find / -maxdepth 4 -name "package.json"' } }),
      toolResult("6", "bash", "CWD: /home/hao/may-agent\n/home/hao/may-agent/package.json"),
      // Now reads succeed
      assistantWithCalls({ id: "7", name: "read", arguments: { path: "/home/hao/may-agent/run/may.ts" } }),
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
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "python3 analyze.py" } }),
      toolResult("1", "bash", "Exit code 127\n/bin/sh: python3: not found"),
      assistantWithCalls({ id: "2", name: "bash", arguments: { command: "which python3" } }),
      toolResult("2", "bash", "Exit code 1\n"),
      // Agent gives up and moves on
      assistantWithCalls({ id: "3", name: "write", arguments: { path: "output.txt", content: "done" } }),
      toolResult("3", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("bash");
    expect(chains[0].resolution).toBeNull();
    expect(chains[0].rootCause).toContain("exec failed");
  });

  it("detects find commands that return empty as errors", () => {
    const messages: AgentMessage[] = [
      // Agent blindly searches from wrong prefix
      assistantWithCalls({
        id: "1",
        name: "bash",
        arguments: { command: 'find /home/user -type f -name "*.test.ts"' },
      }),
      toolResult("1", "bash", "CWD: /home/hao/may-agent\n(no output)"),
      // Broader search
      assistantWithCalls({
        id: "2",
        name: "bash",
        arguments: { command: 'find /home -type f -name "*.test.ts" 2>/dev/null | head -30' },
      }),
      toolResult("2", "bash", "/home/hao/.npm/_npx/something/node_modules/test.ts"),
      // Agent finally uses the correct path
      assistantWithCalls({ id: "3", name: "bash", arguments: { command: "ls /home/hao/may-agent/test/" } }),
      toolResult("3", "bash", "create-tool.test.ts\nedge-cases.test.ts"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains.length).toBeGreaterThanOrEqual(1);
    expect(chains[0].rootCause).toContain("blind filesystem search");
    expect(chains[0].rootCause).toContain("guessing paths");
  });

  it("does not flag find commands that return results as errors", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: 'find . -name "*.ts" | head -5' } }),
      toolResult("1", "bash", "./src/index.ts\n./src/manager.ts"),
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
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "bad-command" } }),
      toolResult("1", "bash", "Command not found", true),
      assistantWithCalls({ id: "2", name: "bash", arguments: { command: "which bad-command" } }),
      toolResult("2", "bash", "", true),
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
        api: "anthropic",
        provider: "anthropic",
        model: "test",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, total: 0 },
        },
        stopReason: "end",
        timestamp: Date.now(),
      } as unknown as AgentMessage,
    ];
    expect(extractFailureChains(messages)).toEqual([]);
  });

  // ── False positive prevention tests ──────────────────────────────────

  it("does not flag read tool result containing ENOENT in file content as error", () => {
    // read tool successfully reads a file (isError: false) whose content
    // includes "ENOENT" — e.g., reading evaluator.ts or error-handling code
    const fileContent = `
      try {
        const content = readFileSync(path, "utf-8");
      } catch (err) {
        if (err.code === "ENOENT") {
          return "Error reading file: " + err.message;
        }
      }
    `;
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "read", arguments: { path: "src/tools.ts" } }),
      toolResult("1", "read", fileContent),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "src/tools.ts", content: "updated" } }),
      toolResult("2", "write", "Wrote 7 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("does not flag exec git diff output containing error strings as error", () => {
    // exec tool runs `git diff` (isError: false) and the diff output contains
    // lines with "ENOENT", "Error reading file", and "Exit code 1" as diff content
    const diffOutput = `CWD: /home/user/project
diff --git a/src/evaluator.ts b/src/evaluator.ts
index abc1234..def5678 100644
--- a/src/evaluator.ts
+++ b/src/evaluator.ts
@@ -140,7 +140,7 @@
-          || resultText.includes("ENOENT")
-          || resultText.includes("Error reading file")
-          || /Exit code (?!0\\b)\\S+/.test(resultText)
+          || isToolOwnError(toolName, resultText)
`;
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "git diff src/evaluator.ts" } }),
      toolResult("1", "bash", diffOutput),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "output.md", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("does not flag exec test output mentioning errors as a tool failure", () => {
    // exec tool runs tests (isError: false) and the test output shows test names
    // containing error strings like "handles ENOENT correctly"
    const testOutput = `CWD: /home/user/project
 ✓ src/evaluator.test.ts (5 tests) 42ms
   ✓ handles ENOENT correctly
   ✓ returns Exit code 1 for missing commands
   ✓ Error reading file returns proper message
   ✓ detects non-zero exit codes
   ✓ works with valid input

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  1.23s
`;
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "npx vitest --run" } }),
      toolResult("1", "bash", testOutput),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("still detects genuine read tool ENOENT errors via isError flag", () => {
    // read tool fails with isError: true — the primary contract.
    // This validates that tr.isError is authoritative.
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "read", arguments: { path: "/wrong/path/file.ts" } }),
      toolResult(
        "1",
        "read",
        "Error reading file: ENOENT: no such file or directory, open '/wrong/path/file.ts'",
        true,
      ),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "output.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("read");
    expect(chains[0].trigger.isError).toBe(true);
    expect(chains[0].rootCause).toContain("ENOENT");
  });

  it("still detects genuine read tool ENOENT errors via heuristic fallback", () => {
    // read tool fails but isError is false (as createReadTool actually behaves —
    // it catches errors internally and returns error text without throwing).
    // The heuristic "starts with Error reading file:" catches this.
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "read", arguments: { path: "/wrong/path/file.ts" } }),
      toolResult("1", "read", "Error reading file: ENOENT: no such file or directory, open '/wrong/path/file.ts'"),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "output.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("read");
    expect(chains[0].trigger.isError).toBe(true);
    expect(chains[0].rootCause).toContain("ENOENT");
  });

  it("still detects genuine exec non-zero exit code errors via isError flag", () => {
    // exec tool fails with isError: true — the primary contract.
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "npm run build" } }),
      toolResult(
        "1",
        "bash",
        "Exit code 2\nsrc/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.",
        true,
      ),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "output.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("bash");
    expect(chains[0].trigger.isError).toBe(true);
  });

  it("still detects genuine exec non-zero exit code errors via heuristic fallback", () => {
    // exec tool fails but isError is false (as createExecTool actually behaves —
    // it catches errors internally and returns "Exit code N\n..." without throwing).
    // The heuristic "starts with Exit code N" catches this.
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "npm run build" } }),
      toolResult(
        "1",
        "bash",
        "Exit code 2\nsrc/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.",
      ),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "output.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("bash");
    expect(chains[0].trigger.isError).toBe(true);
  });

  it("detects exec errors with CWD prefix via heuristic fallback", () => {
    // With echoCwd enabled, exec errors now include "CWD: /path\nExit code N\n..."
    // The heuristic must strip the CWD prefix before checking for the error pattern.
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "ls /home/user/nonexistent" } }),
      toolResult(
        "1",
        "bash",
        "CWD: /home/hao/may-agent\nExit code 2\nls: cannot access '/home/user/nonexistent': No such file or directory",
      ),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "output.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("bash");
    expect(chains[0].trigger.isError).toBe(true);
  });

  it("does not flag exec cat/grep of source code containing error patterns", () => {
    // exec runs `cat src/evaluator.ts` and the output contains all the error
    // pattern strings — should NOT create a failure chain since the exec tool
    // succeeded (isError: false, output doesn't START with "Exit code")
    const catOutput = `CWD: /home/user/project
import { readFileSync } from "node:fs";

// Check for ENOENT errors
function handleError(err) {
  if (err.code === "ENOENT") {
    return "Error reading file: " + err.message;
  }
  // Exit code 1 means failure
  if (result.exitCode !== 0) {
    throw new Error("Exit code " + result.exitCode);
  }
}
`;
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "cat src/evaluator.ts" } }),
      toolResult("1", "bash", catOutput),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "output.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  // ── Expected non-zero exit code tests (false positive prevention) ────

  it("does not flag grep with no matches (exit 1) as error", () => {
    // grep exits 1 when no lines match — this is normal, not an error
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: 'grep -r "nonexistentPattern" src/' } }),
      toolResult("1", "bash", "Exit code 1\n"),
      // Agent moves on (not a recovery attempt)
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "notes.md", content: "pattern not found" } }),
      toolResult("2", "write", "Wrote 17 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("does not flag grep -c returning 0 (exit 1) as error", () => {
    // grep -c outputs "0" and exits 1 when no matches — completely normal
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: 'grep -c "pattern" file.ts' } }),
      toolResult("1", "bash", "Exit code 1\n0\n"),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("does not flag grep with CWD prefix and no matches as error", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({
        id: "1",
        name: "bash",
        arguments: { command: 'grep -n "buildSystemPrompt" src/manager.ts' },
      }),
      toolResult("1", "bash", "CWD: /home/hao/may-agent\nExit code 1\n"),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("does not flag pipe ending in grep with no matches as error", () => {
    // e.g., "pip show litellm | grep -i version" — grep at end of pipe exits 1
    const messages: AgentMessage[] = [
      assistantWithCalls({
        id: "1",
        name: "bash",
        arguments: { command: "pip show litellm 2>/dev/null | grep -i version" },
      }),
      toolResult("1", "bash", "Exit code 1\n"),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("does not flag git diff with changes (exit 1) as error", () => {
    // git diff exits 1 when there ARE differences — the diff output IS the result
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "git diff HEAD" } }),
      toolResult(
        "1",
        "bash",
        "Exit code 1\ndiff --git a/src/evaluator.ts b/src/evaluator.ts\nindex abc..def 100644\n--- a/src/evaluator.ts\n+++ b/src/evaluator.ts",
      ),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("does not flag git diff with CWD prefix and changes as error", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "git diff HEAD -- src/tools.ts" } }),
      toolResult(
        "1",
        "bash",
        "CWD: /home/hao/may-agent\nExit code 1\ndiff --git a/src/tools.ts b/src/tools.ts\n--- a/src/tools.ts\n+++ b/src/tools.ts",
      ),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("does not flag commands with 2>/dev/null that exit 1 with empty output", () => {
    // Intentional error suppression pattern: "cat file 2>/dev/null || cat other"
    const messages: AgentMessage[] = [
      assistantWithCalls({
        id: "1",
        name: "bash",
        arguments: { command: "cat vitest.config.ts 2>/dev/null || cat vite.config.ts 2>/dev/null" },
      }),
      toolResult("1", "bash", "Exit code 1\n"),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(0);
  });

  it("still flags grep exit 2 (actual error) as error", () => {
    // grep exit 2 means an actual error (e.g., invalid regex), not "no match"
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: 'grep -r "[invalid" src/' } }),
      toolResult("1", "bash", "Exit code 2\ngrep: Invalid regular expression"),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("bash");
  });

  it("still flags git diff exit 128 (not a git repo) as error", () => {
    // git diff exits 128 for fatal errors — this IS a real error
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "git diff HEAD" } }),
      toolResult("1", "bash", "Exit code 128\nfatal: not a git repository"),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("bash");
  });

  it("still flags non-grep non-runner commands with exit 1 as errors", () => {
    // A command like `node script.js` exiting 1 is a real failure
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "node deploy.js --production" } }),
      toolResult("1", "bash", "Exit code 1\nError: Connection refused"),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
    expect(chains[0].trigger.tool).toBe("bash");
  });

  it("still flags commands with 2>/dev/null exit 1 WITH output as errors", () => {
    // If there's meaningful error output despite 2>/dev/null, something went wrong
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "bash", arguments: { command: "python3 -c 'import litellm' 2>/dev/null" } }),
      toolResult(
        "1",
        "bash",
        "Exit code 1\nTraceback (most recent call last):\n  ModuleNotFoundError: No module named 'litellm'",
      ),
      assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
      toolResult("2", "write", "Wrote 4 bytes"),
    ];

    const chains = extractFailureChains(messages);
    expect(chains).toHaveLength(1);
  });
});

// ── Test/build runner false positive prevention ───────────────────────

it("does not flag vitest exit 1 (test failures) as error", () => {
  // Agent runs tests, some fail — this is normal development cycle
  const messages: AgentMessage[] = [
    assistantWithCalls({ id: "1", name: "bash", arguments: { command: "npx vitest --run" } }),
    toolResult(
      "1",
      "bash",
      "Exit code 1\n\n RUN  v3.2.4 /home/hao/may-agent\n\n ❯ test/exec-tool.test.ts (21 tests | 4 failed) 158ms",
    ),
    assistantWithCalls({ id: "2", name: "write", arguments: { path: "src/tools.ts", content: "fixed code" } }),
    toolResult("2", "write", "Wrote 10 bytes"),
  ];

  const chains = extractFailureChains(messages);
  expect(chains).toHaveLength(0);
});

it("does not flag vitest run with specific test file as error", () => {
  const messages: AgentMessage[] = [
    assistantWithCalls({ id: "1", name: "bash", arguments: { command: "npx vitest run test/max-turns.test.ts 2>&1" } }),
    toolResult("1", "bash", "Exit code 1\n\n RUN  v3.2.4\n\n ❯ test/max-turns.test.ts (31 tests | 25 failed)"),
    assistantWithCalls({ id: "2", name: "write", arguments: { path: "src/manager.ts", content: "fix" } }),
    toolResult("2", "write", "Wrote 3 bytes"),
  ];

  const chains = extractFailureChains(messages);
  expect(chains).toHaveLength(0);
});

it("does not flag vitest with cd prefix as error", () => {
  const messages: AgentMessage[] = [
    assistantWithCalls({
      id: "1",
      name: "bash",
      arguments: { command: "cd /home/hao/may-agent && npx vitest --run 2>&1" },
    }),
    toolResult("1", "bash", "Exit code 1\n\n RUN  v3.2.4\n\n ❯ test/foo.test.ts (5 tests | 2 failed)"),
    assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
    toolResult("2", "write", "Wrote 4 bytes"),
  ];

  const chains = extractFailureChains(messages);
  expect(chains).toHaveLength(0);
});

it("does not flag jest exit 1 as error", () => {
  const messages: AgentMessage[] = [
    assistantWithCalls({ id: "1", name: "bash", arguments: { command: "npx jest --run" } }),
    toolResult("1", "bash", "Exit code 1\nFAIL src/index.test.ts\n  ✕ should work"),
    assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
    toolResult("2", "write", "Wrote 4 bytes"),
  ];

  const chains = extractFailureChains(messages);
  expect(chains).toHaveLength(0);
});

it("does not flag npm test exit 1 as error", () => {
  const messages: AgentMessage[] = [
    assistantWithCalls({ id: "1", name: "bash", arguments: { command: "npm test" } }),
    toolResult("1", "bash", "Exit code 1\n> test\n> vitest --run\n\nFailed tests"),
    assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
    toolResult("2", "write", "Wrote 4 bytes"),
  ];

  const chains = extractFailureChains(messages);
  expect(chains).toHaveLength(0);
});

it("does not flag npm run build exit 1 as error", () => {
  const messages: AgentMessage[] = [
    assistantWithCalls({ id: "1", name: "bash", arguments: { command: "npm run build" } }),
    toolResult("1", "bash", "Exit code 1\nERROR: Build failed with errors"),
    assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
    toolResult("2", "write", "Wrote 4 bytes"),
  ];

  const chains = extractFailureChains(messages);
  expect(chains).toHaveLength(0);
});

it("does not flag tsc --noEmit exit 1 as error", () => {
  const messages: AgentMessage[] = [
    assistantWithCalls({ id: "1", name: "bash", arguments: { command: "npx tsc --noEmit 2>&1" } }),
    toolResult("1", "bash", "Exit code 1\nsrc/tools.ts(42,5): error TS2322: Type 'string' is not assignable"),
    assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
    toolResult("2", "write", "Wrote 4 bytes"),
  ];

  const chains = extractFailureChains(messages);
  expect(chains).toHaveLength(0);
});

it("does not flag vitest piped to grep as error", () => {
  // Common pattern: npx vitest --run 2>&1 | grep -A 20 "FAIL"
  const messages: AgentMessage[] = [
    assistantWithCalls({ id: "1", name: "bash", arguments: { command: 'npx vitest --run 2>&1 | grep -A 20 "FAIL"' } }),
    toolResult(
      "1",
      "bash",
      " FAIL  test/exec-tool.test.ts > warnOutsideRoot > warns when command uses /home/user path",
    ),
    assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
    toolResult("2", "write", "Wrote 4 bytes"),
  ];

  const chains = extractFailureChains(messages);
  expect(chains).toHaveLength(0);
});

it("still flags vitest exit 2 (configuration error) as error", () => {
  // Exit code 2+ from test runners indicates a config/setup error, not test failures
  const messages: AgentMessage[] = [
    assistantWithCalls({ id: "1", name: "bash", arguments: { command: "npx vitest --run" } }),
    toolResult("1", "bash", "Exit code 2\nError: Cannot find module 'vitest'"),
    assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
    toolResult("2", "write", "Wrote 4 bytes"),
  ];

  const chains = extractFailureChains(messages);
  expect(chains).toHaveLength(1);
  expect(chains[0].trigger.tool).toBe("bash");
});

it("still flags random commands exit 1 that aren't test/build runners", () => {
  // Regular commands that exit 1 should still be flagged
  const messages: AgentMessage[] = [
    assistantWithCalls({ id: "1", name: "bash", arguments: { command: "curl https://api.example.com/health" } }),
    toolResult("1", "bash", "Exit code 1\ncurl: (6) Could not resolve host"),
    assistantWithCalls({ id: "2", name: "write", arguments: { path: "out.txt", content: "done" } }),
    toolResult("2", "write", "Wrote 4 bytes"),
  ];

  const chains = extractFailureChains(messages);
  expect(chains).toHaveLength(1);
});

describe("formatFailureChains", () => {
  it("returns empty string for no chains", () => {
    expect(formatFailureChains([])).toBe("");
  });

  it("formats a chain with trigger, recovery, and resolution", () => {
    const messages: AgentMessage[] = [
      assistantWithCalls({ id: "1", name: "read", arguments: { path: "/wrong/path.ts" } }),
      toolResult("1", "read", "Error reading file: ENOENT: no such file or directory, open '/wrong/path.ts'"),
      assistantWithCalls({ id: "2", name: "bash", arguments: { command: "find . -name path.ts" } }),
      toolResult("2", "bash", "./src/path.ts"),
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
      assistantWithCalls({ id: "2", name: "bash", arguments: { command: "pwd" } }),
      toolResult("2", "bash", "/home/hao/project"),
      assistantWithCalls({ id: "3", name: "read", arguments: { path: "/home/hao/project/file.ts" } }),
      toolResult("3", "read", "content"),
    ];

    const chains = extractFailureChains(messages);
    const formatted = formatFailureChains(chains);

    expect(formatted).toContain("read tool returned ENOENT");
    expect(formatted).toContain("no path hint");
    expect(formatted).toContain("fix is in the read tool");
  });
});
