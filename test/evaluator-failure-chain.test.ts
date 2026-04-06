import { describe, it, expect } from "vitest";
import {
  extractFailureChains,
  formatFailureChains,
  type FailureChain,
} from "../src/lib/evaluator-failure-chain.js";

// Helper to build minimal AgentMessage arrays for testing.
// The real type is complex; we only need role + content structure.

function assistantWithToolCall(id: string, name: string, args: Record<string, unknown>) {
  return {
    role: "assistant" as const,
    content: [
      {
        type: "toolCall" as const,
        id,
        name,
        arguments: args,
      },
    ],
  };
}

function toolResult(
  toolCallId: string,
  toolName: string,
  text: string,
  isError = false,
) {
  return {
    role: "toolResult" as const,
    toolCallId,
    toolName,
    content: [{ type: "text" as const, text }],
    isError,
  };
}

describe("extractFailureChains", () => {
  // ── Empty / no errors ─────────────────────────────────────────────
  describe("no failures", () => {
    it("returns empty array for empty messages", () => {
      expect(extractFailureChains([])).toEqual([]);
    });

    it("returns empty array for all-successful tool calls", () => {
      const messages = [
        assistantWithToolCall("1", "read", { path: "src/index.ts" }),
        toolResult("1", "read", "export default function main() { ... }"),
        assistantWithToolCall("2", "bash", { command: "echo hello" }),
        toolResult("2", "bash", "CWD: /app\nhello"),
      ] as any[];
      expect(extractFailureChains(messages)).toEqual([]);
    });
  });

  // ── Single failure, no recovery ───────────────────────────────────
  describe("single failure chain", () => {
    it("detects a read ENOENT failure with no recovery", () => {
      const messages = [
        assistantWithToolCall("1", "read", { path: "/wrong/path.ts" }),
        toolResult("1", "read", "Error reading file: ENOENT: no such file or directory", true),
        // Next call is something different (not recovery)
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(1);
      expect(chains[0].trigger.tool).toBe("read");
      expect(chains[0].trigger.isError).toBe(true);
      expect(chains[0].recovery).toHaveLength(0);
      expect(chains[0].resolution).toBeNull();
      expect(chains[0].wastedCalls).toBe(1);
    });

    it("detects bash command failure (non-zero exit code)", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "cat /nonexistent" }),
        toolResult("1", "bash", "CWD: /app\nExit code 1\ncat: /nonexistent: No such file or directory"),
        assistantWithToolCall("2", "bash", { command: "echo next" }),
        toolResult("2", "bash", "CWD: /app\nnext"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(1);
      expect(chains[0].trigger.tool).toBe("bash");
    });
  });

  // ── Failure with recovery ─────────────────────────────────────────
  describe("failure with recovery attempts", () => {
    it("detects read failure → find → re-read chain", () => {
      const messages = [
        // Initial failure: wrong path
        assistantWithToolCall("1", "read", { path: "src/lib/old-name.ts" }),
        toolResult("1", "read", "Error reading file: ENOENT: no such file or directory", true),
        // Recovery: search for the file
        assistantWithToolCall("2", "bash", { command: "find . -name 'old-name.ts'" }),
        toolResult("2", "bash", "CWD: /app\n(no output)"),
        // Another recovery: try ls
        assistantWithToolCall("3", "bash", { command: "ls src/lib/" }),
        toolResult("3", "bash", "CWD: /app\nnew-name.ts\nindex.ts"),
        // Resolution: read the correct file
        assistantWithToolCall("4", "read", { path: "src/lib/new-name.ts" }),
        toolResult("4", "read", "export function main() {}"),
      ] as any[];

      // Note: the find returning no results from . is NOT an error (local find),
      // and the ls is a recovery. The re-read of a file with same name would be
      // resolution only if filenames match. Since old-name.ts != new-name.ts,
      // this won't match as resolution.
      const chains = extractFailureChains(messages);
      expect(chains.length).toBeGreaterThanOrEqual(1);
      expect(chains[0].trigger.tool).toBe("read");
      expect(chains[0].trigger.isError).toBe(true);
    });
  });

  // ── Expected non-zero exits are NOT failures ──────────────────────
  describe("expected non-zero exits are not treated as errors", () => {
    it("does not flag grep exit 1 as a failure", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "grep -rn 'nonexistent' src/" }),
        toolResult("1", "bash", "CWD: /app\nExit code 1"),
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });

    it("does not flag vitest exit 1 as a failure", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "npx vitest run test/my.test.ts" }),
        toolResult("1", "bash", "CWD: /app\nExit code 1\n1 test failed"),
        assistantWithToolCall("2", "bash", { command: "echo fixing" }),
        toolResult("2", "bash", "CWD: /app\nfixing"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });

    it("does not flag tsc --noEmit exit 1 as a failure", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "npx tsc --noEmit" }),
        toolResult("1", "bash", "CWD: /app\nExit code 1\nsrc/index.ts(5,3): error TS2322"),
        assistantWithToolCall("2", "bash", { command: "echo fixing" }),
        toolResult("2", "bash", "CWD: /app\nfixing"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });

    it("does not flag git diff exit 1 with diff output as a failure", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "git diff HEAD~1" }),
        toolResult("1", "bash", "CWD: /app\nExit code 1\ndiff --git a/src/index.ts b/src/index.ts"),
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });

    it("does not flag which exit 1 as a failure", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "which python3" }),
        toolResult("1", "bash", "CWD: /app\nExit code 1"),
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });

    it("does not flag 2>/dev/null with empty output and exit 1 as a failure", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "cat /maybe/file 2>/dev/null" }),
        toolResult("1", "bash", "CWD: /app\nExit code 1\n"),
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });

    it("does not flag git add exit 1 as a failure", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "git add ." }),
        toolResult("1", "bash", "CWD: /app\nExit code 1\nnothing to add"),
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });

    it("does not flag ls with glob exit 2 as a failure", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "ls agents/*/domain.md" }),
        toolResult("1", "bash", "CWD: /app\nExit code 2\nls: cannot access 'agents/*/domain.md'"),
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });

    it("does not flag diff (non-git) exit 1 as a failure", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "diff file1.txt file2.txt" }),
        toolResult("1", "bash", "CWD: /app\nExit code 1\n< line1\n---\n> line2"),
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });
  });

  // ── Explicit isError from tool ────────────────────────────────────
  describe("explicit isError flag", () => {
    it("treats toolResult with isError=true as a failure trigger", () => {
      const messages = [
        assistantWithToolCall("1", "read", { path: "nowhere.ts" }),
        toolResult("1", "read", "Error reading file: ENOENT", true),
        // Non-recovery next call
        assistantWithToolCall("2", "bash", { command: "echo unrelated" }),
        toolResult("2", "bash", "CWD: /app\nunrelated"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(1);
      expect(chains[0].trigger.tool).toBe("read");
    });
  });

  // ── Hallucinated find paths ───────────────────────────────────────
  describe("hallucinated find paths", () => {
    it("flags find with hallucinated absolute path and no results as error", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "find /home/user/project -name '*.ts'" }),
        toolResult("1", "bash", "CWD: /app\n(no output)"),
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      // Should detect the hallucinated path find as an error
      expect(chains.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag find from current directory as error", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "find . -name 'vitest.config.ts'" }),
        toolResult("1", "bash", "CWD: /app\n(no output)"),
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });

    it("does NOT flag find from relative path as error", () => {
      const messages = [
        assistantWithToolCall("1", "bash", { command: "find src/ -name '*.test.ts'" }),
        toolResult("1", "bash", "CWD: /app\n(no output)"),
        assistantWithToolCall("2", "bash", { command: "echo done" }),
        toolResult("2", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });
  });

  // ── Multiple chains ───────────────────────────────────────────────
  describe("multiple chains in one session", () => {
    it("extracts multiple independent failure chains", () => {
      const messages = [
        // Chain 1: read failure
        assistantWithToolCall("1", "read", { path: "bad.ts" }),
        toolResult("1", "read", "Error reading file: ENOENT", true),
        // Normal call breaks chain 1
        assistantWithToolCall("2", "bash", { command: "echo moving on" }),
        toolResult("2", "bash", "CWD: /app\nmoving on"),
        // Chain 2: another read failure
        assistantWithToolCall("3", "read", { path: "also-bad.ts" }),
        toolResult("3", "read", "Error reading file: ENOENT", true),
        // Normal call breaks chain 2
        assistantWithToolCall("4", "bash", { command: "echo done" }),
        toolResult("4", "bash", "CWD: /app\ndone"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(2);
    });
  });

  // ── Messages without tool calls ───────────────────────────────────
  describe("non-tool messages are ignored", () => {
    it("handles interleaved text messages gracefully", () => {
      const messages = [
        { role: "user" as const, content: "Please read the file" },
        { role: "assistant" as const, content: "I'll read it for you." },
        assistantWithToolCall("1", "read", { path: "exists.ts" }),
        toolResult("1", "read", "export const x = 1;"),
      ] as any[];

      const chains = extractFailureChains(messages);
      expect(chains).toHaveLength(0);
    });
  });
});

describe("formatFailureChains", () => {
  it("returns empty string for no chains", () => {
    expect(formatFailureChains([])).toBe("");
  });

  it("formats a single chain with trigger and no resolution", () => {
    const chains: FailureChain[] = [
      {
        trigger: {
          tool: "read",
          args: '{"path":"bad.ts"}',
          result: "ENOENT: no such file",
          isError: true,
        },
        recovery: [],
        resolution: null,
        wastedCalls: 1,
        rootCause: "read tool returned ENOENT",
      },
    ];

    const output = formatFailureChains(chains);
    expect(output).toContain("## Failure Chains");
    expect(output).toContain("Chain 1");
    expect(output).toContain("1 wasted call");
    expect(output).toContain("read tool returned ENOENT");
    expect(output).toContain("**unresolved**");
    expect(output).toContain("Total wasted calls from failure chains: 1");
  });

  it("formats a chain with recovery steps and resolution", () => {
    const chains: FailureChain[] = [
      {
        trigger: {
          tool: "read",
          args: '{"path":"wrong.ts"}',
          result: "ENOENT",
          isError: true,
        },
        recovery: [
          {
            tool: "bash",
            args: '{"command":"find . -name wrong.ts"}',
            result: "(no output)",
            isError: true,
          },
          {
            tool: "bash",
            args: '{"command":"ls src/"}',
            result: "correct.ts",
            isError: false,
          },
        ],
        resolution: {
          tool: "read",
          args: '{"path":"src/correct.ts"}',
          result: "export const x = 1;",
          isError: false,
        },
        wastedCalls: 3,
        rootCause: "read tool returned ENOENT for wrong.ts",
      },
    ];

    const output = formatFailureChains(chains);
    expect(output).toContain("3 wasted calls");
    expect(output).toContain("**resolved:**");
    expect(output).toContain("Total wasted calls from failure chains: 3");
  });

  it("formats multiple chains and sums wasted calls", () => {
    const chains: FailureChain[] = [
      {
        trigger: { tool: "read", args: "{}", result: "ENOENT", isError: true },
        recovery: [],
        resolution: null,
        wastedCalls: 1,
        rootCause: "file not found",
      },
      {
        trigger: { tool: "bash", args: "{}", result: "exit 1", isError: true },
        recovery: [
          { tool: "bash", args: '{"command":"ls"}', result: "file.ts", isError: false },
        ],
        resolution: null,
        wastedCalls: 2,
        rootCause: "command failed",
      },
    ];

    const output = formatFailureChains(chains);
    expect(output).toContain("2 failure chain(s)");
    expect(output).toContain("Chain 1");
    expect(output).toContain("Chain 2");
    expect(output).toContain("Total wasted calls from failure chains: 3");
  });

  it("includes root cause diagnosis guidance", () => {
    const chains: FailureChain[] = [
      {
        trigger: { tool: "read", args: "{}", result: "error", isError: true },
        recovery: [],
        resolution: null,
        wastedCalls: 1,
        rootCause: "test",
      },
    ];

    const output = formatFailureChains(chains);
    expect(output).toContain("address the **root cause**");
    expect(output).toContain("not the symptoms");
  });
});
