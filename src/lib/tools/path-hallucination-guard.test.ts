/**
 * Tests for path-hallucination-guard.ts
 *
 * Validates the guard correctly detects hallucinated paths in bash commands
 * and allows legitimate search/grep commands through.
 */

import { describe, test, expect } from "vitest";
import { createPathHallucinationGuard } from "./path-hallucination-guard.js";
import type { BeforeToolCallContext } from "./compose-guards.js";

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function bashCtx(command: string): BeforeToolCallContext {
  return {
    toolCall: { name: "bash", id: "call_test" },
    args: { command },
    context: { messages: [] },
  };
}

function readCtx(path: string): BeforeToolCallContext {
  return {
    toolCall: { name: "read", id: "call_test" },
    args: { path },
    context: { messages: [] },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

describe("path-hallucination-guard", () => {
  const guard = createPathHallucinationGuard();

  describe("non-bash tools — should pass through", () => {
    test("read() is not intercepted", async () => {
      const result = await guard(readCtx("/home/example-user/file.ts"));
      expect(result).toBeUndefined();
    });

    test("other tools are not intercepted", async () => {
      const ctx: BeforeToolCallContext = {
        toolCall: { name: "write", id: "call_test" },
        args: { path: "/home/user/file", content: "test" },
        context: { messages: [] },
      };
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });
  });

  describe("clean bash commands — should pass through", () => {
    test("normal command with /app path", async () => {
      const result = await guard(bashCtx("cd /app && git status"));
      expect(result).toBeUndefined();
    });

    test("normal command with relative path", async () => {
      const result = await guard(bashCtx("cat src/lib/manager.ts"));
      expect(result).toBeUndefined();
    });

    test("command with no path at all", async () => {
      const result = await guard(bashCtx("echo hello world"));
      expect(result).toBeUndefined();
    });

    test("empty command", async () => {
      const result = await guard(bashCtx(""));
      expect(result).toBeUndefined();
    });

    test("command with /tmp path (legitimate)", async () => {
      const result = await guard(bashCtx("ls /tmp"));
      expect(result).toBeUndefined();
    });

    test("command with /var path (legitimate)", async () => {
      const result = await guard(bashCtx("cat /var/log/syslog"));
      expect(result).toBeUndefined();
    });

    test("command with /etc path (legitimate)", async () => {
      const result = await guard(bashCtx("cat /etc/hosts"));
      expect(result).toBeUndefined();
    });
  });

  describe("hallucinated /home/ paths — should block", () => {
    test("cd /home/example-user/may-agent", async () => {
      const result = await guard(bashCtx("cd /home/example-user/may-agent && git status"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("PATH_HALLUCINATION");
      expect(result!.reason).toContain("/home/example-user/may-agent");
    });

    test("cat /home/user/file.ts", async () => {
      const result = await guard(bashCtx("cat /home/user/file.ts"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("/home/user/file.ts");
    });

    test("ls /home/ubuntu/project", async () => {
      const result = await guard(bashCtx("ls /home/ubuntu/project"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });

    test("inline path reference in complex command", async () => {
      const result = await guard(bashCtx("export PATH=$PATH:/home/user/bin && echo $PATH"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });
  });

  describe("hallucinated /Users/ paths — should block", () => {
    test("cd /Users/example-user/c0", async () => {
      const result = await guard(bashCtx("cd /Users/example-user/c0 && ls"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("/Users/example-user/c0");
    });

    test("cat /Users/dev/project/file.ts", async () => {
      const result = await guard(bashCtx("cat /Users/dev/project/file.ts"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });
  });

  describe("hallucinated /root/ paths — should block", () => {
    test("cd /root/may-agent", async () => {
      const result = await guard(bashCtx("cd /root/may-agent && ls"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("/root/may-agent");
    });

    test("ls /root/project/src", async () => {
      const result = await guard(bashCtx("ls /root/project/src"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });
  });

  describe("hallucinated ~/ paths — should block", () => {
    test("cd ~/may-agent", async () => {
      const result = await guard(bashCtx("cd ~/may-agent && git status"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("~/may-agent");
    });

    test("cat ~/file.ts", async () => {
      const result = await guard(bashCtx("cat ~/file.ts"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });

    test("ls ~/project", async () => {
      const result = await guard(bashCtx("ls ~/project"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });

    test("tilde at start of command", async () => {
      const result = await guard(bashCtx("~/bin/script.sh"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });
  });

  describe("search commands — should allow (false positive prevention)", () => {
    test("grep for /home pattern in source files", async () => {
      const result = await guard(bashCtx('grep -r "/home" src/'));
      expect(result).toBeUndefined();
    });

    test("grep for /Users pattern", async () => {
      const result = await guard(bashCtx('grep -rn "/Users/" agents/'));
      expect(result).toBeUndefined();
    });

    test("rg for /root pattern", async () => {
      const result = await guard(bashCtx('rg "/root/" src/lib/'));
      expect(result).toBeUndefined();
    });

    test("echo mentioning /home path", async () => {
      const result = await guard(bashCtx('echo "The path /home/user does not exist"'));
      expect(result).toBeUndefined();
    });

    test("printf mentioning paths", async () => {
      const result = await guard(bashCtx('printf "Path: /home/user/file\\n"'));
      expect(result).toBeUndefined();
    });

    test("ag searching for path pattern", async () => {
      const result = await guard(bashCtx('ag "/home/" src/'));
      expect(result).toBeUndefined();
    });
  });

  describe("error message quality", () => {
    test("mentions /app as the correct path", async () => {
      const result = await guard(bashCtx("cd /home/example-user/project"));
      expect(result).toBeDefined();
      expect(result!.reason).toContain("/app");
      expect(result!.reason).toContain("project root is /app");
    });

    test("includes example corrections", async () => {
      const result = await guard(bashCtx("cd /root/may-agent"));
      expect(result).toBeDefined();
      expect(result!.reason).toContain("Example:");
    });
  });

  describe("edge cases", () => {
    test("command with missing args", async () => {
      const ctx: BeforeToolCallContext = {
        toolCall: { name: "bash", id: "call_test" },
        args: {},
        context: { messages: [] },
      };
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("command with non-string command", async () => {
      const ctx: BeforeToolCallContext = {
        toolCall: { name: "bash", id: "call_test" },
        args: { command: 42 },
        context: { messages: [] },
      };
      const result = await guard(ctx);
      expect(result).toBeUndefined();
    });

    test("multi-line command with hallucinated path", async () => {
      const cmd = `cd /app
ls -la
cd /home/example-user/project
git status`;
      const result = await guard(bashCtx(cmd));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });

    test("path in middle of complex pipeline", async () => {
      const result = await guard(bashCtx("find /home/user -name '*.ts' | xargs wc -l"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });

    test("heredoc with hallucinated path", async () => {
      const cmd = `cat << 'EOF' > /home/user/script.sh
#!/bin/bash
echo hello
EOF`;
      const result = await guard(bashCtx(cmd));
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
    });
  });
});
